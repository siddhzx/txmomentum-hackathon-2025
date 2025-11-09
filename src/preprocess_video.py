# preprocess_video.py
import cv2
import numpy as np
from PIL import Image
import torch
from transformers import BlipProcessor, BlipForConditionalGeneration
import asyncio
from typing import List

class VideoProcessor:
    def __init__(self, target_fps=1, frame_size=(224,224)):
        self.target_fps = target_fps
        self.frame_size = frame_size
        # BLIP image captioning
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.blip_processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
        self.blip_model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base").to(self.device)

    async def extract_frames_from_file(self, path: str, max_frames=8) -> List[np.ndarray]:
        cap = cv2.VideoCapture(path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        step = max(1, int(round(fps / self.target_fps)))
        frames = []
        idx = 0
        while True and len(frames) < max_frames:
            ret, frame = cap.read()
            if not ret:
                break
            if idx % step == 0:
                # convert to RGB
                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frames.append(frame)
            idx += 1
        cap.release()
        return frames

    def frame_from_jpeg_bytes(self, b: bytes):
        arr = np.frombuffer(b, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)  # BGR
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        return img

    async def caption_single_frame(self, frame: np.ndarray) -> str:
        image = Image.fromarray(frame).convert("RGB")
        inputs = self.blip_processor(images=image, return_tensors="pt").to(self.device)
        out_ids = self.blip_model.generate(**inputs, max_new_tokens=32)
        caption = self.blip_processor.decode(out_ids[0], skip_special_tokens=True)
        return caption

    async def caption_frames(self, frames):
        captions = []
        for f in frames:
            captions.append(await self.caption_single_frame(f))
        return captions