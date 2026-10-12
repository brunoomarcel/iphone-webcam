#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const obsPort = Number(process.env.OBS_PORT || 8765);
const controlUrl = `http://localhost:${obsPort}/`;
const stateDir = join(homedir(), ".local/state/iphone-linux-webcam");
const logPath = join(stateDir, "server.log");
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const serverPath = join(repoRoot, "server.mjs");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isRunning() {
  try {
    const response = await fetch(controlUrl, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

async function openControlPage() {
  spawn("xdg-open", [controlUrl], {
    detached: true,
    stdio: "ignore",
  }).unref();
}

async function startServer() {
  mkdirSync(dirname(logPath), { recursive: true });
  const out = openSync(logPath, "a");
  const child = spawn(process.execPath, [serverPath], {
    detached: true,
    stdio: ["ignore", out, out],
  });
  child.unref();

  for (let attempt = 0; attempt < 20; attempt++) {
    await sleep(250);
    if (await isRunning()) return true;
  }

  return false;
}

if (!(await isRunning())) {
  await startServer();
}

await openControlPage();

if (!existsSync(logPath)) {
  process.exit(0);
}
