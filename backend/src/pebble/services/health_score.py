"""Financial Health Score calculation service."""

import json
import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.models.account import Account
from pebble.models.asset import Asset
from pebble.models.health_score import FinancialHealthScore
from pebble.models.user import User
from pebble.redis import redis_client
from pebble.services.benchmarks import get_all_insights
from pebble.services.dashboard import DEBT_TYPES, get_dashboard, get_net_worth_history

logger = logging.getLogger(__name__)

CACHE_PREFIX = "health_score:"
CACHE_TTL = 3600  # 1 hour
SNAPSHOT_INTERVAL = timedelta(hours=24)

# Component weights — must sum to 1.0
# credit_score reserved at 0.0 for future use
DEFAULT_WEIGHTS: dict[str, float] = {
    "savings_rate": 0.25,
    "debt_to_income": 0.20,
    "emergency_fund": 0.20,
    "budget_adherence": 0.15,
    "net_worth_trend": 0.10,
    "diversification": 0.10,
}

COMPONENT_LABELS: dict[str, str] = {
    "savings_rate": "Savings Rate",
    "debt_to_income": "Debt-to-Income",
    "emergency_fund": "Emergency Fund",
    "budget_adherence": "Budget Adherence",
    "net_worth_trend": "Net Worth Trend",
    "diversification": "Diversification",
}


def _score_to_grade(score: int) -> str:
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 70:
        return "C"
    if score >= 60:
        return "D"
    return "F"


def _status_label(score: int) -> str:
    if score >= 80:
        return "good"
    if score >= 60:
        return "fair"
    return "poor"


def _clamp(value: int) -> int:
    return max(0, min(100, value))


def _calc_savings_rate(
    monthly_income: Decimal, monthly_spending: Decimal
) -> tuple[int, bool, dict]:
    """Score based on (income - spending) / income ratio.

    20%+ savings rate = 100, 0% = 40, negative = 0.
    """
    if monthly_income <= 0:
        return 0, False, {"savings_rate_pct": None, "reason": "no_income"}

    rate = float((monthly_income - monthly_spending) / monthly_income)
    if rate <= 0:
        score = 0
    elif rate >= 0.20:
        score = 100
    else:
        # Linear from 0% -> 40 to 20% -> 100
        score = int(40 + (rate / 0.20) * 60)

    return _clamp(score), True, {"savings_rate_pct": round(rate * 100, 1)}


def _calc_debt_to_income(
    total_debt: Decimal, annual_income: Decimal
) -> tuple[int, bool, dict]:
    """Score based on total debt / annual income.

    0 DTI = 100, 0.36+ = 0.
    """
    if annual_income <= 0:
        if total_debt > 0:
            return 0, False, {"dti_ratio": None, "reason": "no_income_with_debt"}
        return 100, False, {"dti_ratio": 0, "reason": "no_income_no_debt"}

    dti = float(total_debt / annual_income)
    if dti <= 0:
        score = 100
    elif dti >= 0.36:
        score = 0
    else:
        score = int(100 * (1 - dti / 0.36))

    return _clamp(score), True, {"dti_ratio": round(dti, 3)}


def _calc_emergency_fund(
    liquid_balance: Decimal, avg_monthly_spending: Decimal
) -> tuple[int, bool, dict]:
    """Score based on months of expenses covered by liquid assets.

    6+ months = 100, 0 = 0.
    """
    if avg_monthly_spending <= 0:
        if liquid_balance > 0:
            return 100, True, {"emergency_months": 99, "reason": "no_spending"}
        return 0, False, {"emergency_months": 0, "reason": "no_data"}

    months = float(liquid_balance / avg_monthly_spending)
    if months <= 0:
        score = 0
    elif months >= 6:
        score = 100
    else:
        score = int((months / 6) * 100)

    return _clamp(score), True, {"emergency_months": round(months, 1)}


def _calc_budget_adherence(budget_summaries: list[dict]) -> tuple[int, bool, dict]:
    """Score based on % of budgets on-track.

    All on track = 100, all over = 0.
    """
    if not budget_summaries:
        return 0, False, {"reason": "no_budgets"}

    on_track = 0
    for b in budget_summaries:
        budget_amt = Decimal(str(b["amount"]))
        spent_amt = Decimal(str(b["spent"]))
        if spent_amt <= budget_amt:
            on_track += 1

    score = int((on_track / len(budget_summaries)) * 100)
    return _clamp(score), True, {
        "on_track": on_track,
        "total_budgets": len(budget_summaries),
    }


def _calc_net_worth_trend(nw_history: dict) -> tuple[int, bool, dict]:
    """Score based on net worth growth over 3 months.

    Positive growth = up to 100, flat = 60, declining = proportionally lower.
    """
    points = nw_history.get("points", [])
    if len(points) < 2:
        return 0, False, {"reason": "insufficient_history"}

    first_val = Decimal(str(points[0]["value"]))
    last_val = Decimal(str(points[-1]["value"]))

    if first_val == 0:
        if last_val > 0:
            return 100, True, {"nw_change_pct": 100}
        return 60, True, {"nw_change_pct": 0}

    change_pct = float(((last_val - first_val) / abs(first_val)) * 100)

    if change_pct >= 10:
        score = 100
    elif change_pct >= 0:
        # 0% = 60, 10% = 100
        score = int(60 + (change_pct / 10) * 40)
    elif change_pct >= -10:
        # -10% = 20, 0% = 60
        score = int(60 + (change_pct / 10) * 40)
    else:
        score = 0

    return _clamp(score), True, {"nw_change_pct": round(change_pct, 1)}


def _calc_diversification(
    accounts: list[dict], assets: list[dict]
) -> tuple[int, bool, dict]:
    """Score based on variety of account types and asset ownership.

    Each distinct account type or asset type adds points.
    """
    if not accounts and not assets:
        return 0, False, {"reason": "no_accounts_or_assets"}

    # Unique account types (checking=depository, savings=depository, credit, loan, investment, etc.)
    account_subtypes = set()
    account_types = set()
    for a in accounts:
        if a.get("type"):
            account_types.add(a["type"])
        if a.get("subtype"):
            account_subtypes.add(a["subtype"])

    has_asset = len(assets) > 0

    # Points system: max ~6 things = 100
    distinct = len(account_subtypes) + (1 if has_asset else 0)

    if distinct >= 5:
        score = 100
    elif distinct >= 4:
        score = 85
    elif distinct >= 3:
        score = 70
    elif distinct >= 2:
        score = 55
    elif distinct >= 1:
        score = 35
    else:
        score = 0

    return _clamp(score), True, {
        "account_types": sorted(account_types),
        "account_subtypes": sorted(account_subtypes),
        "has_assets": has_asset,
    }


async def calculate_health_score(
    user_id: str, db: AsyncSession
) -> dict:
    """Calculate the full financial health score from scratch."""
    today = date.today()

    # Fetch all data we need
    dashboard = await get_dashboard(user_id, month=today.month, year=today.year, db=db)
    nw_history = await get_net_worth_history(user_id, period="3M", db=db)

    # Get user profile for annual_income
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalars().first()

    monthly_income = Decimal(str(dashboard.get("monthly_income", "0")))
    monthly_spending = Decimal(str(dashboard.get("monthly_spending", "0")))

    # Use higher of transaction income or profile income / 12
    if user and user.annual_income and user.annual_income > 0:
        profile_monthly = Decimal(str(user.annual_income)) / 12
        effective_income = max(monthly_income, profile_monthly)
    else:
        effective_income = monthly_income

    annual_income = effective_income * 12

    # Calculate total debt from accounts
    total_debt = Decimal("0")
    liquid_balance = Decimal("0")
    for acct in dashboard.get("accounts", []):
        bal = acct.get("balance_current")
        if bal is None:
            continue
        bal_d = Decimal(str(bal))
        if acct.get("type") in DEBT_TYPES:
            total_debt += abs(bal_d)
        else:
            liquid_balance += bal_d

    # Average monthly spending over available months
    spending_over_time = dashboard.get("spending_over_time", [])
    non_zero_months = [
        Decimal(str(m["amount"])) for m in spending_over_time if Decimal(str(m["amount"])) > 0
    ]
    avg_monthly_spending = (
        sum(non_zero_months) / len(non_zero_months) if non_zero_months else monthly_spending
    )

    # Calculate each component
    components_raw: dict[str, tuple[int, bool, dict]] = {
        "savings_rate": _calc_savings_rate(effective_income, monthly_spending),
        "debt_to_income": _calc_debt_to_income(total_debt, annual_income),
        "emergency_fund": _calc_emergency_fund(liquid_balance, avg_monthly_spending),
        "budget_adherence": _calc_budget_adherence(dashboard.get("budget_summaries", [])),
        "net_worth_trend": _calc_net_worth_trend(nw_history),
        "diversification": _calc_diversification(
            dashboard.get("accounts", []), dashboard.get("assets", [])
        ),
    }

    # Build components with weight redistribution
    active_weights: dict[str, float] = {}
    inactive_names: list[str] = []

    for name, (score, has_data, details) in components_raw.items():
        if has_data:
            active_weights[name] = DEFAULT_WEIGHTS[name]
        else:
            inactive_names.append(name)

    # Redistribute inactive weights proportionally
    total_active = sum(active_weights.values())
    if total_active > 0:
        scale = 1.0 / total_active
        for name in active_weights:
            active_weights[name] *= scale
    else:
        # No data at all — everything equally weighted at 0
        active_weights = {name: 0 for name in DEFAULT_WEIGHTS}

    data_completeness = round(
        sum(DEFAULT_WEIGHTS[n] for n in components_raw if components_raw[n][1])
        / sum(DEFAULT_WEIGHTS.values()),
        2,
    )

    # Compute weighted overall score
    weighted_sum = 0.0
    components = []
    all_details = {}

    for name in DEFAULT_WEIGHTS:
        score, has_data, details = components_raw[name]
        weight = active_weights.get(name, 0.0)
        weighted_sum += score * weight
        all_details[name] = details

        detail_text = _build_detail_text(name, score, details)
        components.append({
            "name": name,
            "label": COMPONENT_LABELS[name],
            "score": score,
            "weight": round(weight, 3),
            "detail": detail_text,
            "status": _status_label(score) if has_data else "no_data",
            "has_data": has_data,
        })

    overall_score = _clamp(round(weighted_sum))
    grade = _score_to_grade(overall_score)

    missing_data = []
    for name in inactive_names:
        missing_data.append(name)

    # Compute demographic benchmark insights
    user_age = None
    if user and user.date_of_birth:
        user_age = today.year - user.date_of_birth.year
        if (today.month, today.day) < (user.date_of_birth.month, user.date_of_birth.day):
            user_age -= 1

    net_worth_val = dashboard.get("net_worth")
    net_worth_float = float(net_worth_val) if net_worth_val is not None else None

    savings_rate_pct = all_details.get("savings_rate", {}).get("savings_rate_pct")

    insights = get_all_insights(
        age=user_age,
        annual_income=float(annual_income) if annual_income > 0 else None,
        net_worth=net_worth_float,
        savings_rate_pct=savings_rate_pct,
    )

    return {
        "overall_score": overall_score,
        "grade": grade,
        "components": components,
        "data_completeness": data_completeness,
        "missing_data": missing_data,
        "component_details": all_details,
        "insights": insights,
        "calculated_at": datetime.now(timezone.utc).isoformat(),
    }


def _build_detail_text(name: str, score: int, details: dict) -> str:
    """Build a human-readable detail string for a component."""
    if "reason" in details:
        reasons = {
            "no_income": "No income data available",
            "no_income_with_debt": "Income data needed for accurate DTI calculation",
            "no_income_no_debt": "No debt detected",
            "no_data": "Not enough data yet",
            "no_budgets": "No budgets set up yet",
            "insufficient_history": "Need more history for trend analysis",
            "no_accounts_or_assets": "No accounts or assets linked",
            "no_spending": "No spending detected",
        }
        return reasons.get(details["reason"], "Insufficient data")

    if name == "savings_rate":
        pct = details.get("savings_rate_pct", 0)
        return f"You save {pct}% of your income"
    elif name == "debt_to_income":
        dti = details.get("dti_ratio", 0)
        return f"Your DTI ratio is {dti}"
    elif name == "emergency_fund":
        months = details.get("emergency_months", 0)
        return f"You have {months} months of expenses covered"
    elif name == "budget_adherence":
        on_track = details.get("on_track", 0)
        total = details.get("total_budgets", 0)
        return f"{on_track} of {total} budgets on track"
    elif name == "net_worth_trend":
        pct = details.get("nw_change_pct", 0)
        direction = "up" if pct >= 0 else "down"
        return f"Net worth {direction} {abs(pct)}% over 3 months"
    elif name == "diversification":
        subtypes = details.get("account_subtypes", [])
        has_assets = details.get("has_assets", False)
        parts = len(subtypes) + (1 if has_assets else 0)
        return f"{parts} distinct account/asset types"
    return ""


async def get_health_score(user_id: str, db: AsyncSession) -> dict:
    """Get the health score, using cache when available."""
    cache_key = f"{CACHE_PREFIX}{user_id}"

    # Check Redis cache
    cached = await redis_client.get(cache_key)
    if cached is not None:
        return json.loads(cached)

    # Calculate fresh
    result = await calculate_health_score(user_id, db)

    # Cache in Redis
    await redis_client.setex(cache_key, CACHE_TTL, json.dumps(result))

    # Store snapshot in DB if needed (no more than once per 24h)
    await _maybe_store_snapshot(user_id, result, db)

    return result


async def _maybe_store_snapshot(
    user_id: str, result: dict, db: AsyncSession
) -> None:
    """Store a DB snapshot if the last one is older than 24 hours."""
    last_result = await db.execute(
        select(FinancialHealthScore)
        .where(FinancialHealthScore.user_id == user_id)
        .order_by(FinancialHealthScore.calculated_at.desc())
        .limit(1)
    )
    last_score = last_result.scalars().first()

    now = datetime.now(timezone.utc)
    if last_score and (now - last_score.calculated_at.replace(tzinfo=timezone.utc)) < SNAPSHOT_INTERVAL:
        return

    snapshot = FinancialHealthScore(
        user_id=user_id,
        overall_score=result["overall_score"],
        grade=result["grade"],
        savings_rate_score=next(
            c["score"] for c in result["components"] if c["name"] == "savings_rate"
        ),
        debt_to_income_score=next(
            c["score"] for c in result["components"] if c["name"] == "debt_to_income"
        ),
        emergency_fund_score=next(
            c["score"] for c in result["components"] if c["name"] == "emergency_fund"
        ),
        budget_adherence_score=next(
            c["score"] for c in result["components"] if c["name"] == "budget_adherence"
        ),
        net_worth_trend_score=next(
            c["score"] for c in result["components"] if c["name"] == "net_worth_trend"
        ),
        diversification_score=next(
            c["score"] for c in result["components"] if c["name"] == "diversification"
        ),
        data_completeness=Decimal(str(result["data_completeness"])),
        component_details=result["component_details"],
        calculated_at=now,
    )
    db.add(snapshot)
    await db.commit()


async def get_health_score_history(
    user_id: str, period: str, db: AsyncSession
) -> list[dict]:
    """Get historical health score snapshots."""
    period_days = {"1M": 30, "3M": 90, "6M": 180, "1Y": 365}
    days = period_days.get(period, 90)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(FinancialHealthScore)
        .where(
            FinancialHealthScore.user_id == user_id,
            FinancialHealthScore.calculated_at >= cutoff,
        )
        .order_by(FinancialHealthScore.calculated_at.asc())
    )
    scores = result.scalars().all()

    return [
        {
            "date": s.calculated_at.isoformat(),
            "score": s.overall_score,
            "grade": s.grade,
        }
        for s in scores
    ]


async def invalidate_health_score_cache(user_id: str) -> None:
    """Invalidate the cached health score for a user."""
    await redis_client.delete(f"{CACHE_PREFIX}{user_id}")
