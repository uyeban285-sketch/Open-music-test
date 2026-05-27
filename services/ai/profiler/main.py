"""Taste Profiler — FastAPI app for user taste clustering (HDBSCAN)."""
from fastapi import FastAPI

app = FastAPI(title="Open Music Taste Profiler", version="0.1.0")


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
