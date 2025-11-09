# live_client.py
import asyncio
import base64
import json
import websockets
import sounddevice as sd
import numpy as np
import cv2
import argparse
import threading
import time
import queue
import io
import soundfile as sf

parser = argparse.ArgumentParser()
parser.add_argument("--ws", default="ws://127.0.0.1:8000/ws")
parser.add_argument("--samplerate", type=int, default=16000)
parser.add_argument("--channels", type=int, default=1)
parser.add_argument("--chunk", type=float, default=0.5)  # seconds
args = parser.parse_args()

audio_q = queue.Queue()

def audio_callback(indata, frames, time_, status):
    if status:
        print("Audio status:", status)
    # convert to WAV bytes
    buffer = io.BytesIO()
    sf.write(buffer, indata[:,0].astype(np.float32), args.samplerate, format='WAV')
    chunk = buffer.getvalue()
    audio_q.put(chunk)

async def send_stream():
    async with websockets.connect(args.ws) as ws:
        # initiate
        # start audio recording thread
        stream = sd.InputStream(samplerate=args.samplerate, channels=args.channels, blocksize=int(args.samplerate * args.chunk), callback=audio_callback)
        stream.start()
        cap = cv2.VideoCapture(0)
        try:
            print("connected. streaming... press Ctrl+C to finalize and request inference")
            while True:
                # send audio chunk if available (non-blocking)
                try:
                    chunk = audio_q.get_nowait()
                    b64 = base64.b64encode(chunk).decode("ascii")
                    await ws.send(json.dumps({"type":"audio_chunk", "data": b64}))
                except queue.Empty:
                    pass
                ret, frame = cap.read()
                if ret:
                    # encode frame to JPEG bytes
                    _, buf = cv2.imencode('.jpg', frame)
                    b64f = base64.b64encode(buf.tobytes()).decode("ascii")
                    await ws.send(json.dumps({"type":"frame", "data": b64f}))
                await asyncio.sleep(0.2)  # throttle frame rate ~5 FPS
        except (KeyboardInterrupt, asyncio.CancelledError):
            print("finalizing session...")
            try:
                await ws.send(json.dumps({"type":"finalize", "task":"summarize"}))
                # await final response
                while True:
                    try:
                        resp = await asyncio.wait_for(ws.recv(), timeout=5)
                        print("SERVER:", resp)
                    except asyncio.TimeoutError:
                        break
            except asyncio.CancelledError:
                pass
            cap.release()
            stream.stop()

if __name__ == "__main__":
    asyncio.run(send_stream())