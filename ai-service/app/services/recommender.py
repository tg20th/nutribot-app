"""NB-59 vector retrieval and rule-based ranking; no trained model or Gemini call."""
from __future__ import annotations
from dataclasses import dataclass
from datetime import UTC, datetime
from hashlib import blake2b
import math, re
from typing import Protocol
from app.schemas.recommender import ContentCandidate, Interaction, RecommendationItem, RecommendationRequest, RecommendationResponse
from app.services.dietary_compatibility import Compatibility, evaluate_dietary_compatibility

PUBLISHED = "PUBLISHED"
@dataclass(frozen=True)
class RankingWeights:
    semantic: float = .60
    category: float = .15
    popularity: float = .15
    freshness: float = .10
    diversity_penalty: float = .12
    retrieval_k: int = 50

class Embedder(Protocol):
    model_name: str
    def encode(self, texts: list[str]) -> list[list[float]]: ...

class HashingEmbedder:
    """Deterministic test/offline fallback; production should inject SentenceTransformerEmbedder."""
    model_name = "hashing-fallback-v1"
    def __init__(self, dimensions: int = 64): self.dimensions = dimensions
    def encode(self, texts: list[str]) -> list[list[float]]:
        vectors=[]
        for text in texts:
            vector=[0.0]*self.dimensions
            for token in re.findall(r"\w+", text.casefold()): vector[int.from_bytes(blake2b(token.encode(), digest_size=4).digest(), "big") % self.dimensions] += 1
            vectors.append(_unit(vector))
        return vectors

class SentenceTransformerEmbedder:
    """Lazy pretrained multilingual encoder. Output is a normalized dense sentence vector."""
    model_name = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    def __init__(self): self._model = None
    def encode(self, texts: list[str]) -> list[list[float]]:
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self.model_name)
        return [list(row) for row in self._model.encode(texts, normalize_embeddings=True)]

def content_text(content: ContentCandidate) -> str:
    """Build versioned semantic representation from public content metadata, never private user data."""
    return " ".join(part for part in [content.content_type, content.category or "", content.title, content.description or "", content.body or "", " ".join(content.tags)] if part).strip()
def _unit(values: list[float]) -> list[float]:
    norm=math.sqrt(sum(v*v for v in values)); return [v/norm for v in values] if norm else values
def cosine(left: list[float], right: list[float]) -> float:
    """Cosine of normalized vectors; returns zero safely for absent/zero vectors."""
    if len(left)!=len(right) or not any(left) or not any(right): return 0.0
    return max(-1.0, min(1.0, sum(a*b for a,b in zip(left,right))))

class ContentRecommender:
    """Two-stage deterministic recommender with visibility checks before and after ranking."""
    def __init__(self, embedder: Embedder | None = None, weights: RankingWeights = RankingWeights()): self.embedder=embedder or SentenceTransformerEmbedder(); self.weights=weights
    def recommend(self, request: RecommendationRequest, now: datetime | None = None) -> RecommendationResponse:
        """Return bounded, unique published IDs. Empty catalog/history is a valid empty/cold-start result."""
        now=now or datetime.now(UTC); catalog={c.content_id:c for c in request.contents if c.status==PUBLISHED and evaluate_dietary_compatibility(c, request.vegetarian_type)==Compatibility.COMPATIBLE}; contents=list(catalog.values())
        if not contents: return RecommendationResponse(items=[], embedding_model=self.embedder.model_name)
        vectors=dict(zip((c.content_id for c in contents), self.embedder.encode([content_text(c) for c in contents])))
        user, categories=self._user_vector(request.interactions, vectors, catalog)
        candidates=sorted(contents, key=lambda c: (-cosine(user,vectors[c.content_id]), c.content_id))[:self.weights.retrieval_k] if any(user) else contents
        scored=[]
        for c in candidates:
            semantic=(cosine(user,vectors[c.content_id])+1)/2 if any(user) else 0.0
            category=categories.get((c.category or "").casefold(),0.0)
            popularity=math.log1p(c.view_count)/math.log1p(max(x.view_count for x in contents)+1)
            age=max(0,(now-(c.published_at or now)).total_seconds()/86400); freshness=math.exp(-age/30)
            score=self.weights.semantic*semantic+self.weights.category*category+self.weights.popularity*popularity+self.weights.freshness*freshness
            scored.append((score,c))
        return RecommendationResponse(items=self._diversify(scored, request.limit, bool(any(user)), catalog), embedding_model=self.embedder.model_name)
    def _user_vector(self, interactions: list[Interaction], vectors: dict[int,list[float]], catalog: dict[int,ContentCandidate]):
        weighted=[]; categories={}
        for event in interactions:
            if event.content_id not in vectors: continue
            weight=(1.0 + (1.5 if event.vote==1 else -0.5 if event.vote==-1 else 0) + .5*(event.max_scroll_pct or 0)/100 + (.5 if event.completed else 0))
            if event.active_dwell_seconds is not None: weight += min(event.active_dwell_seconds/(180 if catalog[event.content_id].content_type=="VIDEO" else 120),1)*.5
            if weight<=0: continue
            weighted.append((weight,vectors[event.content_id])); key=(catalog[event.content_id].category or "").casefold(); categories[key]=categories.get(key,0)+weight
        total=sum(w for w,_ in weighted); vector=_unit([sum(w*v[i] for w,v in weighted)/total for i in range(len(weighted[0][1]))]) if total else []
        return vector,{k:v/total for k,v in categories.items()} if total else {}
    def _diversify(self, scored, limit, personalized, catalog):
        chosen=[]; category_count={}; type_count={}
        remaining=[pair for pair in scored if pair[1].status==PUBLISHED]
        while remaining and len(chosen)<limit:
            # Recompute penalties after every pick: this is a real greedy re-ranker,
            # not a display-only penalty on an already fixed order.
            score,c=max(remaining,key=lambda pair:(pair[0]-self.weights.diversity_penalty*(category_count.get(pair[1].category,0)+type_count.get(pair[1].content_type,0)),-pair[1].content_id))
            adjusted=score-self.weights.diversity_penalty*(category_count.get(c.category,0)+type_count.get(c.content_type,0))
            chosen.append((adjusted,c)); remaining.remove((score,c)); category_count[c.category]=category_count.get(c.category,0)+1; type_count[c.content_type]=type_count.get(c.content_type,0)+1
        return [RecommendationItem(content_id=c.content_id,content_type=c.content_type,score=round(score,6),reason="personalized" if personalized else "cold_start") for score,c in chosen]
