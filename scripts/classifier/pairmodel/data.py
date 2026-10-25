"""Load labelled-pair JSONL (packages/core/src/classify/pair-dataset.ts) into arrays."""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import List, Optional

import numpy as np

RELATIONS = [
    "independent",
    "overlap_compatible",
    "duplicate",
    "textual_conflict",
    "semantic_conflict",
    "intent_contradiction",
    "ordering_dependency",
    "repeats_failure",
]
# Relations whose verdict can stop an agent (POLICY "above" is serialize or block): see core pair-model.ts.
BLOCKING = {"textual_conflict", "semantic_conflict", "intent_contradiction", "ordering_dependency"}
TEACHER_WEIGHT = 0.3


@dataclass
class Dataset:
    ids: List[str]
    X: np.ndarray
    y: np.ndarray  # relation names
    w: np.ndarray
    groups: np.ndarray  # repository / run: never split across train and validation
    gold: np.ndarray  # bool: label is ground truth, not a teacher verdict
    rule: np.ndarray  # relation a rule settles, or ""
    judge: np.ndarray  # stored judge relation, or ""
    source: np.ndarray  # dataset of origin, for per-source metrics
    synthetic: bool
    feature_version: int


def target(row: dict) -> Optional[tuple]:
    if row.get("gold"):
        return row["gold"]["relation"], 1.0, True
    t = row.get("teacher")
    if t and t.get("source") in ("rule", "llm"):
        return t["relation"], TEACHER_WEIGHT, False
    return None


def load(paths: List[str], allow_mixed: bool = False) -> Dataset:
    rows = []
    for p in paths:
        with open(p) as f:
            rows.extend(json.loads(line) for line in f if line.strip())
    # One classification can reach us twice (an eval run's snapshot and the deployment export): keep the
    # gold-labelled copy, so the same pair never sits in two groups across a split.
    best = {}
    for r in rows:
        if r["id"] not in best or (r.get("gold") and not best[r["id"]].get("gold")):
            best[r["id"]] = r
    rows = list(best.values())
    kept = [(r, target(r)) for r in rows]
    kept = [(r, t) for r, t in kept if t is not None]
    if not kept:
        raise SystemExit("no labelled rows (need gold, or a rule/llm teacher verdict)")
    versions = {r["featureVersion"] for r, _ in kept}
    lengths = {len(r["features"]) for r, _ in kept}
    if len(versions) != 1 or len(lengths) != 1:
        raise SystemExit(f"rows mix feature versions {versions} / lengths {lengths}: re-export them")
    synth = {bool(r.get("synthetic")) for r, _ in kept}
    if len(synth) > 1 and not allow_mixed:
        raise SystemExit("rows mix synthetic and real data; pass --allow-mixed if you mean it")
    meta = lambda r: r.get("meta") or {}
    return Dataset(
        ids=[r["id"] for r, _ in kept],
        X=np.array([r["features"] for r, _ in kept], dtype=np.float64),
        y=np.array([t[0] for _, t in kept]),
        w=np.array([t[1] for _, t in kept], dtype=np.float64),
        groups=np.array([str(meta(r).get("repo") or r["group"]) for r, _ in kept]),
        gold=np.array([t[2] for _, t in kept]),
        rule=np.array([(r.get("rule") or {}).get("relation", "") for r, _ in kept]),
        judge=np.array([(r.get("judge") or {}).get("relation", "") for r, _ in kept]),
        source=np.array([str(meta(r).get("source") or ("synthetic" if r.get("synthetic") else "deployment")) for r, _ in kept]),
        synthetic=True in synth,
        feature_version=versions.pop(),
    )



def feature_names(path: str, version: int, width: int) -> List[str]:
    """FEATURE_NAMES from core, written by scripts/classifier/feature-names.ts; must match the data."""
    with open(path) as f:
        spec = json.load(f)
    if spec["featureVersion"] != version or len(spec["featureNames"]) != width:
        raise SystemExit(f"{path} is for feature version {spec['featureVersion']}; regenerate it (feature-names.ts)")
    return spec["featureNames"]
