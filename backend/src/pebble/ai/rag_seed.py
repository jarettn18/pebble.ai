"""Seed the financial_tips table with embeddings.

Usage:
    python -m pebble.ai.rag_seed
"""

import asyncio
import json
import logging
from pathlib import Path

from sqlalchemy import select

from pebble.ai.rag import embed_text
from pebble.database import async_session
from pebble.models.financial_tip import FinancialTip

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

TIPS_FILE = Path(__file__).parent / "tips_data.json"


async def seed_tips() -> None:
    tips = json.loads(TIPS_FILE.read_text())
    logger.info("Loaded %d tips from %s", len(tips), TIPS_FILE.name)

    async with async_session() as db:
        for i, tip in enumerate(tips, 1):
            # Check if tip already exists (by title)
            result = await db.execute(
                select(FinancialTip).where(FinancialTip.title == tip["title"])
            )
            existing = result.scalar_one_or_none()

            # Embed the combined title + content for better retrieval
            text = f"{tip['title']}: {tip['content']}"
            embedding = embed_text(text)

            if existing:
                existing.content = tip["content"]
                existing.category = tip["category"]
                existing.embedding = embedding
                logger.info("[%d/%d] Updated: %s", i, len(tips), tip["title"])
            else:
                db.add(FinancialTip(
                    title=tip["title"],
                    content=tip["content"],
                    category=tip["category"],
                    embedding=embedding,
                ))
                logger.info("[%d/%d] Added: %s", i, len(tips), tip["title"])

        await db.commit()

    logger.info("Done — %d tips seeded.", len(tips))


if __name__ == "__main__":
    asyncio.run(seed_tips())
