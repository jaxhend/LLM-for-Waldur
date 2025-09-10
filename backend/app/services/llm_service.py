from ..config import settings
from ..providers.base import LLMProvider
from ..providers.ollama_provider import OllamaProvider
from ..schemas import ChatRequest


def _select_provider(name: str | None) -> LLMProvider:
    provider = (name or settings.default_provider).lower()
    if provider == 'ollama':
        return OllamaProvider()
    raise ValueError(f'Unknown provider {provider}')

async def complete(req: ChatRequest):
    """
    Method for completing a Chat request that doesn't need a "live preview" (response appearing gradually on the screen).
    :param req: Chat request
    :return: response JSON
    """
    provider = _select_provider(req.provider)
    model = req.model or settings.model

    # Convert Pydantic ChatMessage to dict for providers
    msgs = [m.model_dump() for m in req.messages]
    return await provider.complete(
        messages=msgs,
        model=model,
        temperature=req.temperature,
        max_tokens=req.max_tokens,
        stream=req.stream,
    )

async def astream(req: ChatRequest):
    """
    Method for completing a Chat request with stream. This would be the default in our case, since we want the LLM to answer
    like other chatbots (you can see the text appearing word by word)
    :param req:
    :return:
    """
    provider = _select_provider(req.provider)
    model = req.model or settings.model

    # Convert Pydantic ChatMessage to dict for providers
    msgs = [m.model_dump() for m in req.messages]
    async for chunk in provider.astream(
        messages=msgs,
        model=model,
        temperature=req.temperature,
        max_tokens=req.max_tokens,
    ):
        yield chunk