from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.deps import get_db
from ..db.models.runs import Runs
from ..db.models.users import Users

router = APIRouter(prefix="/usage", tags=["Usage Logs"])


@router.post("/log")
async def log_usage(data: dict, db: AsyncSession=Depends(get_db)):
        """
            Logs one model inference (token usage + cost) to the Queries table.
            Expected data:
              {
                "user_id": 1,
                "model_name": "llama3.1:8b",
                "input_tokens": 33,
                "output_tokens": 45,
                "total_tokens": 78,
                "cost_cents": 2
              }
            """
        user_id = data.get("user_id")
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id is required")

        user = await db.get(Users, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Create and add query log
        q = Runs(
            user_id=user_id,
            thread_id=data.get("thread_id"),
            message_id=data.get("message_id"),
            model_name=data.get("model_name", "unknown"),
            input_tokens=data.get("input_tokens", 0),
            output_tokens=data.get("output_tokens", 0),
            total_tokens=(data.get("input_tokens", 0) + data.get("output_tokens", 0)),
            cost_cents=data.get("cost_cents", 0),
        )

        db.add(q)
        await db.commit()
        await db.refresh(q)

        return {"status": "ok", "query_id": q.id}