import test from "node:test";
import assert from "node:assert/strict";
import { reconcileHostingChanges } from "./hosting-policy.mjs";

const committed = Buffer.from(JSON.stringify({
  $schema: "https://openapi.vercel.sh/vercel.json",
  installCommand: "npm ci --no-audit --no-fund",
}));
const config = Buffer.from('{"installCommand":"npm ci --no-audit --no-fund"}');
function check(status, overrides = {}) {
  return reconcileHostingChanges({
    status,
    isVercel: true,
    readGeneratedConfig: () => config,
    readCommittedConfig: () => committed,
    ...overrides,
  });
}
test("a clean checkout never reads generated configuration", () => {
  assert.deepEqual(check("", {
    readGeneratedConfig: () => { throw Error("Unexpected read"); },
  }), { remaining: [], generatedConfigSha256: null });
});
test("Vercel's exact config copy is recorded and accepted", () => {
  const result = check("?? vercel.json\n");
  assert.deepEqual(result.remaining, []);
  assert.match(result.generatedConfigSha256, /^[a-f0-9]{64}$/);
});
test("formatting and optional schema do not change settings", () => {
  assert.deepEqual(check("?? vercel.json", {
    readGeneratedConfig: () => committed,
  }).remaining, []);
});
test("the exception is unavailable outside Vercel", () => {
  assert.deepEqual(check("?? vercel.json", {
    isVercel: false,
    readGeneratedConfig: () => { throw Error("Unexpected read"); },
  }).remaining, ["?? vercel.json"]);
});
test("changed tracked source remains rejected alongside an accepted config", () => {
  assert.deepEqual(check(" M dashboard/src/app/page.tsx\n?? vercel.json\n").remaining,
    [" M dashboard/src/app/page.tsx"]);
});
test("other untracked paths and tracked root config changes remain rejected", () => {
  const status = "?? nested/vercel.json\n M vercel.json\n?? unexpected.txt";
  assert.deepEqual(check(status).remaining, status.split("\n"));
});
test("different or additional settings fail closed", () => {
  for (const content of [
    '{"installCommand":"npm install"}',
    '{"installCommand":"npm ci --no-audit --no-fund","buildCommand":"echo bypass"}',
    '{"installCommand":"npm ci --no-audit --no-fund","$schema":"https://example.com"}',
  ]) {
    assert.throws(() => check("?? vercel.json", {
      readGeneratedConfig: () => Buffer.from(content),
    }));
  }
});
test("malformed and non-object configs fail closed", () => {
  for (const content of ["{", "null", "[]", '"text"']) {
    assert.throws(() => check("?? vercel.json", {
      readGeneratedConfig: () => Buffer.from(content),
    }));
  }
});
