"""Data-quality checks over the match data feeding Layer 1 training:
missing values, schema conformance, and duplicate/overlap detection.

Real checks over real data (not a placeholder for the admin dashboard's
Data Quality section). `historical_live_overlap` in particular exists
because of a real incident: `data/historical/results.csv` is periodically
refreshed upstream and had already absorbed 74 of 87 real 2026 matches this
project's own live ingestion log also tracked, double-counting Elo/training
rows until `live_results_store.load_combined_matches()`'s dedup fixed it
(see PROJECT_BRAIN.md, DECISIONS.md, 2026-07-04). This check reports that
overlap on every run so a regression in the dedup logic -- or a future
change to how the historical CSV is refreshed -- would show up here
instead of silently reintroducing inflated ratings.
"""

from __future__ import annotations

import pandas as pd

from src.features.data_loading import Match

EXPECTED_SCHEMA: dict[str, str] = {
    "date": "object",
    "home_team": "object",
    "away_team": "object",
    "home_score": "int64",
    "away_score": "int64",
    "tournament": "object",
    "neutral": "bool",
}


def matches_to_frame(matches: list[Match]) -> pd.DataFrame:
    return pd.DataFrame([m.__dict__ for m in matches])


def missing_value_report(df: pd.DataFrame) -> dict[str, dict]:
    total = len(df)
    return {
        col: {
            "missing": int(df[col].isna().sum()),
            "total": total,
            "pct": round(float(df[col].isna().sum()) / total, 4) if total else 0.0,
        }
        for col in df.columns
    }


def schema_report(df: pd.DataFrame, expected: dict[str, str] = EXPECTED_SCHEMA) -> dict:
    columns_present = {col: col in df.columns for col in expected}
    dtype_mismatches = {
        col: {"expected": expected_dtype, "actual": str(df[col].dtype)}
        for col, expected_dtype in expected.items()
        if col in df.columns and str(df[col].dtype) != expected_dtype
    }
    return {
        "columns_present": columns_present,
        "dtype_mismatches": dtype_mismatches,
        "extra_columns": [c for c in df.columns if c not in expected],
        "valid": all(columns_present.values()) and not dtype_mismatches,
    }


def duplicate_report(df: pd.DataFrame, key_cols: tuple[str, ...] = ("date", "home_team", "away_team")) -> dict:
    dup_mask = df.duplicated(subset=list(key_cols), keep=False)
    return {
        "duplicate_rows": int(dup_mask.sum()),
        "duplicate_keys": int(df.loc[dup_mask, list(key_cols)].drop_duplicates().shape[0]),
        "total_rows": len(df),
    }


def historical_live_overlap(historical: list[Match], live: list[Match]) -> dict:
    hist_keys = {(m.date, m.home_team, m.away_team) for m in historical}
    live_keys = {(m.date, m.home_team, m.away_team) for m in live}
    return {
        "historical_count": len(historical),
        "live_count": len(live),
        "overlap_count": len(hist_keys & live_keys),
    }


def build_report(historical: list[Match], live: list[Match]) -> dict:
    combined_df = matches_to_frame(historical + live)
    return {
        "missing_values": missing_value_report(combined_df),
        "schema": schema_report(combined_df),
        "duplicates_before_dedup": duplicate_report(combined_df),
        "historical_live_overlap": historical_live_overlap(historical, live),
    }
