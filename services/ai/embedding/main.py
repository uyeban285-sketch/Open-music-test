"""Embedding service — FastAPI app for text/track embeddings."""
from fastapi import FastAPI

app = FastAPI(title="Open Music Embedding Service", version="0.1.0")


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
