# model_interface.py
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import asyncio
from typing import List

class ModelInterface:
    def __init__(self, model_name="google/flan-t5-base", device="cpu"):
        self.device = device
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(model_name).to(self.device)
        # adjust generation kwargs as needed
        self.gen_kwargs = {"max_new_tokens": 256, "do_sample": False}

    def compose_prompt(self, task: str, transcript: str, captions: List[str]) -> str:
        parts = []
        if transcript:
            parts.append("Transcript:\n" + transcript.strip())
        if captions:
            parts.append("Video captions:\n" + "\n".join(captions))
        body = "\n\n".join(parts)
        prompt = f"You are an expert assistant. Task: {task}\n\nContext:\n{body}\n\nAnswer succinctly, include key findings and any timestamps if available."
        return prompt

    async def generate(self, prompt: str) -> str:
        # simple single example inference using the seq2seq model
        input_ids = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=1024).input_ids.to(self.device)
        out = self.model.generate(input_ids, **self.gen_kwargs)
        text = self.tokenizer.decode(out[0], skip_special_tokens=True)
        return text

    async def generate_many(self, prompts: List[str]):
        # default loop (not optimized batching)
        results = []
        for p in prompts:
            results.append(await self.generate(p))
        return results