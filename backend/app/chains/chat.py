from langchain_ollama import ChatOllama

from ..config import settings


def build_chat_chain():
    return ChatOllama(
        model=settings.ollama_model,
        temperature=0.2,
        base_url=settings.ollama_base_url,
    )
