# server.py
import asyncio
import base64
import json
import uuid
import time
import os
import tempfile
import io
import soundfile as sf
from typing import Optional
from fastapi import FastAPI, WebSocket, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import aiofiles
import numpy as np
import torch

# Local modules
from preprocess_audio import AudioProcessor
from preprocess_video import VideoProcessor
from model_interface import ModelInterface

app = FastAPI(title="Tacite - Local Inference Server (Audio+Video -> LLM)")

# Config
BATCH_MAX = 6
BATCH_WAIT_MS = 50

# Instantiate processors & model interface (singletons)
audio_proc = AudioProcessor(target_sr=16000)
video_proc = VideoProcessor(target_fps=1, frame_size=(224, 224))
model_if = ModelInterface(device="cuda" if torch.cuda.is_available() else "cpu")

# Simple in-memory session store for websocket streams
sessions = {}

# ---- Small batching queue for single-shot (REST) requests (uses same model_if) ----
class Req:
    def __init__(self, payload, fut):
        self.payload = payload
        self.fut = fut

batch_q: asyncio.Queue = asyncio.Queue()

async def batch_worker():
    while True:
        reqs = []
        try:
            first = await batch_q.get()
            reqs.append(first)
            t0 = time.time()
            # collect more
            while len(reqs) < BATCH_MAX and (time.time() - t0) * 1000 < BATCH_WAIT_MS:
                try:
                    reqs.append(batch_q.get_nowait())
                except asyncio.QueueEmpty:
                    await asyncio.sleep(0)
            # Build combined prompt list
            prompts = [r.payload["combined_prompt"] for r in reqs]
            # Run model in a loop (model may not support batching) - model_interface handles batching if possible
            try:
                results = await model_if.generate_many(prompts)
                for r, out in zip(reqs, results):
                    if not r.fut.cancelled():
                        r.fut.set_result(out)
            except Exception as e:
                for r in reqs:
                    if not r.fut.cancelled():
                        r.fut.set_exception(e)
        except Exception as e:
            await asyncio.sleep(0.1)

@app.on_event("startup")
async def startup_event():
    app.state.batch_worker = asyncio.create_task(batch_worker())

# ---------------- REST endpoint for one-off file uploads ----------------
@app.post("/v1/infer")
async def infer_file(file: UploadFile = File(...), task: Optional[str] = "summarize"):
    request_id = str(uuid.uuid4())
    tmp_path = os.path.join(tempfile.gettempdir(), f"{request_id}_{file.filename}")
    async with aiofiles.open(tmp_path, "wb") as f:
        content = await file.read()
        await f.write(content)
    # Attempt to detect if video or audio by filename or content type
    try:
        audio_tensor = await audio_proc.extract_audio_from_file(tmp_path)
    except Exception:
        audio_tensor = None
    try:
        frames = await video_proc.extract_frames_from_file(tmp_path)
    except Exception:
        frames = None

    # Build text inputs: transcript + captions
    transcript = ""
    captions = []
    if audio_tensor is not None:
        transcript = await audio_proc.transcribe_tensor(audio_tensor)
    if frames:
        captions = await video_proc.caption_frames(frames)

    combined_prompt = model_if.compose_prompt(task=task, transcript=transcript, captions=captions)
    fut = asyncio.get_event_loop().create_future()
    await batch_q.put(Req({"combined_prompt": combined_prompt}, fut))
    try:
        out = await asyncio.wait_for(fut, timeout=60.0)
        return JSONResponse({"request_id": request_id, "result": out})
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Inference timeout")

# ---------------- WebSocket streaming (live mic + webcam) ----------------
@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    sid = str(uuid.uuid4())
    sessions[sid] = {"audio_chunks": [], "frames": [], "last_activity": time.time()}
    await ws.send_json({"type": "session", "session_id": sid})
    try:
        while True:
            msg = await ws.receive_text()
            data = json.loads(msg)
            typ = data.get("type")
            if typ == "audio_chunk":
                # chunk is base64-encoded WAV bytes
                b64 = data["data"]
                raw = base64.b64decode(b64)
                # decode WAV to tensor
                data_arr, sr = sf.read(io.BytesIO(raw), dtype='float32')
                tensor = torch.tensor(data_arr, dtype=torch.float32)
                sessions[sid]["audio_chunks"].append(tensor)
                sessions[sid]["last_activity"] = time.time()
                # optional: run partial ASR on the latest N seconds (demo simple)
                if len(sessions[sid]["audio_chunks"]) >= 4:
                    # concatenate tensors
                    combined = torch.cat(sessions[sid]["audio_chunks"][-8:])
                    transcript = await audio_proc.transcribe_tensor(combined)
                    await ws.send_json({"type": "partial_transcript", "text": transcript})
            elif typ == "frame":
                b64 = data["data"]
                raw = base64.b64decode(b64)
                frame = video_proc.frame_from_jpeg_bytes(raw)
                sessions[sid]["frames"].append(frame)
                sessions[sid]["last_activity"] = time.time()
                # caption last frame
                caption = await video_proc.caption_single_frame(frame)
                await ws.send_json({"type": "partial_caption", "caption": caption})
            elif typ == "finalize":
                # Build final prompt
                audio_tensor = torch.cat(sessions[sid]["audio_chunks"]) if sessions[sid]["audio_chunks"] else None
                transcript = await audio_proc.transcribe_tensor(audio_tensor) if audio_tensor is not None else ""
                captions = []
                for f in sessions[sid]["frames"]:
                    captions.append(await video_proc.caption_single_frame(f))
                prompt = model_if.compose_prompt(task=data.get("task","summarize"), transcript=transcript, captions=captions)
                # run model (sync path via model_if)
                out = await model_if.generate(prompt)
                await ws.send_json({"type": "final_result", "result": out})
                # cleanup
                del sessions[sid]
                await ws.close()
                break
            else:
                await ws.send_json({"type": "error", "message": "unknown message type"})
    except Exception as e:
        try:
            await ws.send_json({"type": "error", "message": str(e)})
            await ws.close()
        except:
            pass

# Health
@app.get("/health")
def health():
    return {"status": "ok"}