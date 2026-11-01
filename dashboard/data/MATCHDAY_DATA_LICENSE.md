# Matchday source-data attribution

`matchday-seed.json` is a collection of normalized source snapshots, not a new live feed. Each feed records its provider, original source URLs, UTC date and actual retrieval timestamp. Normalization selects factual event fields, strips markup, validates identity/date/status and caps free-tier event counts.

TheSportsDB portions: data obtained through its free development API, subject to https://www.thesportsdb.com/docs_terms_of_use.php . No third-party player photographs, badges or other artwork are included. No broader artwork license is claimed.

Jolpica-F1 portions (`provider: Jolpica-F1`): https://api.jolpi.ca/ergast/f1/ , licensed for non-commercial use under CC BY-NC-SA 4.0, https://creativecommons.org/licenses/by-nc-sa/4.0/ . Changes: normalization into matchday event records and selection of schedule/classification fields. These adapted data portions retain the same license. The surrounding application source does not relicense upstream data. Terms: https://github.com/jolpica/jolpica-f1/blob/main/TERMS.md .

Source accuracy, coverage and availability are not guaranteed. See docs/matchday-platform.md for cache/fallback boundaries.
