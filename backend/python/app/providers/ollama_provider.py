import json
import uuid
from typing import Dict, Any, AsyncGenerator

import aiohttp

from ..config import settings
from .base import LLMProvider



class OllamaProvider(LLMProvider):
    name = "ollama"

    async def complete(self,
                   messages: list[dict],
                   model: str,
                   temperature: float,
                   max_tokens: int | None,
                   stream: bool) -> Dict[str, Any]:
        if stream:
            raise NotImplementedError("Use astream() for streaming")
        url = f"{settings.ollama_base_url}/api/chat"
        headers = {
            "Content-Type": "application/json",
        }
        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "options": {"temperature": temperature},
            "stream": False,
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(
                    url,
                    headers=headers,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=300)
            ) as response:
                data = await response.json()
                if response.status >= 400:
                    raise RuntimeError(f"Ollama error {response.status}: {data}")
                message = data.get("message", {})
                content = message.get("content", {})
                return {
                    "model": model,
                    "content": content,
                    "finish_reason": "stop",
                    "usage": None,
                }

    async def astream(self,
                      *,
                      messages:list[dict],
                      model:str,
                      temperature: float,
                      max_tokens: int | None) -> AsyncGenerator[Dict[str, Any], None]:
        url = f"{settings.ollama_base_url}/api/chat"
        headers = {
            "Content-Type": "application/json",
        }
        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "options": {"temperature": temperature},
            "stream": True,
        }
        chunk_id = uuid.uuid4().hex
        async with aiohttp.ClientSession() as session:
            async with session.post(
                    url,
                    headers=headers,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=300)
            ) as response:
                if response.status >= 400:
                    data = await response.json()
                    raise RuntimeError(f"Ollama error {response.status}: {data}")
                async for line_bytes in response.content:
                    line = line_bytes.decode("utf-8", errors="ignore").strip()
                    if not line:
                        continue
                    try:
                        payload = json.loads(line)
                        if payload.get("done"):
                            yield {"id": chunk_id, "model": model, "delta": "", "done": True}
                            return
                        delta = payload.get("message", {}).get("content")
                        if delta:
                            yield {"id": chunk_id, "model": model, "delta": delta, "done": False}
                    except Exception:
                        continue
