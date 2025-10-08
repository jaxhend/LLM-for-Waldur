from fastapi import APIRouter, Depends
from ..db.deps import get_db
from ..db.models import UsageLog

router = APIRouter(prefix="/usage", tags=["Usage Logs"])


@router.post("/log")
async def log_usage(
        data: dict,
        db=Depends(get_db),
):
    log = UsageLog(
        user_email=data["user_email"],
        model=data["model"],
        input_tokens=data["input_tokens"],
        output_tokens=data["output_tokens"],
        total_tokens=data["input_tokens"] + data["output_tokens"],
    )
    db.add(log)
    await db.commit()
    return {"status": "ok"}
