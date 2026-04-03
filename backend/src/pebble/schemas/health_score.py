from pydantic import BaseModel


class ComponentScore(BaseModel):
    name: str
    label: str
    score: int
    weight: float
    detail: str
    status: str
    has_data: bool


class BenchmarkInsight(BaseModel):
    category: str
    title: str
    description: str
    percentile: int | None = None
    comparison: str
    source: str
    age_bracket_label: str


class HealthScoreResponse(BaseModel):
    overall_score: int
    grade: str
    components: list[ComponentScore]
    data_completeness: float
    missing_data: list[str]
    insights: list[BenchmarkInsight] = []
    calculated_at: str


class HealthScoreHistoryPoint(BaseModel):
    date: str
    score: int
    grade: str


class HealthScoreHistoryResponse(BaseModel):
    period: str
    scores: list[HealthScoreHistoryPoint]
