from collections import Counter
from dataclasses import dataclass
import hashlib
import math
import re
from typing import Protocol

from app.models.event import Event


class EmbeddingProvider(Protocol):
    provider: str
    model: str
    dimensions: int

    def embed(self, text: str) -> list[float]:
        ...


@dataclass(frozen=True)
class LocalHashEmbeddingProvider:
    provider: str = "local"
    model: str = "hashing-v1"
    dimensions: int = 512

    def embed(self, text: str) -> list[float]:
        vector = [0.0] * self.dimensions
        terms = _expand_terms(_tokenize(text))

        for term, count in Counter(terms).items():
            digest = hashlib.blake2b(term.encode("utf-8"), digest_size=8).digest()
            index = int.from_bytes(digest[:4], "big") % self.dimensions
            vector[index] += 1.0 + math.log(count)

        return normalize_vector(vector)


SYNONYMS: dict[str, tuple[str, ...]] = {
    "api": ("endpoint", "route", "fastapi", "http"),
    "backend": ("fastapi", "api", "server", "service"),
    "bug": ("error", "issue", "failure", "regression"),
    "clipboard": ("copy", "paste", "snippet"),
    "database": ("sqlite", "sql", "table", "migration"),
    "db": ("database", "sqlite", "sql"),
    "endpoint": ("api", "route", "fastapi", "backend"),
    "file": ("filesystem", "path", "snapshot"),
    "frontend": ("react", "typescript", "dashboard", "ui"),
    "migration": ("database", "sqlite", "schema", "table"),
    "route": ("api", "endpoint", "fastapi", "backend"),
    "search": ("query", "retrieval", "filter"),
    "semantic": ("meaning", "retrieval", "similarity"),
}


def get_embedding_provider() -> EmbeddingProvider:
    return LocalHashEmbeddingProvider()


def event_embedding_text(event: Event) -> str:
    metadata = " ".join(f"{key} {value}" for key, value in event.metadata_.items())
    return " ".join([event.source, event.event_type, event.title, event.content, metadata]).strip()


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0

    return sum(left_value * right_value for left_value, right_value in zip(left, right, strict=True))


def normalize_vector(vector: list[float]) -> list[float]:
    magnitude = math.sqrt(sum(value * value for value in vector))
    if magnitude == 0:
        return vector

    return [value / magnitude for value in vector]


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9_]+", text.lower())


def _expand_terms(tokens: list[str]) -> list[str]:
    terms: list[str] = []
    for token in tokens:
        terms.append(token)
        terms.extend(SYNONYMS.get(token, ()))

    return terms
