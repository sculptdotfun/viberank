import { spawnSync } from "node:child_process";

const result = spawnSync("pnpm", ["exec", "tsx", "test/demo-data.case.mts"], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
