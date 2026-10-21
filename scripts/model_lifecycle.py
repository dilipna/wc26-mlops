"""Explicit local training/evaluation/approval/rollback. No cloud calls."""
import argparse
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.features.data_loading import load_fifa_rankings, load_results
from src.features.team_timeline import build_timelines
from src.models.layer1_ensemble.ensemble import Layer1Ensemble
from src.models.layer1_ensemble.lifecycle import ModelStore, governance_history


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--store', type=Path)
    sub = parser.add_subparsers(dest='command', required=True)
    train = sub.add_parser('train')
    train.add_argument('--start', type=date.fromisoformat, required=True)
    train.add_argument('--end', type=date.fromisoformat, required=True)
    evaluate = sub.add_parser('evaluate')
    evaluate.add_argument('candidate')
    evaluate.add_argument('--start', type=date.fromisoformat, required=True)
    evaluate.add_argument('--end', type=date.fromisoformat, required=True)
    evaluate.add_argument('--approve', action='store_true')
    evaluate.add_argument('--bootstrap', action='store_true')
    evaluate.add_argument('--actor', required=True)
    evaluate.add_argument('--reason', required=True)
    rollback = sub.add_parser('rollback')
    rollback.add_argument('model_id')
    rollback.add_argument('--expected-generation', type=int, required=True)
    rollback.add_argument('--actor', required=True)
    rollback.add_argument('--reason', required=True)
    sub.add_parser('status')
    args = parser.parse_args()
    store = ModelStore(args.store)
    if args.command == 'status':
        result = store.active()
    elif args.command == 'rollback':
        result = store.rollback(args.model_id, actor=args.actor, reason=args.reason, expected_generation=args.expected_generation)
    else:
        matches, rankings = governance_history(load_results()), load_fifa_rankings()
        if args.command == 'train':
            history = [m for m in matches if m.date < args.end]
            ensemble = Layer1Ensemble(history, build_timelines(history), rankings, args.start, args.end)
            sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
            result = {'candidate_id': store.register(ensemble, train_start=args.start, train_end=args.end, matches=history, source_sha=sha)}
        else:
            result = store.evaluate(args.candidate, matches=matches, rankings=rankings,
                                    start=args.start, end=args.end, actor=args.actor,
                                    reason=args.reason, approve=args.approve, bootstrap=args.bootstrap)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
