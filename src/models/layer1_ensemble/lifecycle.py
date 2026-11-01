"""Local, trusted-operator model governance. No network or training on load.

SQLite serializes approval updates; content hashes identify trusted local pickle
artifacts. Neither the database nor hashes authenticate a malicious operator.
"""

import hashlib
import importlib.metadata
import json
import os
import pickle
import platform
import sqlite3
import tempfile
from dataclasses import asdict
from datetime import date, datetime, timezone
from pathlib import Path

import numpy as np

from src.features.data_loading import Match
from src.features.team_timeline import build_timelines
from src.models.layer1_ensemble.features import FEATURE_NAMES, build_feature_row

ROOT = Path(__file__).resolve().parents[3] / "data" / "model_lifecycle"
POLICY = "strict-logloss-and-brier-v1"
HISTORY_START = date(1992, 1, 1)


class GovernanceError(ValueError):
    pass


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def code_identity():
    repo = Path(__file__).resolve().parents[3]
    return {
        name: hashlib.sha256((repo / name).read_bytes()).hexdigest()
        for name in (
            "src/models/layer1_ensemble/ensemble.py",
            "src/models/layer1_ensemble/features.py",
            "src/models/layer1_ensemble/lifecycle.py",
            "src/features/team_timeline.py",
            "src/features/rankings.py",
        )
    }


def match_records(matches):
    records, seen = [], {}
    for match in sorted(matches, key=lambda m: (m.date, m.home_team, m.away_team)):
        key = (match.date, *sorted((match.home_team, match.away_team)))
        row = asdict(match)
        row["date"] = match.date.isoformat()
        if key in seen:
            if seen[key] != row:
                raise GovernanceError("Conflicting match identity")
            continue
        seen[key] = row
        records.append(row)
    return records


def clean_matches(matches):
    """Collapse identical rows, reject conflicting identities; preserve raw CSV."""
    return [
        Match(**{**r, "date": date.fromisoformat(r["date"])})
        for r in match_records(matches)
    ]


def governance_history(matches):
    """Explicit bounded feature-history policy, matching the training era.

    Pre-1992 historical identity conflicts remain unresolved, not repaired or
    silently interpreted as one fixture. Raw source CSVs are preserved.
    """
    return clean_matches([m for m in matches if m.date >= HISTORY_START])


def ranking_history(rankings, cutoff):
    return {
        t: [(d.isoformat(), p) for d, p in rows if d < cutoff]
        for t, rows in rankings.items()
        if any(d < cutoff for d, _ in rows)
    }


class ModelStore:
    def __init__(self, root=None):
        self.root = Path(root or os.environ.get("WC26_MODEL_STORE", ROOT))
        self.root.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS candidates (
                    id TEXT PRIMARY KEY, manifest TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS events (
                    generation INTEGER PRIMARY KEY AUTOINCREMENT,
                    model_id TEXT NOT NULL, action TEXT NOT NULL,
                    actor TEXT NOT NULL, reason TEXT NOT NULL,
                    report TEXT NOT NULL, at TEXT NOT NULL);
            """)

    def connect(self):
        return sqlite3.connect(self.root / "governance.sqlite", timeout=5)

    def active(self):
        with self.connect() as db:
            row = db.execute(
                "SELECT generation,model_id FROM events ORDER BY generation DESC LIMIT 1"
            ).fetchone()
        return (
            {"generation": row[0], "model_id": row[1]}
            if row
            else {"generation": 0, "model_id": None}
        )

    def register(self, ensemble, *, train_start, train_end, matches, source_sha):
        """Producer contract: caller must train only on [start, end).

        The official CLI below constructs the model and cutoff together. This
        API is not a sandbox for untrusted model producers or pickle inputs.
        """
        if (
            not train_start < train_end
            or len(source_sha) != 40
            or any(c not in "0123456789abcdef" for c in source_sha)
        ):
            raise GovernanceError("Invalid training window or source SHA")
        records = match_records(matches)
        input_duplicates_removed = len(matches) - len(records)
        matches = clean_matches(matches)
        training = [
            r
            for r in records
            if train_start.isoformat() <= r["date"] < train_end.isoformat()
        ]
        if not training:
            raise GovernanceError("Empty training population")
        if list(ensemble.stack.classes_) != [0, 1, 2]:
            raise GovernanceError("Expected loss/draw/win class order")
        payload = pickle.dumps(ensemble, protocol=5)
        artifact_hash = hashlib.sha256(payload).hexdigest()
        manifest = {
            "schema": 1,
            "artifact_sha256": artifact_hash,
            "source_sha": source_sha,
            "train_start": train_start.isoformat(),
            "train_end_exclusive": train_end.isoformat(),
            "training_matches": len(training),
            "training_data_sha256": digest(training),
            "features": FEATURE_NAMES,
            "feature_history_sha256": digest(
                [r for r in records if r["date"] < train_end.isoformat()]
            ),
            "ranking_history_sha256": digest(
                ranking_history(getattr(ensemble, "rankings", {}), train_end)
            ),
            "history_policy": "1992+ in official producer; exact duplicates collapsed, conflicts rejected",
            "python_version": platform.python_version(),
            "input_duplicates_removed": input_duplicates_removed,
            "code_sha256": code_identity(),
            "classes": [0, 1, 2],
            "runtime": {
                name: importlib.metadata.version(name)
                for name in ("numpy", "scikit-learn", "xgboost")
            },
        }
        model_id = digest(manifest)
        target = self.root / f"{artifact_hash}.pkl"
        if not target.exists():
            fd, temp = tempfile.mkstemp(dir=self.root, suffix=".tmp")
            try:
                with os.fdopen(fd, "wb") as f:
                    f.write(payload)
                    f.flush()
                    os.fsync(f.fileno())
                os.replace(temp, target)
            finally:
                if os.path.exists(temp):
                    os.unlink(temp)
        elif hashlib.sha256(target.read_bytes()).hexdigest() != artifact_hash:
            raise GovernanceError("Existing artifact corrupted")
        with self.connect() as db:
            db.execute(
                "INSERT OR IGNORE INTO candidates VALUES (?,?)",
                (model_id, canonical(manifest)),
            )
        return model_id

    def load(self, model_id):
        with self.connect() as db:
            row = db.execute(
                "SELECT manifest FROM candidates WHERE id=?", (model_id,)
            ).fetchone()
        if row is None:
            raise GovernanceError("Unknown candidate")
        manifest = json.loads(row[0])
        if (
            digest(manifest) != model_id
            or manifest["features"] != FEATURE_NAMES
            or manifest["classes"] != [0, 1, 2]
        ):
            raise GovernanceError("Manifest identity or feature contract mismatch")
        if manifest["code_sha256"] != code_identity():
            raise GovernanceError(
                "Feature/model implementation changed; reevaluation required"
            )
        if manifest["python_version"] != platform.python_version():
            raise GovernanceError("Python runtime changed; rebuild and reevaluate")
        for name, version in manifest["runtime"].items():
            if importlib.metadata.version(name) != version:
                raise GovernanceError(f"Runtime mismatch: {name}")
        payload = (self.root / f"{manifest['artifact_sha256']}.pkl").read_bytes()
        if hashlib.sha256(payload).hexdigest() != manifest["artifact_sha256"]:
            raise GovernanceError("Artifact hash mismatch")
        model = pickle.loads(
            payload
        )  # trusted local operator only, after integrity check
        if list(model.stack.classes_) != manifest["classes"]:
            raise GovernanceError("Loaded class contract mismatch")
        return model, manifest

    def load_approved(self):
        state = self.active()
        if state["model_id"] is None:
            raise GovernanceError(
                "No approved model; explicitly evaluate/bootstrap a candidate first"
            )
        model, manifest = self.load(state["model_id"])
        return model, {**state, **manifest}

    def _commit(self, model_id, action, actor, reason, report, expected_generation):
        if not actor.strip() or not reason.strip():
            raise GovernanceError("Operator and reason required")
        # Loading before transaction rejects missing/corrupt rollback targets.
        self.load(model_id)
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute(
                "SELECT generation FROM events ORDER BY generation DESC LIMIT 1"
            ).fetchone()
            if (row[0] if row else 0) != expected_generation:
                raise GovernanceError(
                    "Stale incumbent; reevaluate against current approval"
                )
            if (
                action == "rollback"
                and not db.execute(
                    "SELECT 1 FROM events WHERE model_id=?", (model_id,)
                ).fetchone()
            ):
                raise GovernanceError(
                    "Rollback requires a previously approved artifact"
                )
            db.execute(
                "INSERT INTO events(model_id,action,actor,reason,report,at) VALUES (?,?,?,?,?,?)",
                (
                    model_id,
                    action,
                    actor,
                    reason,
                    canonical(report),
                    datetime.now(timezone.utc).isoformat(),
                ),
            )

    def rollback(self, model_id, *, actor, reason, expected_generation):
        self._commit(model_id, "rollback", actor, reason, {}, expected_generation)
        return self.active()

    def evaluate(
        self,
        candidate_id,
        *,
        matches,
        rankings,
        start,
        end,
        actor,
        reason,
        approve=False,
        bootstrap=False,
    ):
        """Compute paired metrics in-process, never approve caller-supplied metrics."""
        state = self.active()
        if not start < end:
            raise GovernanceError("Invalid selection interval")
        records = match_records(matches)
        input_duplicates_removed = len(matches) - len(records)
        matches = clean_matches(matches)
        # Verify the complete input identity, not only the selected matches.
        history_hash = digest(records)
        selected = [
            m for m in sorted(matches, key=lambda m: m.date) if start <= m.date < end
        ]
        if len(selected) < 30:
            raise GovernanceError("Selection requires at least 30 distinct matches")
        timeline = build_timelines(sorted(matches, key=lambda m: m.date))
        X = np.asarray(
            [
                build_feature_row(
                    m.home_team, m.away_team, m.date, timeline, rankings, m.neutral
                )
                for m in selected
            ]
        )
        y = np.asarray(
            [
                2
                if m.home_score > m.away_score
                else 0
                if m.home_score < m.away_score
                else 1
                for m in selected
            ]
        )
        if not np.isfinite(X).all():
            raise GovernanceError("Non-finite evaluation features")

        def score(model_id):
            model, manifest = self.load(model_id)
            if date.fromisoformat(manifest["train_end_exclusive"]) > start:
                raise GovernanceError("Training overlaps selection interval")
            training = [
                r
                for r in records
                if manifest["train_start"]
                <= r["date"]
                < manifest["train_end_exclusive"]
            ]
            if digest(training) != manifest["training_data_sha256"]:
                raise GovernanceError(
                    "Training history changed since artifact creation"
                )
            if (
                digest(
                    [r for r in records if r["date"] < manifest["train_end_exclusive"]]
                )
                != manifest["feature_history_sha256"]
            ):
                raise GovernanceError("Feature history changed since artifact creation")
            if (
                digest(
                    ranking_history(
                        rankings, date.fromisoformat(manifest["train_end_exclusive"])
                    )
                )
                != manifest["ranking_history_sha256"]
            ):
                raise GovernanceError(
                    "Historical rankings changed since artifact creation"
                )
            p = np.asarray(model.stack.predict_proba(X), dtype=float)
            if (
                p.shape != (len(y), 3)
                or not np.isfinite(p).all()
                or (p < 0).any()
                or (p > 1).any()
                or not np.allclose(p.sum(axis=1), 1, rtol=0, atol=1e-7)
            ):
                raise GovernanceError("Invalid prediction probabilities")
            return {
                "log_loss": float(
                    -np.log(np.clip(p[np.arange(len(y)), y], 1e-15, 1)).mean()
                ),
                "brier": float(np.square(p - np.eye(3)[y]).sum(axis=1).mean()),
                "predictions_sha256": digest(p.tolist()),
            }

        candidate = score(candidate_id)
        incumbent = score(state["model_id"]) if state["model_id"] else None
        accepted = (bootstrap and incumbent is None) or (
            incumbent is not None
            and all(candidate[k] < incumbent[k] for k in ("log_loss", "brier"))
        )
        report = {
            "policy": POLICY,
            "candidate_id": candidate_id,
            "incumbent": state,
            "start": start.isoformat(),
            "end_exclusive": end.isoformat(),
            "n_matches": len(y),
            "input_duplicates_removed": input_duplicates_removed,
            "history_sha256": history_hash,
            "rankings_sha256": digest(
                {
                    t: [(d.isoformat(), p) for d, p in rows]
                    for t, rows in rankings.items()
                }
            ),
            "selection_sha256": digest(
                [r for r in records if start.isoformat() <= r["date"] < end.isoformat()]
            ),
            "candidate": candidate,
            "incumbent_metrics": incumbent,
            "eligible": bool(accepted),
            "approved": False,
            "scope": "Chronological operational selection; not an unbiased final accuracy estimate or significance test",
        }
        if approve and accepted:
            self._commit(
                candidate_id,
                "bootstrap" if incumbent is None else "promote",
                actor,
                reason,
                report,
                state["generation"],
            )
            report["approved"] = True
        return report
