// Football-specific team identity lookups (flag codes, 3-letter codes).
// Mirrors the backend's src/sports/football plugin pattern: generic
// display components (Flag.tsx, and anything using teamCode()) take a
// team name string and defer to sport-owned data for how to render it,
// rather than a sport's lookup tables living inline in a "lib/" file that
// implies it's reusable across sports. There's only one sport plugin
// today (football) so nothing here is parameterized by an active-sport
// selector yet -- see PROJECT_BRAIN.md §11 for why that's deliberately
// deferred until a second sport exists.

// Team name -> flag-icons country code (lowercase ISO 3166-1 alpha-2, plus
// flag-icons' extended gb-eng/gb-sct/gb-wls codes), covering the 2026
// World Cup field and common historical opponents from the 2018/2022
// backtest. `null` means "no flag available, show a fallback".
const COUNTRY_CODES: Record<string, string> = {
  Argentina: "ar", Australia: "au", Austria: "at", Belgium: "be",
  "Bosnia & Herzegovina": "ba", "Bosnia and Herzegovina": "ba", Brazil: "br",
  Canada: "ca", "Cape Verde": "cv", Colombia: "co", Croatia: "hr",
  Curacao: "cw", "Curaçao": "cw", "Czech Republic": "cz", Czechia: "cz",
  Denmark: "dk", "DR Congo": "cd", Ecuador: "ec", Egypt: "eg",
  England: "gb-eng", France: "fr", Germany: "de", Ghana: "gh", Haiti: "ht",
  Iceland: "is", "IR Iran": "ir", Iran: "ir", "Ivory Coast": "ci",
  "Côte d'Ivoire": "ci", Japan: "jp", Jordan: "jo", "South Korea": "kr",
  "Korea Republic": "kr", Mexico: "mx", Morocco: "ma", Netherlands: "nl",
  "New Zealand": "nz", Norway: "no", Panama: "pa", Paraguay: "py", Peru: "pe",
  Poland: "pl", Portugal: "pt", Qatar: "qa", "Saudi Arabia": "sa",
  Scotland: "gb-sct", Senegal: "sn", Serbia: "rs", "South Africa": "za",
  Spain: "es", Sweden: "se", Switzerland: "ch", Tunisia: "tn", Turkey: "tr",
  Türkiye: "tr", Ukraine: "ua", "United States": "us", USA: "us",
  Uruguay: "uy", Uzbekistan: "uz", Wales: "gb-wls", Algeria: "dz",
  Russia: "ru", "Costa Rica": "cr", Nigeria: "ng", Cameroon: "cm",
  Chile: "cl",
};

export function countryCodeFor(team: string): string | null {
  return COUNTRY_CODES[team] ?? null;
}

const TEAM_CODES: Record<string, string> = {
  Argentina: "ARG", France: "FRA", Spain: "ESP", Brazil: "BRA", Colombia: "COL",
  England: "ENG", Portugal: "POR", Mexico: "MEX", "United States": "USA", Morocco: "MAR",
  Norway: "NOR", Belgium: "BEL", Switzerland: "SUI", Ghana: "GHA", Canada: "CAN",
  Paraguay: "PAR", Egypt: "EGY", Croatia: "CRO", Germany: "GER", Netherlands: "NED",
  Italy: "ITA", Uruguay: "URU", "South Africa": "RSA", Senegal: "SEN",
  "Ivory Coast": "CIV", Sweden: "SWE", Japan: "JPN", Austria: "AUT", Algeria: "ALG",
  "Cape Verde": "CPV", "Bosnia and Herzegovina": "BIH", "DR Congo": "COD", Ecuador: "ECU",
};

export function teamCode(name: string): string {
  return TEAM_CODES[name] ?? name.slice(0, 3).toUpperCase();
}
