"""Static demographic benchmark data for financial health comparisons.

Data sources:
- Income by age: U.S. Census Bureau, Current Population Survey (CPS) 2023
- Net worth by age: Federal Reserve, Survey of Consumer Finances (SCF) 2022
- Savings rate by age: BLS Consumer Expenditure Survey 2023

All values are in USD. Percentile thresholds represent individual (not household)
income where noted, and household net worth / savings rate otherwise.
These are approximations suitable for general guidance, not precise financial advice.
"""

import bisect
from dataclasses import dataclass

# ──────────────────────────────────────────────────────────────────
# Income percentiles by age bracket (individual annual income, CPS 2023)
# Each list is sorted ascending: [p10, p25, p50, p75, p90, p95]
# ──────────────────────────────────────────────────────────────────

INCOME_PERCENTILES: dict[str, dict] = {
    "18-24": {
        "thresholds": [8_000, 15_000, 28_000, 42_000, 58_000, 72_000],
        "percentiles": [10, 25, 50, 75, 90, 95],
        "label": "18-24 year olds",
    },
    "25-29": {
        "thresholds": [14_000, 25_000, 40_000, 60_000, 85_000, 105_000],
        "percentiles": [10, 25, 50, 75, 90, 95],
        "label": "25-29 year olds",
    },
    "30-34": {
        "thresholds": [16_000, 28_000, 48_000, 72_000, 100_000, 130_000],
        "percentiles": [10, 25, 50, 75, 90, 95],
        "label": "30-34 year olds",
    },
    "35-44": {
        "thresholds": [18_000, 30_000, 52_000, 80_000, 115_000, 150_000],
        "percentiles": [10, 25, 50, 75, 90, 95],
        "label": "35-44 year olds",
    },
    "45-54": {
        "thresholds": [17_000, 28_000, 50_000, 78_000, 115_000, 150_000],
        "percentiles": [10, 25, 50, 75, 90, 95],
        "label": "45-54 year olds",
    },
    "55-64": {
        "thresholds": [14_000, 24_000, 44_000, 72_000, 108_000, 140_000],
        "percentiles": [10, 25, 50, 75, 90, 95],
        "label": "55-64 year olds",
    },
    "65+": {
        "thresholds": [10_000, 18_000, 32_000, 55_000, 85_000, 115_000],
        "percentiles": [10, 25, 50, 75, 90, 95],
        "label": "65+ year olds",
    },
}

# ──────────────────────────────────────────────────────────────────
# Net worth percentiles by age bracket (household, SCF 2022)
# [p10, p25, p50, p75, p90]
# ──────────────────────────────────────────────────────────────────

NET_WORTH_PERCENTILES: dict[str, dict] = {
    "under-35": {
        "thresholds": [-3_000, 1_000, 39_000, 130_000, 350_000],
        "percentiles": [10, 25, 50, 75, 90],
        "label": "households under 35",
    },
    "35-44": {
        "thresholds": [-1_000, 17_000, 135_000, 380_000, 870_000],
        "percentiles": [10, 25, 50, 75, 90],
        "label": "35-44 year old households",
    },
    "45-54": {
        "thresholds": [2_000, 42_000, 247_000, 650_000, 1_500_000],
        "percentiles": [10, 25, 50, 75, 90],
        "label": "45-54 year old households",
    },
    "55-64": {
        "thresholds": [3_000, 55_000, 364_000, 950_000, 2_200_000],
        "percentiles": [10, 25, 50, 75, 90],
        "label": "55-64 year old households",
    },
    "65-74": {
        "thresholds": [5_000, 75_000, 410_000, 1_000_000, 2_400_000],
        "percentiles": [10, 25, 50, 75, 90],
        "label": "65-74 year old households",
    },
    "75+": {
        "thresholds": [4_000, 50_000, 335_000, 850_000, 2_000_000],
        "percentiles": [10, 25, 50, 75, 90],
        "label": "75+ year old households",
    },
}

# ──────────────────────────────────────────────────────────────────
# Median savings rates by age bracket (BLS Consumer Expenditure 2023)
# Savings rate = (after-tax income - total expenditures) / after-tax income
# ──────────────────────────────────────────────────────────────────

SAVINGS_RATE_BENCHMARKS: dict[str, dict] = {
    "under-25": {
        "median_rate": 5.0,
        "good_rate": 12.0,
        "excellent_rate": 20.0,
        "label": "under 25",
    },
    "25-34": {
        "median_rate": 8.0,
        "good_rate": 15.0,
        "excellent_rate": 22.0,
        "label": "25-34 year olds",
    },
    "35-44": {
        "median_rate": 9.0,
        "good_rate": 16.0,
        "excellent_rate": 24.0,
        "label": "35-44 year olds",
    },
    "45-54": {
        "median_rate": 10.0,
        "good_rate": 18.0,
        "excellent_rate": 25.0,
        "label": "45-54 year olds",
    },
    "55-64": {
        "median_rate": 12.0,
        "good_rate": 20.0,
        "excellent_rate": 28.0,
        "label": "55-64 year olds",
    },
    "65+": {
        "median_rate": 14.0,
        "good_rate": 22.0,
        "excellent_rate": 30.0,
        "label": "65+",
    },
}


def _age_to_income_bracket(age: int) -> str | None:
    if age < 18:
        return None
    if age <= 24:
        return "18-24"
    if age <= 29:
        return "25-29"
    if age <= 34:
        return "30-34"
    if age <= 44:
        return "35-44"
    if age <= 54:
        return "45-54"
    if age <= 64:
        return "55-64"
    return "65+"


def _age_to_nw_bracket(age: int) -> str | None:
    if age < 18:
        return None
    if age < 35:
        return "under-35"
    if age <= 44:
        return "35-44"
    if age <= 54:
        return "45-54"
    if age <= 64:
        return "55-64"
    if age <= 74:
        return "65-74"
    return "75+"


def _age_to_savings_bracket(age: int) -> str | None:
    if age < 18:
        return None
    if age < 25:
        return "under-25"
    if age <= 34:
        return "25-34"
    if age <= 44:
        return "35-44"
    if age <= 54:
        return "45-54"
    if age <= 64:
        return "55-64"
    return "65+"


def _estimate_percentile(value: float, thresholds: list, percentiles: list) -> int:
    """Estimate what percentile a value falls in given threshold/percentile pairs.

    Returns a value 1-99.
    """
    if value <= thresholds[0]:
        # Below the lowest threshold — interpolate from 1 to that percentile
        return max(1, percentiles[0] // 2)

    if value >= thresholds[-1]:
        # Above the highest threshold — interpolate from that percentile to 99
        return min(99, percentiles[-1] + (99 - percentiles[-1]) // 2)

    # Find where value falls between thresholds
    idx = bisect.bisect_right(thresholds, value) - 1
    lower_val = thresholds[idx]
    upper_val = thresholds[idx + 1]
    lower_pct = percentiles[idx]
    upper_pct = percentiles[idx + 1]

    if upper_val == lower_val:
        return lower_pct

    # Linear interpolation
    fraction = (value - lower_val) / (upper_val - lower_val)
    return int(lower_pct + fraction * (upper_pct - lower_pct))


@dataclass
class BenchmarkInsight:
    category: str  # "income", "net_worth", "savings_rate"
    title: str
    description: str
    percentile: int | None  # 1-99 or None if not applicable
    comparison: str  # e.g. "above median", "top 15%"
    source: str
    age_bracket_label: str


def get_income_insight(age: int, annual_income: float) -> BenchmarkInsight | None:
    """Compare user's income to their age bracket."""
    bracket = _age_to_income_bracket(age)
    if bracket is None:
        return None

    data = INCOME_PERCENTILES[bracket]
    percentile = _estimate_percentile(annual_income, data["thresholds"], data["percentiles"])
    median = data["thresholds"][data["percentiles"].index(50)]

    if percentile >= 90:
        comparison = f"top {100 - percentile}%"
    elif percentile >= 50:
        comparison = "above median"
    elif percentile >= 25:
        comparison = "below median"
    else:
        comparison = f"bottom {percentile}%"

    description = (
        f"Your income of ${annual_income:,.0f} puts you at the "
        f"{_ordinal(percentile)} percentile among {data['label']}. "
        f"The median income for this age group is ${median:,.0f}."
    )

    return BenchmarkInsight(
        category="income",
        title="Income Percentile",
        description=description,
        percentile=percentile,
        comparison=comparison,
        source="U.S. Census Bureau, Current Population Survey 2023",
        age_bracket_label=data["label"],
    )


def get_net_worth_insight(age: int, net_worth: float) -> BenchmarkInsight | None:
    """Compare user's net worth to their age bracket."""
    bracket = _age_to_nw_bracket(age)
    if bracket is None:
        return None

    data = NET_WORTH_PERCENTILES[bracket]
    percentile = _estimate_percentile(net_worth, data["thresholds"], data["percentiles"])
    median = data["thresholds"][data["percentiles"].index(50)]

    if percentile >= 90:
        comparison = f"top {100 - percentile}%"
    elif percentile >= 50:
        comparison = "above median"
    elif percentile >= 25:
        comparison = "below median"
    else:
        comparison = f"bottom {percentile}%"

    description = (
        f"Your net worth of ${net_worth:,.0f} is at the "
        f"{_ordinal(percentile)} percentile among {data['label']}. "
        f"The median net worth for this group is ${median:,.0f}."
    )

    return BenchmarkInsight(
        category="net_worth",
        title="Net Worth Percentile",
        description=description,
        percentile=percentile,
        comparison=comparison,
        source="Federal Reserve, Survey of Consumer Finances 2022",
        age_bracket_label=data["label"],
    )


def get_savings_rate_insight(age: int, savings_rate_pct: float) -> BenchmarkInsight | None:
    """Compare user's savings rate to their age bracket."""
    bracket = _age_to_savings_bracket(age)
    if bracket is None:
        return None

    data = SAVINGS_RATE_BENCHMARKS[bracket]
    median = data["median_rate"]
    good = data["good_rate"]
    excellent = data["excellent_rate"]

    if savings_rate_pct >= excellent:
        comparison = "excellent"
        percentile = 90
    elif savings_rate_pct >= good:
        comparison = "above average"
        percentile = 75
    elif savings_rate_pct >= median:
        comparison = "above median"
        percentile = 60
    elif savings_rate_pct >= 0:
        comparison = "below median"
        percentile = max(5, int((savings_rate_pct / median) * 50))
    else:
        comparison = "negative (spending > income)"
        percentile = 5

    description = (
        f"Your savings rate of {savings_rate_pct:.1f}% is {comparison} "
        f"for {data['label']}. "
        f"The median savings rate for this age group is {median:.0f}%."
    )

    return BenchmarkInsight(
        category="savings_rate",
        title="Savings Rate",
        description=description,
        percentile=percentile,
        comparison=comparison,
        source="BLS Consumer Expenditure Survey 2023",
        age_bracket_label=data["label"],
    )


def get_all_insights(
    age: int | None,
    annual_income: float | None,
    net_worth: float | None,
    savings_rate_pct: float | None,
) -> list[dict]:
    """Get all available benchmark insights as serializable dicts."""
    if age is None:
        return []

    insights = []

    if annual_income is not None and annual_income > 0:
        insight = get_income_insight(age, annual_income)
        if insight:
            insights.append(_insight_to_dict(insight))

    if net_worth is not None:
        insight = get_net_worth_insight(age, net_worth)
        if insight:
            insights.append(_insight_to_dict(insight))

    if savings_rate_pct is not None:
        insight = get_savings_rate_insight(age, savings_rate_pct)
        if insight:
            insights.append(_insight_to_dict(insight))

    return insights


def _insight_to_dict(insight: BenchmarkInsight) -> dict:
    return {
        "category": insight.category,
        "title": insight.title,
        "description": insight.description,
        "percentile": insight.percentile,
        "comparison": insight.comparison,
        "source": insight.source,
        "age_bracket_label": insight.age_bracket_label,
    }


def _ordinal(n: int) -> str:
    if 11 <= (n % 100) <= 13:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"
