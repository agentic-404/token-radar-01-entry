// Token Radar — entrypoint (radar-6).
//
// Reads the sealed DefiLlama snapshot, ranks the pre-token protocols with the
// fitted radar-6 model, and writes the board, the dashboard data, the dossier
// and the dashboard's static files into the output directory.
//
// Local run (the way the kit shows it):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
// In the grading sandbox the snapshot is at /input/snapshot.json and the
// output at /output; those are the defaults below. Node 22+, stdlib only.

import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  boardIssue,
  buildRadar,
  dataScript,
  parseSnapshot,
} from "./lib/model.ts";
import { buildDossier } from "./vendor/makefun-board.ts";
import type { RadarData, Snapshot } from "./lib/model.ts";

// ---- inputs ---------------------------------------------------------------

interface RunFlags {
  snapshotPath: string;
  outDir: string;
}

function flagAfter(argv: string[], name: string): string | undefined {
  const at = argv.indexOf(name);
  return at >= 0 && at + 1 < argv.length ? argv[at + 1] : undefined;
}

function readFlags(argv: string[]): RunFlags {
  const snapshotPath = flagAfter(argv, "--input") ?? "/input/snapshot.json";
  const outDir =
    process.env.MAKEFUN_OUTPUT_DIR ??
    flagAfter(argv, "--output") ??
    "/output";
  return { snapshotPath, outDir };
}

// ---- outputs --------------------------------------------------------------

function copyTree(from: string, to: string): void {
  cpSync(from, to, { recursive: true });
}

function summarise(snapshot: Snapshot, radar: RadarData, rows: number): void {
  const m = radar.model;
  console.log(
    `token radar: ${snapshot.protocols.length} protocols in the snapshot, ` +
      `${snapshot.watchlist.length} on the watchlist, ${rows} rows ranked ` +
      `(${radar.early_size} early finds, ${radar.live_size} live tokens shown separately)`,
  );
  console.log(
    `token radar: ${m.version}, log-log slope ${m.slope.toFixed(4)}, ` +
      `leave-one-out miss x${m.loo_x_factor.toFixed(2)}, ` +
      `walk-forward x${m.wf_x_factor.toFixed(2)} (cut ${m.wf_cut}) ` +
      `/ x${m.wf2_x_factor.toFixed(2)} (cut ${m.wf2_cut})`,
  );
}

function run(): void {
  const flags = readFlags(process.argv.slice(2));
  const snapshot = parseSnapshot(readFileSync(flags.snapshotPath, "utf8"));
  const { board, radar } = buildRadar(snapshot);

  const gate = boardIssue(board, snapshot);
  if (gate !== null) throw new Error(`local gate refuses the board: ${gate}`);

  mkdirSync(flags.outDir, { recursive: true });
  writeFileSync(
    join(flags.outDir, "board.json"),
    JSON.stringify({ rows: board }) + "\n",
    "utf8",
  );
  writeFileSync(join(flags.outDir, "data.js"), dataScript(radar), "utf8");

  const home = fileURLToPath(new URL(".", import.meta.url));
  copyTree(join(home, "dashboard"), join(flags.outDir, "dashboard"));
  copyTree(join(home, "screenshots"), join(flags.outDir, "screenshots"));

  const dossier = buildDossier(flags.outDir, { text_max_bytes: 65_536 });
  writeFileSync(join(flags.outDir, "dossier.json"), dossier);

  summarise(snapshot, radar, board.length);
  console.log(
    `token radar: wrote board.json, data.js, dashboard/, screenshots/ and dossier.json into ${flags.outDir}`,
  );
}

try {
  run();
} catch (err) {
  console.error(
    `token radar: failed — ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
}
