from typing import Literal, Optional, List, AnyStr, Dict, Any

from pydantic import BaseModel, Field, model_validator

Role = Literal["system", "user", "assistant", "tool"]
"""
Roles:
system -> set the tone and behavior style
user -> real prompts from actual user
assistant -> previous responses
tool -> for future testing, can integrate a function call (e.g. DB query or some API)
"""

FinishReason = Literal["stop", "length", "error"]
"""
FinishReason:
stop -> natural stop (query answer ended)
length -> maximum possible length for query met
error -> error while generating response
"""

ProviderName = Literal["ollama"] # Possible to add other providers later.

class ChatMessage(BaseModel):
    role: Role
    content: str = Field(min_length=1)
    name: Optional[str] = None
    tool_call_id: Optional[str] = None


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(min_length=1)
    model: Optional[str] = None
    temperature: float = Field(default=0.7, ge=0.0, le=2.0) # Use ~0.2 for deterministic answers and ~0.9 for creative answers
    max_tokens: Optional[int] = Field(default=None, ge=1)
    stream: bool = False
    provider: Optional[ProviderName] = None
    metadata: Optional[Dict[str, Any]] = None

    @model_validator(mode="after")
    def ensure_last_user_or_system(self):
        """
        Ensures LLM can only be called when it's the model's turn to speak
        Prevents confusing prompts like "assistant" role talking to itself
        :return: self
        """
        if self.messages[-1].role not in ("user", "system"):
            raise ValueError("Last message must be from user or system")
        return self


class Usage(BaseModel):
    # TODO: implement token usage tracking, using a library like tiktoken
    # Keeps track of tokens used and is important for billing!
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None

class ChatResponse(BaseModel):
    model: str
    content: str
    finish_reason: FinishReason
    usage: Optional[Usage] = None

class ChatChunk(BaseModel):
    """Streaming chunk payload for SSE"""
    id: str
    model: str
    delta: str
    done: bool = False

