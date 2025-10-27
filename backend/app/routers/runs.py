from typing import List

from fastapi import APIRouter, Depends

from ..db.crud.runs import create_run
from ..db.deps import get_db
from ..schemas.runs import RunRead, RunCreate

router = APIRouter(prefix="/api/runs", tags=["runs"])


@router.get("/", response_model=List[RunRead])
async def get_runs(
        message_id: int,
        db=Depends(get_db)
):
    return await get_runs(db, message_id=message_id)


@router.post("/", response_model=RunRead, status_code=201)
async def add_run(
        data: RunCreate,
        db=Depends(get_db)
):
    return await create_run(db, data.model_dump())
