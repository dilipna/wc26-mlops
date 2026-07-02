"""Reconstructs the actual knockout bracket (who plays whom, and how
round-N winners feed round-N+1 matches) directly from real match results,
for a 32-team, direct-to-Round-of-16 World Cup (2018, 2022 format).

No hand-typed groups or seeding rules needed: the real R16/QF/SF/Final
fixture lists themselves fully determine the bracket tree bottom-up.
"""

from dataclasses import dataclass

from src.features.data_loading import Match

ROUND_ORDER = ["R16", "QF", "SF", "F"]


@dataclass
class BracketMatch:
    teams: tuple[str, str] | None  # set only for the opening round (R16)
    children: tuple[int, int] | None  # indices into the previous round's matches


@dataclass
class Bracket:
    rounds: dict  # round_name -> list[BracketMatch]
    winners: dict  # round_name -> list[str], the ACTUAL winner of each match
    round_start_date: dict  # round_name -> date of that round's first real match
    champion: str


def _winner_of(m: Match, shootouts: dict) -> str:
    if m.home_score != m.away_score:
        return m.home_team if m.home_score > m.away_score else m.away_team
    w = shootouts.get((m.date, m.home_team, m.away_team))
    if w is None:
        raise ValueError(f"Drawn match with no shootout record: {m}")
    return w


def build_bracket(wc_matches: list[Match], shootouts: dict) -> Bracket:
    matches = sorted(wc_matches, key=lambda m: m.date)
    if len(matches) != 64:
        raise ValueError(f"Expected 64 World Cup matches, got {len(matches)}")

    r16, qf, sf = matches[48:56], matches[56:60], matches[60:62]
    final = matches[63:64]  # matches[62] is the 3rd-place playoff, unused

    rounds: dict[str, list[BracketMatch]] = {"R16": [], "QF": [], "SF": [], "F": []}
    winners: dict[str, list[str]] = {}
    round_start_date = {}

    rounds["R16"] = [BracketMatch(teams=(m.home_team, m.away_team), children=None) for m in r16]
    winners["R16"] = [_winner_of(m, shootouts) for m in r16]
    round_start_date["R16"] = r16[0].date

    def link_round(round_name, round_matches, prev_round_name):
        prev_winners = winners[prev_round_name]
        links = []
        for m in round_matches:
            i = prev_winners.index(m.home_team)
            j = prev_winners.index(m.away_team)
            links.append(BracketMatch(teams=None, children=(i, j)))
        rounds[round_name] = links
        winners[round_name] = [_winner_of(m, shootouts) for m in round_matches]
        round_start_date[round_name] = round_matches[0].date

    link_round("QF", qf, "R16")
    link_round("SF", sf, "QF")
    link_round("F", final, "SF")

    return Bracket(
        rounds=rounds,
        winners=winners,
        round_start_date=round_start_date,
        champion=winners["F"][0],
    )
