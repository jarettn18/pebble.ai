from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.database import get_db
from pebble.middleware.auth import get_current_user
from pebble.models.user import User
from pebble.schemas.csv_import import CSVImportResponse
from pebble.services.csv_import import import_transactions, parse_csv, validate_account

router = APIRouter(prefix="/v1/transactions", tags=["transactions"])

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("/import-csv", response_model=CSVImportResponse, status_code=status.HTTP_201_CREATED)
async def import_csv_endpoint(
    file: UploadFile = File(...),
    account_id: str = Form(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate file type
    filename = (file.filename or "").lower()
    if not filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are accepted",
        )

    # Read and validate file size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 5 MB",
        )

    if not content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty",
        )

    acct_uuid = await validate_account(str(user.id), account_id, db)
    rows = parse_csv(content)
    result = await import_transactions(str(user.id), acct_uuid, rows, db)

    return result
