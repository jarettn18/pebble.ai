from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from pebble.routers import accounts, assets, auth, budgets, categories, dashboard, plaid, transactions

app = FastAPI(title="Pebble", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8081"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(accounts.router)
app.include_router(assets.router)
app.include_router(auth.router)
app.include_router(budgets.router)
app.include_router(categories.router)
app.include_router(dashboard.router)
app.include_router(plaid.router)
app.include_router(transactions.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
