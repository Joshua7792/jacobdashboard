from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable

from ..config import TRAINING_CATALOG


def normalize_catalog_key(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_only = "".join(char for char in normalized if not unicodedata.combining(char))
    ascii_only = re.sub(r"[^A-Za-z0-9&/ ]+", " ", ascii_only).lower()
    return re.sub(r"\s+", " ", ascii_only).strip()


def serialize_aliases(aliases: Iterable[str]) -> str:
    return " | ".join(alias.strip() for alias in aliases if alias.strip())


def parse_aliases(raw_value: str | None) -> list[str]:
    if not raw_value:
        return []
    return [part.strip() for part in raw_value.split("|") if part.strip()]


def config_catalog_lookup() -> dict[str, dict[str, object]]:
    lookup: dict[str, dict[str, object]] = {}
    for item in TRAINING_CATALOG:
        labels = [item["name"], *item.get("aliases", [])]
        for label in labels:
            lookup[normalize_catalog_key(str(label))] = item
    return lookup


def build_database_catalog_lookup(catalog_items) -> dict[str, object]:
    config_lookup = config_catalog_lookup()
    lookup: dict[str, object] = {}

    for catalog_item in catalog_items:
        lookup[normalize_catalog_key(catalog_item.name)] = catalog_item

        for alias in parse_aliases(getattr(catalog_item, "aliases", None)):
            lookup[normalize_catalog_key(alias)] = catalog_item

        config_item = config_lookup.get(normalize_catalog_key(catalog_item.name))
        if config_item:
            for alias in config_item.get("aliases", []):
                lookup[normalize_catalog_key(str(alias))] = catalog_item

    return lookup
