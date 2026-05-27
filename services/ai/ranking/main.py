"""
Ranking Service — FastAPI app for AI reranking.
Uses BAAI/bge-reranker-v2-m3 cross-encoder.
"""
from fastapi import FastAPI
from pydantic import BaseModel
import numpy as np
from typing import Optional
import os

app = FastAPI(title="Open Music Ranking Service", version="0.2.0")

MODEL_NAME = os.getenv("RERANKER_MODEL", "BAAI/bge-reranker-v2-m3")
_model = None


def get_model():
    global _model
    if _model is None:
        try:
            from sentence_transformers import CrossEncoder
            _model = CrossEncoder(MODEL_NAME)
        except Exception:
            _model = "mock"
    return _model


class Candidate(BaseModel):
    id: str
    text: str
    score: Optional[float] = None


class RerankRequest(BaseModel):
    query: str
    candidates: list[Candidate]
    top_k: int = 20


class RankedCandidate(BaseModel):
    id: str
    score: float
    original_score: Optional[float] = None


class RerankResponse(BaseModel):
    results: list[RankedCandidate]
    model: str


@app.get("/healthz")
async def healthz():
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/rerank", response_model=RerankResponse)
async def rerank(req: RerankRequest):
    model = get_model()

    if model == "mock":
        # Mock: score based on text length similarity
        results = []
        for c in req.candidates:
            score = float(np.random.uniform(0.3, 1.0))
            results.append(RankedCandidate(id=c.id, score=score, original_score=c.score))
        results.sort(key=lambda x: x.score, reverse=True)
        return RerankResponse(results=results[:req.top_k], model="mock")

    # Real reranking with cross-encoder
    pairs = [(req.query, c.text) for c in req.candidates]
    scores = model.predict(pairs, batch_size=32)

    results = []
    for i, c in enumerate(req.candidates):
        results.append(RankedCandidate(id=c.id, score=float(scores[i]), original_score=c.score))

    results.sort(key=lambda x: x.score, reverse=True)
    return RerankResponse(results=results[:req.top_k], model=MODEL_NAME)
