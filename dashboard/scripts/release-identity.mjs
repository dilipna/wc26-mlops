import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const project = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repo = path.resolve(project, "..");
const hosted =
  process.env.VERCEL === "1" || process.env.GITHUB_ACTIONS === "true";
const hash = (b) => createHash("sha256").update(b).digest("hex");
let sha = null,
  dirty = null;
try {
  sha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repo,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  dirty = Boolean(
    execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], {
      cwd: repo,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim(),
  );
  const locked = execFileSync(
    "git",
    ["show", "HEAD:dashboard/package-lock.json"],
    { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  if (
    hosted &&
    JSON.stringify(JSON.parse(locked)) !==
      JSON.stringify(
        JSON.parse(
          fs.readFileSync(path.join(project, "package-lock.json"), "utf8"),
        ),
      )
  )
    throw Error(
      "Hosted dependency install changed the committed lock. Use npm ci.",
    );
} catch (error) {
  if (hosted && error.message?.includes("committed lock")) throw error;
}
if (process.env.VERCEL_GIT_COMMIT_SHA) {
  if (sha && sha !== process.env.VERCEL_GIT_COMMIT_SHA)
    throw Error("Hosting source commit mismatch");
  sha = process.env.VERCEL_GIT_COMMIT_SHA;
}
if (!sha || !/^([a-f0-9]{40})$/.test(sha))
  throw Error("A real source commit is required");
if (hosted && dirty === true)
  throw Error("Hosted build contains uncommitted source changes");
const files = {};
function visit(rel) {
  const full = path.join(repo, rel);
  const stat = fs.lstatSync(full);
  if (stat.isSymbolicLink()) throw Error("Unexpected source symlink: " + rel);
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(full).sort())
      if (!["node_modules", ".next", "__pycache__"].includes(child))
        visit(rel + "/" + child);
  } else if (
    /\.(?:ts|tsx|js|mjs|css|json|py|md|csv|txt|woff2|yml|yaml)$/.test(rel)
  ) {
    const bytes = fs.readFileSync(full);
    files[rel] = hash(
      rel.endsWith(".woff2")
        ? bytes
        : Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n")),
    );
  }
}
for (const rel of [
  "dashboard/src",
  "dashboard/data",
  "dashboard/public/replays",
  "dashboard/public/proof",
  "dashboard/public/fonts",
  "dashboard/scripts",
  "dashboard/e2e",
  "tests",
  ".github/workflows",
  "src",
  "scripts",
  "data/multisport",
  "docs",
])
  visit(rel);
for (const rel of [
  "dashboard/package.json",
  "dashboard/package-lock.json",
  "dashboard/next.config.ts",
  "dashboard/vercel.json",
])
  visit(rel);
const cards = JSON.parse(
  fs.readFileSync(path.join(project, "data/sport_replays.json"), "utf8"),
);
for (const card of cards) {
  if (!["basketball", "nfl", "cricket"].includes(card.sport))
    throw Error("Unknown sport artifact");
  const bytes = fs.readFileSync(
    path.join(project, "public/replays", card.sport + ".json"),
  );
  if (hash(bytes) !== card.artifact_sha256)
    throw Error("Replay/card fingerprint mismatch: " + card.sport);
}
const evidence = JSON.parse(
  fs.readFileSync(path.join(project, "data/historical_evidence.json"), "utf8"),
);
for (const [file, value] of Object.entries(evidence)) {
  if (!/^[a-z-]+\.json$/.test(file))
    throw Error("Invalid historical receipt name");
  if (
    hash(fs.readFileSync(path.join(project, "public/proof", file))) !==
    value.sha256
  )
    throw Error("Historical receipt hash mismatch");
}
const ordered = Object.fromEntries(
  Object.entries(files).sort(([a], [b]) => a.localeCompare(b, "en")),
);
const result = {
  schema: 1,
  source_commit: sha,
  dirty_source: dirty,
  source_files: ordered,
  source_files_sha256: hash(JSON.stringify(ordered)),
  scope:
    "Normalized source/build identity and replay-byte consistency. Not live sports freshness, model quality or service health.",
};
fs.writeFileSync(
  path.join(project, "public/release.json"),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    source_commit: sha,
    dirty_source: dirty,
    source_files_sha256: result.source_files_sha256,
  }),
);
