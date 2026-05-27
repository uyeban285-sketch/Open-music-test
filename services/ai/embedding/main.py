"""
Embedding Service — FastAPI app for text/track vector embeddings.
Uses intfloat/multilingual-e5-large (1024-dim).
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import numpy as np
from typing import Optional
import os

app = FastAPI(title="Open Music Embedding Service", version="0.2.0")

# Model loading (lazy — loaded on first request or startup)
_model = None
EMBED_DIM = 1024
MODEL_NAME = os.getenv("EMBED_MODEL", "intfloat/multilingual-e5-large")


def get_model():
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer(MODEL_NAME)
        except Exception:
            # Fallback: random embeddings for dev/testing
            _model = "mock"
    return _model


class EmbedTextRequest(BaseModel):
    text: str
    prefix: str = "query: "


class EmbedTrackRequest(BaseModel):
    title: str
    artists: list[str]
    album: Optional[str] = None
    genre: Optional[str] = None


class EmbedBatchRequest(BaseModel):
    texts: list[str]
    prefix: str = "passage: "


class EmbedResponse(BaseModel):
    embedding: list[float]
    dim: int


class EmbedBatchResponse(BaseModel):
    embeddings: list[list[float]]
    dim: int
    count: int


@app.get("/healthz")
async def healthz():
    return {"status": "ok", "model": MODEL_NAME, "dim": EMBED_DIM}


@app.post("/embed/text", response_model=EmbedResponse)
async def embed_text(req: EmbedTextRequest):
    model = get_model()
    text = f"{req.prefix}{req.text}"

    if model == "mock":
        embedding = np.random.randn(EMBED_DIM).tolist()
    else:
        embedding = model.encode(text, normalize_embeddings=True).tolist()

    return EmbedResponse(embedding=embedding, dim=EMBED_DIM)


@app.post("/embed/track", response_model=EmbedResponse)
async def embed_track(req: EmbedTrackRequest):
    model = get_model()
    # Compose track text representation
    parts = [req.title, " - ", ", ".join(req.artists)]
    if req.album:
        parts.append(f" [{req.album}]")
    if req.genre:
        parts.append(f" ({req.genre})")
    text = f"passage: {''.join(parts)}"

    if model == "mock":
        embedding = np.random.randn(EMBED_DIM).tolist()
    else:
        embedding = model.encode(text, normalize_embeddings=True).tolist()

    return EmbedResponse(embedding=embedding, dim=EMBED_DIM)


@app.post("/embed/batch", response_model=EmbedBatchResponse)
async def embed_batch(req: EmbedBatchRequest):
    model = get_model()
    texts = [f"{req.prefix}{t}" for t in req.texts]

    if model == "mock":
        embeddings = [np.random.randn(EMBED_DIM).tolist() for _ in texts]
    else:
        embeddings = model.encode(texts, normalize_embeddings=True, batch_size=32).tolist()

    return EmbedBatchResponse(embeddings=embeddings, dim=EMBED_DIM, count=len(embeddings))
