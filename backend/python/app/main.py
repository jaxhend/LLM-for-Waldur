from typing import Literal, List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware

Role = Literal["system", "user", "assistant", "tool"]
class Message(BaseModel):
    role: Role
    content: str

class ChatRequest(BaseModel):
    messages: List[Message] = Field(min_length=1, description="Conversation so far")

class Choice(BaseModel):
    index: int
    message: Message

class ChatResponse(BaseModel):
    id: str
    model: str
    created: int
    choices: List[Choice]

app = FastAPI(title="Waldur LLM Backend", version="0.1.0", description="Waldur LLM Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.post("/api/v1/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    if not req.messages:
        raise HTTPException(status_code=404, detail="messages required")
    last_user = next((m.content for m in reversed(req.messages) if m.role == "user"), "")
    return ChatResponse(
        id ="demo-1",
        model= "echo",
        created= int(__import__("time").time()),
        choices= [
            Choice(
                index=0,
                message=Message(role="assistant", content=f"Echo: {last_user}")
            )
        ],
    )
