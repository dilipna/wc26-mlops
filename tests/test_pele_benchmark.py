from datetime import date, datetime, timezone

import pytest

from src.benchmarks import pele
from src.benchmarks.scoring import brier, log_loss, outcome_index, paired_comparison, reliability, rps

TSV = (
    "date\tfifa_code\tprob_win\tproj_gf\tfifa_code_opp\tprob_loss\tproj_gf_opp\tprob_draw\tmodal_score\tcomp_tier\tnotes\n"
    "June 11 🏆@@24268\t:mx: MEX 🏡\t78.6\t2.3\t:za: RSA\t4.0\t0.3\t17.3\t1-0\t9\tFIFA 2026 World Cup: Group Stage\n"
    "June 12@@24269\t:ee: EST\t40\t1.1\t:lv: LVA\t30\t1.0\t30\t0-0\t5\tBaltic Cup\n"
)
CSV_ADVANCE = (
    "date,fifa_code,prob_win,proj_gf,fifa_code_opp,prob_loss,proj_gf_opp,prob_draw,modal_score,comp_tier,notes,game_lat\n"
    "July 3 🏆@@24290,:co: COL,86.1,2.3,:gh: GHA,13.9,0.5,,1-0,9,World Cup Round of 32,37.3\n"
)
T0 = datetime(2026, 6, 1, tzinfo=timezone.utc)


def test_parses_both_delimiters_keeps_only_world_cup_rows():
    group = pele.parse_match_rows(pele.read_rows("﻿" + TSV), 1, T0)
    assert len(group) == 1  # Baltic Cup row dropped
    f = group[0]
    assert (f.team_a, f.team_b, f.stage, f.fmt) == ("Mexico", "South Africa", "group", "three_way")
    assert f.local_date == date(2026, 6, 11)
    assert f.p_a == pytest.approx(0.786) and f.p_draw == pytest.approx(0.173)

    (ko,) = pele.parse_match_rows(pele.read_rows(CSV_ADVANCE), 2, T0)
    assert ko.fmt == "advance" and ko.p_draw is None and ko.stage == "R32"


def test_unmapped_world_cup_team_fails_loudly():
    bad = TSV.replace(":za: RSA", ":xx: ZZZ")
    with pytest.raises(ValueError):
        pele.parse_match_rows(pele.read_rows(bad), 1, T0)


def _fc(version, published, p_a=0.5):
    return pele.PeleForecast(version, published, date(2026, 7, 19), "F", "Spain", "Argentina",
                             "three_way", p_a, 0.3, 0.7 - p_a, 1.3, 1.3)


def test_selection_never_uses_a_version_published_after_kickoff():
    kickoff = datetime(2026, 7, 19, 19, tzinfo=timezone.utc)
    forecasts = [
        _fc(10, datetime(2026, 7, 18, 12, tzinfo=timezone.utc), 0.30),
        _fc(11, datetime(2026, 7, 19, 14, tzinfo=timezone.utc), 0.37),
        _fc(12, datetime(2026, 7, 19, 21, tzinfo=timezone.utc), 0.99),  # post-kickoff revision
    ]
    chosen = pele.latest_pre_kickoff(forecasts, "Argentina", "Spain", date(2026, 7, 19), kickoff)
    assert chosen.version == 11
    assert pele.oriented(chosen, "Argentina") == pytest.approx((0.33, 0.3, 0.37))


def test_scoring_rules_known_values():
    assert outcome_index(2, 1) == 0 and outcome_index(1, 1) == 1 and outcome_index(0, 3) == 2
    perfect = (1.0, 0.0, 0.0)
    assert rps(perfect, 0) == 0 and brier(perfect, 0) == 0
    # RPS is ordinal: predicting a draw for a home win costs less than an away win.
    assert rps((0, 1, 0), 0) < rps((0, 0, 1), 0)
    assert rps((0, 0, 1), 0) == pytest.approx(1.0)
    assert log_loss((0.5, 0.25, 0.25), 0) == pytest.approx(0.6931, abs=1e-4)


def test_paired_comparison_detects_a_real_gap_and_not_noise():
    better = [0.10] * 60
    worse = [0.20] * 60
    res = paired_comparison(better, worse, n_boot=2000)
    assert res["mean_diff"] == pytest.approx(-0.10) and res["p_value"] < 0.01
    noise = paired_comparison([0.1, 0.2] * 30, [0.2, 0.1] * 30, n_boot=2000)
    assert noise["p_value"] > 0.5


def test_reliability_bins_and_ece():
    rel = reliability([(0.1, 0), (0.1, 0), (0.9, 1), (0.9, 1)], n_bins=5)
    assert rel["ece"] == pytest.approx(0.1)
    assert [b["n"] for b in rel["bins"]] == [2, 2]
