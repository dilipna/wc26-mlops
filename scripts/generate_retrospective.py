"""Auto-generated final retrospective PDF, one per completed sport.

Driven by dashboard/public/sports_config.json (the single source of truth
for sport lifecycles): for every sport whose end_date has passed, if
reports/<ID>_Final_Retrospective_<end_date>.pdf doesn't exist yet, build
it from the tamper-evident prediction ledger + the timestamped
predictions log. The daily GitHub Actions workflow runs this after the
ledger build and commits reports/, so the FIFA WC26 PDF appears
automatically on July 19 with zero manual steps.

Run:          python scripts/generate_retrospective.py
Force (test): RETRO_FORCE=1 python scripts/generate_retrospective.py
              (builds even before end_date, into reports/preview/)
"""

import csv
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.backends.backend_pdf import PdfPages  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

SPORTS_CONFIG = ROOT / "dashboard" / "public" / "sports_config.json"
LEDGER_PATH = ROOT / "data" / "proof" / "prediction_ledger.json"
PREDICTIONS_LOG = ROOT / "data" / "predictions" / "predictions_log.csv"
RESULTS_LOG = ROOT / "data" / "live" / "results_log.csv"
REPORTS_DIR = ROOT / "reports"

MODEL_SERIES = "stacked_l2_montecarlo_v1"

# Design tokens (mirrors the dashboard's Section-0 palette)
BG = "#111111"
FG = "#ffffff"
SECONDARY = "#888888"
ACCENT = "#f0c000"
CHART_GOLD = "#b58d00"
MISS = "#922020"

OUTCOME_KEYS = ("home_win", "draw", "away_win")


def _pick_team(pick, home, away):
    return home if pick == "home_win" else away if pick == "away_win" else "Draw"


def _style(ax):
    ax.set_facecolor(BG)
    for spine in ax.spines.values():
        spine.set_color(SECONDARY)
    ax.tick_params(colors=SECONDARY, labelsize=8)
    ax.xaxis.label.set_color(SECONDARY)
    ax.yaxis.label.set_color(SECONDARY)
    ax.title.set_color(FG)


def champion_for(end_date: str) -> str | None:
    if not RESULTS_LOG.exists():
        return None
    with open(RESULTS_LOG, encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f) if r["date"] <= end_date]
    if not rows:
        return None
    last = max(rows, key=lambda r: r["date"])
    if last["date"] != end_date:
        return None
    h, a = int(last["home_score"]), int(last["away_score"])
    return last["home_team"] if h > a else last["away_team"] if a > h else None


def champion_series(team: str) -> list[tuple[str, float]]:
    if not PREDICTIONS_LOG.exists():
        return []
    with open(PREDICTIONS_LOG, encoding="utf-8") as f:
        rows = [
            (r["date"], float(r["win_probability"]))
            for r in csv.DictReader(f)
            if r["team"] == team and r["model_version"] == MODEL_SERIES
        ]
    return sorted(rows)


def calibration(graded: list[dict], n_bins: int = 5) -> list[dict]:
    bins: list[list[bool]] = [[] for _ in range(n_bins)]
    for e in graded:
        p = e["prediction"]["model"][e["prediction"]["model_pick"]]
        bins[min(int(p * n_bins), n_bins - 1)].append(e["grading"]["model_correct"])
    return [
        {
            "label": f"{int(i / n_bins * 100)}-{int((i + 1) / n_bins * 100)}%",
            "mid": (i + 0.5) / n_bins,
            "n": len(b),
            "rate": (sum(b) / len(b)) if b else None,
        }
        for i, b in enumerate(bins)
    ]


def build_pdf(sport: dict, ledger: dict, out_path: Path) -> None:
    s = ledger["summary"]
    graded = [e for e in ledger["entries"] if e["grading"]]
    champion = champion_for(sport["end_date"])
    # Latest graded upset (model right, market wrong) -- same selection
    # rule as the dashboard's SignatureCard, so the PDF and the site
    # feature the same match.
    upsets = [e for e in graded if e["grading"]["model_correct"] and e["grading"]["market_correct"] is False]
    signature = max(upsets, key=lambda e: e["match"]["commence_time"]) if upsets else None

    with PdfPages(out_path) as pdf:
        # ---- Page 1: title + headline numbers ------------------------------
        fig = plt.figure(figsize=(8.5, 11), facecolor=BG)
        fig.text(0.08, 0.90, sport["name"], fontsize=26, color=FG, weight="bold")
        fig.text(0.08, 0.865, "Final Retrospective — model vs market, fully audited", fontsize=12, color=ACCENT)
        fig.text(0.08, 0.835, f"Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} · "
                              f"ledger {ledger['version']} · {ledger['repo']}", fontsize=8, color=SECONDARY)

        lines = [
            ("Champion", champion or "—"),
            ("Predictions in the ledger", f"{s['n_entries']} ({s['n_graded']} graded)"),
            ("Model accuracy vs market", f"{s['model_accuracy']:.0%} vs {s['market_accuracy']:.0%}"),
            ("Avg Brier — model vs market (lower is better)", f"{s['model_avg_brier']} vs {s['market_avg_brier']}"),
            ("Model beat the market on disagreements", f"{s['model_won_disagreements']} of {s['n_disagreements']}"),
            ("Entries with pre-kickoff git provenance", f"{s['n_with_git_provenance']} of {s['n_entries']}"),
        ]
        y = 0.76
        for label, value in lines:
            fig.text(0.08, y, label, fontsize=10, color=SECONDARY)
            fig.text(0.60, y, str(value), fontsize=11, color=FG, weight="bold")
            y -= 0.045

        fig.text(0.08, y - 0.02,
                 "Every number in this report can be independently verified: each prediction was\n"
                 "committed to the public GitHub history before kickoff (SHA + timestamp in the\n"
                 "ledger), the ledger is hash-chained against quiet edits, and the raw logs are in\n"
                 "the repository. See data/proof/prediction_ledger.json — 'how_to_verify'.",
                 fontsize=9, color=SECONDARY, va="top")

        if champion:
            series = champion_series(champion)
            if len(series) >= 2:
                ax = fig.add_axes([0.08, 0.10, 0.84, 0.28])
                _style(ax)
                ax.plot([d[5:] for d, _ in series], [p * 100 for _, p in series],
                        color=CHART_GOLD, linewidth=2, marker="o", markersize=3)
                ax.set_title(f"{champion} — P(champion), day by day", fontsize=11, loc="left")
                ax.set_ylabel("%")
        pdf.savefig(fig, facecolor=BG)
        plt.close(fig)

        # ---- Page 2: signature call case study + calibration ---------------
        fig = plt.figure(figsize=(8.5, 11), facecolor=BG)
        if signature:
            m = signature["match"]
            p = signature["prediction"]
            fig.text(0.08, 0.92, "The signature call", fontsize=18, color=ACCENT, weight="bold")
            fig.text(0.08, 0.885, f"{m['home_team']} vs {m['away_team']} — {m['commence_time'][:10]} — "
                                  f"final score {signature['result']['home_score']}–{signature['result']['away_score']}",
                     fontsize=11, color=FG)
            model_pick = _pick_team(p["model_pick"], m["home_team"], m["away_team"])
            market_pick = _pick_team(p["market_pick"], m["home_team"], m["away_team"])
            fig.text(0.08, 0.855, f"Model said {model_pick} ({p['model'][p['model_pick']]:.0%}) — correct. "
                                  f"Market said {market_pick} ({p['market'][p['market_pick']]:.0%}) — wrong.",
                     fontsize=10, color=SECONDARY)
            if signature.get("provenance"):
                fig.text(0.08, 0.83, f"Public since {signature['provenance']['committed_at']} — commit "
                                     f"{signature['provenance']['first_public_commit'][:12]}",
                         fontsize=9, color=SECONDARY)

            ax = fig.add_axes([0.08, 0.56, 0.84, 0.22])
            _style(ax)
            x = range(3)
            width = 0.35
            labels = [m["home_team"], "Draw", m["away_team"]]
            model_vals = [p["model"][k] * 100 for k in OUTCOME_KEYS]
            market_vals = [p["market"][k] * 100 for k in OUTCOME_KEYS]
            ax.bar([i - width / 2 for i in x], model_vals, width, color=ACCENT, label="Our model")
            ax.bar([i + width / 2 for i in x], market_vals, width, color=SECONDARY, label="Market")
            ax.set_xticks(list(x), labels)
            ax.set_ylabel("%")
            ax.legend(facecolor=BG, labelcolor=FG, edgecolor=SECONDARY, fontsize=8)
            ax.set_title("Pre-kickoff probabilities", fontsize=11, loc="left")

        cal = calibration(graded)
        ax = fig.add_axes([0.08, 0.12, 0.84, 0.32])
        _style(ax)
        xs = [c["label"] for c in cal]
        ax.bar([i - 0.2 for i in range(len(cal))], [c["mid"] * 100 for c in cal], 0.4,
               color=SECONDARY, label="Predicted confidence")
        ax.bar([i + 0.2 for i in range(len(cal))], [(c["rate"] or 0) * 100 for c in cal], 0.4,
               color=ACCENT, label="Actually correct")
        for i, c in enumerate(cal):
            ax.text(i, 2, f"n={c['n']}", ha="center", fontsize=7, color=FG)
        ax.set_xticks(range(len(cal)), xs)
        ax.set_ylabel("%")
        ax.legend(facecolor=BG, labelcolor=FG, edgecolor=SECONDARY, fontsize=8)
        ax.set_title("Calibration — when the model says X%, does it happen X% of the time?", fontsize=11, loc="left")
        pdf.savefig(fig, facecolor=BG)
        plt.close(fig)

        # ---- Page 3+: full prediction table --------------------------------
        per_page = 22
        entries = sorted(ledger["entries"], key=lambda e: e["match"]["commence_time"])
        for start in range(0, len(entries), per_page):
            fig = plt.figure(figsize=(8.5, 11), facecolor=BG)
            fig.text(0.06, 0.94, "Full prediction ledger", fontsize=14, color=FG, weight="bold")
            fig.text(0.06, 0.92, "date · match · our call · market call · result · graded", fontsize=8, color=SECONDARY)
            y = 0.88
            for e in entries[start:start + per_page]:
                m, p = e["match"], e["prediction"]
                our = f"{_pick_team(p['model_pick'], m['home_team'], m['away_team'])} {p['model'][p['model_pick']]:.0%}"
                mkt = (f"{_pick_team(p['market_pick'], m['home_team'], m['away_team'])} "
                       f"{p['market'][p['market_pick']]:.0%}") if p["market"] else "—"
                res = f"{e['result']['home_score']}–{e['result']['away_score']}" if e["result"] else "pending"
                if e["grading"]:
                    ok = e["grading"]["model_correct"]
                    grade, color = ("model ✓" if ok else "model ✗"), (ACCENT if ok else MISS)
                else:
                    grade, color = "", SECONDARY
                fig.text(0.06, y, m["commence_time"][:10], fontsize=8, color=SECONDARY)
                fig.text(0.17, y, f"{m['home_team']} v {m['away_team']}", fontsize=8, color=FG)
                fig.text(0.45, y, our, fontsize=8, color=ACCENT)
                fig.text(0.63, y, mkt, fontsize=8, color=SECONDARY)
                fig.text(0.80, y, res, fontsize=8, color=FG)
                fig.text(0.88, y, grade, fontsize=8, color=color)
                y -= 0.035
            pdf.savefig(fig, facecolor=BG)
            plt.close(fig)


def main():
    force = os.environ.get("RETRO_FORCE") == "1"
    today = datetime.now(timezone.utc).date().isoformat()
    config = json.loads(SPORTS_CONFIG.read_text(encoding="utf-8"))
    if not LEDGER_PATH.exists():
        print("[retrospective] no prediction ledger yet -- nothing to do")
        return
    ledger = json.loads(LEDGER_PATH.read_text(encoding="utf-8"))

    for sport in config["sports"]:
        end_date = sport.get("end_date")
        if not end_date:
            continue
        if today < end_date and not force:
            print(f"[retrospective] {sport['id']}: season ends {end_date}, not yet -- skipping")
            continue
        out_dir = REPORTS_DIR / "preview" if (force and today < end_date) else REPORTS_DIR
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{sport['id'].upper()}_Final_Retrospective_{end_date}.pdf"
        if out_path.exists() and not force:
            print(f"[retrospective] {out_path.name} already exists -- skipping")
            continue
        build_pdf(sport, ledger, out_path)
        print(f"[retrospective] wrote {out_path}")


if __name__ == "__main__":
    main()
