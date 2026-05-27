"""Ranking service — FastAPI app for AI reranking."""
from fastapi import FastAPI

app = FastAPI(title="Open Music Ranking Service", version="0.1.0")


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
