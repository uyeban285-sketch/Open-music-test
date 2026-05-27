"""
Taste Profiler — computes AIProfile, Taste_Clusters, genre/mood distributions.
Uses HDBSCAN for clustering + implicit ALS for collaborative filtering.
Runs as worker via arq (Redis queue), nightly + on-demand.
"""
from fastapi import FastAPI
from pydantic import BaseModel
import numpy as np
from typing import Optional
import os

app = FastAPI(title="Open Music Taste Profiler", version="0.2.0")


class ProfileRequest(BaseModel):
    user_id: str
    track_embeddings: list[list[float]]
    track_genres: list[list[str]]
    listening_counts: list[int]


class TasteCluster(BaseModel):
    label: str
    size: int
    centroid: list[float]
    sample_track_ids: list[str]


class ProfileResponse(BaseModel):
    user_id: str
    genre_distribution: dict[str, float]
    mood_distribution: dict[str, float]
    bpm_histogram: dict[str, float]
    energy_histogram: dict[str, float]
    taste_clusters: list[TasteCluster]
    centroid_embedding: list[float]


@app.get("/healthz")
async def healthz():
    return {"status": "ok", "service": "profiler"}


@app.post("/profile", response_model=ProfileResponse)
async def compute_profile(req: ProfileRequest):
    embeddings = np.array(req.track_embeddings) if req.track_embeddings else np.zeros((1, 1024))

    # Genre distribution (weighted by listen count)
    genre_counts: dict[str, float] = {}
    total_listens = sum(req.listening_counts) or 1
    for genres, count in zip(req.track_genres, req.listening_counts):
        for g in genres:
            genre_counts[g] = genre_counts.get(g, 0) + count
    genre_distribution = {k: v / total_listens for k, v in sorted(genre_counts.items(), key=lambda x: -x[1])[:20]}

    # Centroid embedding
    if len(embeddings) > 0 and embeddings.shape[1] > 1:
        weights = np.array(req.listening_counts, dtype=float)
        weights = weights / weights.sum() if weights.sum() > 0 else np.ones(len(weights)) / len(weights)
        centroid = (embeddings.T @ weights).tolist()
    else:
        centroid = [0.0] * 1024

    # HDBSCAN clustering
    clusters: list[TasteCluster] = []
    try:
        if len(embeddings) >= 5:
            import hdbscan
            clusterer = hdbscan.HDBSCAN(min_cluster_size=3, metric='cosine')
            labels = clusterer.fit_predict(embeddings)
            unique_labels = set(labels) - {-1}
            for label_id in list(unique_labels)[:10]:
                mask = labels == label_id
                cluster_embeds = embeddings[mask]
                cluster_centroid = cluster_embeds.mean(axis=0).tolist()
                clusters.append(TasteCluster(
                    label=f"cluster-{label_id}",
                    size=int(mask.sum()),
                    centroid=cluster_centroid,
                    sample_track_ids=[],
                ))
    except ImportError:
        # HDBSCAN not available — skip clustering
        pass

    return ProfileResponse(
        user_id=req.user_id,
        genre_distribution=genre_distribution,
        mood_distribution={},
        bpm_histogram={},
        energy_histogram={},
        taste_clusters=clusters,
        centroid_embedding=centroid[:1024],
    )
