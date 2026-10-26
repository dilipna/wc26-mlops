import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
if (process.env.GITHUB_ACTIONS !== "true")
  throw Error("Browser execution is restricted to GitHub runners.");
const origin = process.env.SPOPS_E2E_ORIGIN || "http://127.0.0.1:3261";
if (
  !["http://127.0.0.1:3261", "https://fifa2026mlops.vercel.app"].includes(
    origin,
  ) &&
  !/^https:\/\/dashboard-[a-z0-9]+-asmq333\.vercel\.app$/.test(origin)
)
  throw Error("Unexpected browser origin");
export default defineConfig({
  testDir: "./tests",
  outputDir: "../e2e-results/artifacts",
  workers: 1,
  retries: 0,
  timeout: 30000,
  globalTimeout: 600000,
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: fileURLToPath(
          new URL("../e2e-results/results.json", import.meta.url),
        ),
      },
    ],
  ],
  use: {
    baseURL: origin,
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: origin.startsWith("http://127.0.0.1")
    ? {
        cwd: fileURLToPath(new URL("../", import.meta.url)),
        command:
          "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3261",
        url: origin,
        reuseExistingServer: false,
        timeout: 30000,
      }
    : undefined,
});
