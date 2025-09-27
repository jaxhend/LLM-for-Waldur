
from langchain_ollama import ChatOllama

from ..config import settings


def build_chat_chain():
    return ChatOllama(
        model="llama3.2:1b",
        temperature=0.2,
        base_url=settings.ollama_base_url or "http://127.0.0.1:11434",
    )