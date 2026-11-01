import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

// Vercel can copy the subproject config to an untracked repository-root file.
// Accept only that exact path, only on Vercel, and only with identical settings.
export function reconcileHostingChanges({
  status,
  isVercel,
  readGeneratedConfig,
  readCommittedConfig,
}) {
  const entries = status.split(/\r?\n/).filter(Boolean);
  const remaining = [];
  let generatedConfigSha256 = null;
  for (const entry of entries) {
    if (entry !== "?? vercel.json" || !isVercel) {
      remaining.push(entry);
      continue;
    }
    const generatedBytes = readGeneratedConfig();
    const committedBytes = readCommittedConfig();
    function settings(bytes) {
      const config = JSON.parse(bytes.toString("utf8"));
      if (!config || typeof config !== "object" || Array.isArray(config))
        throw Error("Vercel configuration must be an object");
      if (
        "$schema" in config &&
        config.$schema !== "https://openapi.vercel.sh/vercel.json"
      )
        throw Error("Unexpected Vercel configuration schema");
      delete config.$schema;
      return config;
    }
    if (!isDeepStrictEqual(settings(generatedBytes), settings(committedBytes)))
      throw Error("Generated root Vercel configuration differs from committed dashboard configuration");
    generatedConfigSha256 = createHash("sha256")
      .update(generatedBytes)
      .digest("hex");
  }
  return { remaining, generatedConfigSha256 };
}
