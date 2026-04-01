"""RAG module — embedding and vector search for financial tips."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.models.financial_tip import FinancialTip

logger = logging.getLogger(__name__)

_model = None


def _get_model():
    """Lazy-load the sentence transformer model on first use."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading sentence-transformers model...")
        _model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Model loaded.")
    return _model


def embed_text(text: str) -> list[float]:
    """Embed a text string into a 384-dimensional vector."""
    model = _get_model()
    return model.encode(text).tolist()


async def search_tips(query: str, db: AsyncSession, limit: int = 3) -> list[dict]:
    """Find the most relevant financial tips via cosine similarity."""
    query_embedding = embed_text(query)

    result = await db.execute(
        select(FinancialTip.title, FinancialTip.content, FinancialTip.category)
        .order_by(FinancialTip.embedding.cosine_distance(query_embedding))
        .limit(limit)
    )

    return [
        {"title": row[0], "content": row[1], "category": row[2]}
        for row in result.all()
    ]
