# preprocess_audio.py
import io
import torch
import numpy as np
import soundfile as sf
import asyncio
from typing import Optional
from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC

class AudioProcessor:
    def __init__(self, target_sr=16000, model_name="facebook/wav2vec2-base-960h"):
        self.target_sr = target_sr
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.processor = Wav2Vec2Processor.from_pretrained(model_name)
        self.model = Wav2Vec2ForCTC.from_pretrained(model_name).to(self.device)

    async def extract_audio_from_file(self, path: str):
        # read via soundfile
        data, sr = sf.read(path, dtype='float32')
        if sr != self.target_sr:
            import scipy.signal
            data = scipy.signal.resample(data.astype(np.float64), int(len(data) * self.target_sr / sr)).astype(np.float32)
        return torch.tensor(data, dtype=torch.float32)

    async def from_wav_bytes(self, wav_bytes: bytes):
        # read WAV bytes into numpy array
        data, sr = sf.read(io.BytesIO(wav_bytes), dtype='float32')
        if sr != self.target_sr:
            import scipy.signal
            data = scipy.signal.resample(data.astype(np.float64), int(len(data) * self.target_sr / sr)).astype(np.float32)
        return torch.tensor(data, dtype=torch.float32)

    async def transcribe_tensor(self, tensor: torch.Tensor) -> str:
        # Wav2Vec2 expects input_values
        audio = tensor.cpu().numpy()
        input_values = self.processor(audio, return_tensors="pt", sampling_rate=self.target_sr).input_values.to(self.device)
        logits = self.model(input_values).logits
        predicted_ids = torch.argmax(logits, dim=-1)
        transcription = self.processor.batch_decode(predicted_ids)[0]
        return transcription