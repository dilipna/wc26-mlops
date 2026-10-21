"""CPU-only historical governance rehearsal, not a predictive benchmark.

Train two small real Layer1Ensembles, evaluate a predeclared selection window,
and retain a negative promotion result when the candidate does not win.
"""
import argparse
import json
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.features.data_loading import load_fifa_rankings, load_results
from src.features.team_timeline import build_timelines
from src.models.layer1_ensemble.ensemble import Layer1Ensemble
from src.models.layer1_ensemble.lifecycle import HISTORY_START, ModelStore, governance_history


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    raw = load_results()
    eligible = [m for m in raw if m.date >= HISTORY_START]
    matches = governance_history(raw)
    rankings = load_fifa_rankings()
    start, cutoff, end = date(2015, 1, 1), date(2016, 1, 1), date(2017, 1, 1)
    history = [m for m in matches if m.date < cutoff]
    sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    with tempfile.TemporaryDirectory(prefix='wc26-governance-') as temp:
        store = ModelStore(temp)
        ids = []
        for depth in (2, 1):
            ensemble = Layer1Ensemble(history, build_timelines(history), rankings,
                                      start, cutoff, xgb_params={'n_estimators': 8, 'max_depth': depth, 'n_jobs': 1})
            ids.append(store.register(ensemble, train_start=start, train_end=cutoff,
                                      matches=history, source_sha=sha))
        bootstrap = store.evaluate(ids[0], matches=eligible, rankings=rankings, start=cutoff,
                                    end=end, actor='local-rehearsal', reason='explicit CPU rehearsal bootstrap',
                                    bootstrap=True, approve=True)
        comparison = store.evaluate(ids[1], matches=eligible, rankings=rankings, start=cutoff,
                                     end=end, actor='local-rehearsal', reason='predeclared depth-1 candidate', approve=True)
        # Actual deserialization from a separate interpreter with registry offline.
        script = "from src.models.layer1_ensemble.lifecycle import ModelStore; import sys,json; m,i=ModelStore(sys.argv[1]).load_approved(); print(json.dumps({'model_id':i['model_id'],'classes':m.stack.classes_.tolist()}))"
        restarted = json.loads(subprocess.check_output([sys.executable, '-c', script, temp], text=True))
        assert restarted['model_id'] == store.active()['model_id']
        if comparison['approved']:
            store.rollback(ids[0], actor='local-rehearsal', reason='exact-artifact rollback rehearsal',
                           expected_generation=store.active()['generation'])
        else:
            assert store.active()['model_id'] == ids[0]
        loaded, manifest = store.load_approved()
        assert manifest['model_id'] == ids[0]
        report = {
            'source_sha': sha, 'raw_matches': len(raw), 'normalized_matches': len(matches),
            'history_start': HISTORY_START.isoformat(), 'pre1992_rows_out_of_scope': len(raw)-len(eligible),
            'exact_duplicate_rows_removed': len(eligible)-len(matches),
            'train_start': start.isoformat(), 'train_end_exclusive': cutoff.isoformat(),
            'selection_end_exclusive': end.isoformat(),
            'configuration': {'n_estimators':8, 'max_depth_incumbent':2, 'max_depth_candidate':1, 'n_jobs':1},
            'bootstrap': bootstrap, 'comparison': comparison, 'separate_process_reload': restarted,
            'final_approved_id': manifest['model_id'],
            'limits': ['Retrospective historical rehearsal; not a new untouched forecasting benchmark',
                       'Small CPU configuration validates the lifecycle, not tuned predictive quality',
                       'Default StackingClassifier CV remains non-temporal; no unbiased model-selection claim',
                       'No cloud, MLflow service, live API or deployment exercised'],
        }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
