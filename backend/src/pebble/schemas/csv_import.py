from pydantic import BaseModel


class CSVImportError(BaseModel):
    row: int
    reason: str


class CSVImportResponse(BaseModel):
    imported: int
    skipped: int
    failed: int
    errors: list[CSVImportError]
