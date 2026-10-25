"""The citable results file: dataset counts, per-relation metrics against baselines, settle rates, curves."""
from __future__ import annotations

import json
from collections import Counter
from typing import Dict, List, Optional

import numpy as np

from .report import per_relation


def kind_pairs(X: np.ndarray, names: List[str]) -> np.ndarray:
    col = {n: i for i, n in enumerate(names)}
    kind = lambda x, side: next((k for k in ("intent", "action", "knowledge") if x[col[f"{side}_{k}"]] == 1), "action")
    return np.array(["plan" if kind(x, "next") == "intent" else "code" for x in X])


def dataset_counts(ds) -> Dict[str, Dict[str, int]]:
    c: Counter = Counter()
    for y, g, s in zip(ds.y, ds.gold, ds.source):
        c[(s, "gold" if g else "teacher", y)] += 1
    out: Dict[str, Dict[str, int]] = {}
    for (s, kind, y), n in sorted(c.items()):
        out.setdefault(f"{s} ({kind})", {})[y] = n
    return out


def settle_by_relation(settled, open_, pred, y, classes) -> Dict[str, dict]:
    s = settled & open_
    return {
        c: {"settled": int((s & (pred == c)).sum()), "precision": float((y[s & (pred == c)] == c).mean()) if (s & (pred == c)).any() else None}
        for c in classes
    }


def build(ds, names, classes, gold, pred, settled, metrics, curve, prev, rules) -> dict:
    level = kind_pairs(ds.X, names)
    open_ = gold & (ds.rule == "")
    return {
        "version": metrics["version"],
        "synthetic": metrics["synthetic"],
        "rows": metrics["rows"],
        "goldRows": metrics["goldRows"],
        "groups": metrics["groups"],
        "dataset": dataset_counts(ds),
        "perRelation": metrics["perRelation"],
        "perLevel": {lv: per_relation(ds.y[gold & (level == lv)], pred[gold & (level == lv)], classes) for lv in ("plan", "code")},
        "thresholds": metrics["thresholds"],
        "ece": {"raw": metrics["eceRaw"], "calibrated": metrics["eceCalibrated"]},
        "settle": metrics["settle"],
        "settleByRelation": settle_by_relation(settled, open_, pred, ds.y, classes),
        "previous": prev,
        "rulesOnly": rules,
        "learningCurve": curve,
        "candidates": metrics["candidates"],
    }


def _f(v: Optional[float]) -> str:
    return "–" if v is None else f"{v:.2f}"


def markdown(r: dict) -> str:
    prev = r.get("previous") or {}
    pr = prev.get("perRelation", {})
    lines = [
        f"# Pair model {r['version']}",
        "",
        f"{r['rows']} labelled pairs ({r['goldRows']} gold) from {r['groups']} repositories / eval cases. All metrics are out-of-fold "
        "(5 folds grouped by repository or eval case) on gold labels only; teacher labels (weight 0.3) are used for training only.",
        "",
        "## Per relation (gold)",
        "",
        f"| Relation | Support | P | R | F1 | Rules-only F1 | {prev.get('version', 'previous')} F1 | Settle threshold | Settled w/o judge | Settled precision |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for c, m in r["perRelation"].items():
        s = r["settleByRelation"].get(c, {})
        lines.append(
            f"| {c} | {m['support']} | {_f(m['precision'])} | {_f(m['recall'])} | {_f(m['f1'])} | {_f(r['rulesOnly'].get(c, {}).get('f1'))} | "
            f"{_f(pr.get(c, {}).get('f1'))} | {r['thresholds'].get(c, 0):.2f} | {s.get('settled', 0)} | {_f(s.get('precision'))} |"
        )
    st = r["settle"]
    lines += [
        "",
        f"Of {st['pairsReachingModel']} gold pairs no rule settles, the model settles {st['settledByModel']} ({_f(st['settledShare'])}) "
        f"at accuracy {_f(st['settledAccuracy'])}; {prev.get('version', 'the previous model')} settled {_f(prev.get('settledShare'))} "
        f"at {_f(prev.get('settledPrecision'))}. Calibration ECE {_f(r['ece']['raw'])} → {_f(r['ece']['calibrated'])}.",
        "",
        "## Plan-level vs code-level F1",
        "",
        "| Relation | Plan pairs (n) | Plan F1 | Code pairs (n) | Code F1 |",
        "| --- | --- | --- | --- | --- |",
    ]
    for c in r["perRelation"]:
        p, k = r["perLevel"]["plan"].get(c, {}), r["perLevel"]["code"].get(c, {})
        lines.append(f"| {c} | {p.get('support', 0)} | {_f(p.get('f1'))} | {k.get('support', 0)} | {_f(k.get('f1'))} |")
    lines += ["", "## Learning curve (out-of-fold F1 by share of training repositories)", ""]
    fr = list(r["learningCurve"].keys())
    lines += ["| Relation | " + " | ".join(f"{float(x):.0%}" for x in fr) + " |", "| --- |" + " --- |" * len(fr)]
    for c in r["perRelation"]:
        lines.append(f"| {c} | " + " | ".join(_f(r["learningCurve"][x].get(c)) for x in fr) + " |")
    lines += ["", "## Data (rows per source and label kind)", "", "```", json.dumps(r["dataset"], indent=1), "```"]
    return "\n".join(lines)
