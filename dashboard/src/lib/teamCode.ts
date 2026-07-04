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
