#!/usr/bin/env node
// Flow-map replay driver (flow-design SKILL.md verification contract).
//
// Walks every web/flows/*.yml flow map, drives it in a real browser, counts
// the interactions actually performed, and fails a flow when that count
// exceeds its `budget` or wall clock exceeds its `time_budget_ms`. Exits
// non-zero if any flow fails.
//
// HOW TO RUN
// ----------
// This repo deliberately has no Playwright devDependency (no new npm deps
// were added for this driver). Point PLAYWRIGHT_DIR at any directory whose
// node_modules already contains `playwright` + a downloaded Chromium build
// (e.g. the QA scratchpad used by this project's persona-QA passes):
//
//   PLAYWRIGHT_DIR=/path/to/dir/with/node_modules \
//   BASE=http://localhost:3000 \
//   node web/scripts/replay-flows.mjs
//
// If PLAYWRIGHT_DIR is unset, it falls back to a plain `import("playwright")`
// (works if playwright happens to be resolvable, e.g. installed globally or
// via NODE_PATH).
//
// Signed-in flows (`signed_in: true` in the flow map) need a Playwright
// storageState JSON (cookies from a real signed-in session — see this
// project's qa-auth.mjs). Point BITEMAP_AUTH_STATE at it:
//
//   BITEMAP_AUTH_STATE=/path/to/auth-returning.json \
//   PLAYWRIGHT_DIR=... node web/scripts/replay-flows.mjs
//
// A signed-in flow with no BITEMAP_AUTH_STATE set is reported as SKIP, not
// FAIL/PASS, and does not affect the exit code.
//
// Optional: PLAYWRIGHT_EXECUTABLE overrides the Chromium binary path (this
// project's QA scripts default to a Chrome-for-Testing build under
// ~/Library/Caches/ms-playwright when present).
// Optional: FLOWS_DIR overrides which directory of *.yml files to replay
// (default: web/flows next to this script).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FLOWS_DIR = process.env.FLOWS_DIR || path.join(__dirname, "..", "flows");
const BASE = process.env.BASE || "http://localhost:3000";
const AUTH_STATE = process.env.BITEMAP_AUTH_STATE;
const DEFAULT_EXE = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const EXE = process.env.PLAYWRIGHT_EXECUTABLE || (fs.existsSync(DEFAULT_EXE) ? DEFAULT_EXE : undefined);

async function loadPlaywright() {
  const dir = process.env.PLAYWRIGHT_DIR;
  if (dir) {
    const require = createRequire(path.join(dir, "package.json"));
    return require("playwright");
  }
  return import("playwright");
}

// ---------------------------------------------------------------------------
// Minimal YAML-subset parser for this repo's flow-map shape only: top-level
// `key: value` scalars, top-level `key:` + indented `- item` string lists,
// and one nested list-of-maps key (`actions:` -> `- step: ... / kind: ... /
// selector: ... / value: ...`). Not a general YAML parser — deliberately
// scoped to flow-design's documented flow-map format so this driver needs no
// new npm dependency.
function parseScalar(raw) {
  let v = raw.trim();
  if (v === "") return "";
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v;
}

function stripComment(line) {
  // Our flow files never need a literal '#' inside a value, so a naive
  // "outside quotes" strip is safe here.
  let inQuote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === inQuote) inQuote = null;
    } else if (c === '"' || c === "'") {
      inQuote = c;
    } else if (c === "#") {
      return line.slice(0, i);
    }
  }
  return line;
}

function indentOf(line) {
  const m = line.match(/^( *)/);
  return m[0].length;
}

function parseFlowYaml(text) {
  const rawLines = text.split("\n").map(stripComment);
  const lines = [];
  for (let i = 0; i < rawLines.length; i++) {
    if (rawLines[i].trim() === "") continue;
    lines.push({ text: rawLines[i], indent: indentOf(rawLines[i]) });
  }

  const doc = {};
  let i = 0;
  while (i < lines.length) {
    const { text: line, indent } = lines[i];
    if (indent !== 0) {
      throw new Error(`unexpected indent at top level: ${line}`);
    }
    const m = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!m) throw new Error(`unparseable line: ${line}`);
    const [, key, rest] = m;
    if (rest.trim() !== "") {
      doc[key] = parseScalar(rest);
      i++;
      continue;
    }
    // Block: either a list of strings or (for `actions`) a list of maps.
    const items = [];
    i++;
    while (i < lines.length && lines[i].indent > indent) {
      const itemLine = lines[i];
      const dashMatch = itemLine.text.match(/^\s*-\s?(.*)$/);
      if (!dashMatch) throw new Error(`expected list item: ${itemLine.text}`);
      const firstFieldMatch = dashMatch[1].match(/^([A-Za-z_]+):\s*(.*)$/);
      if (!firstFieldMatch) {
        // Simple scalar list item, e.g. `- vote Good`.
        items.push(parseScalar(dashMatch[1]));
        i++;
        continue;
      }
      // Map list item: first field is on the `- ` line itself; subsequent
      // fields are plain `key: value` lines at deeper indent than the dash.
      const obj = {};
      obj[firstFieldMatch[1]] = parseScalar(firstFieldMatch[2]);
      const dashIndent = itemLine.indent;
      i++;
      while (i < lines.length && lines[i].indent > dashIndent) {
        const fm = lines[i].text.match(/^\s*([A-Za-z_]+):\s*(.*)$/);
        if (!fm) throw new Error(`expected field line: ${lines[i].text}`);
        obj[fm[1]] = parseScalar(fm[2]);
        i++;
      }
      items.push(obj);
    }
    doc[key] = items;
  }
  return doc;
}

function loadFlow(file) {
  const text = fs.readFileSync(file, "utf8");
  const doc = parseFlowYaml(text);
  return { file, ...doc };
}

// ---------------------------------------------------------------------------

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
};

async function replayFlow(browser, flow) {
  const viewport = VIEWPORTS[flow.viewport || "mobile"];
  const contextOpts = { viewport };
  if (flow.geolocation) {
    contextOpts.geolocation = { latitude: 3.139, longitude: 101.687 };
    contextOpts.permissions = ["geolocation"];
  }
  if (flow.signed_in) {
    if (!AUTH_STATE || !fs.existsSync(AUTH_STATE)) {
      return { flow, status: "SKIP", reason: "signed_in flow but BITEMAP_AUTH_STATE not set / not found" };
    }
    contextOpts.storageState = AUTH_STATE;
  }

  const ctx = await browser.newContext(contextOpts);
  const page = await ctx.newPage();

  try {
    const startUrl = flow.start_url || "/";
    const t0 = Date.now();
    await page.goto(BASE + startUrl, { waitUntil: "load", timeout: 15000 });

    let interactions = 0;
    for (const action of flow.actions || []) {
      const locator = page.locator(action.selector).first();
      await locator.waitFor({ state: "visible", timeout: 10000 });
      if (action.kind === "supply" && action.value !== undefined) {
        await locator.fill(String(action.value));
      } else if (action.kind === "commit" && action.selector.includes("directions-link")) {
        // Directions opens an external tab — don't actually leave localhost.
        const [popup] = await Promise.all([
          page.waitForEvent("popup", { timeout: 5000 }).catch(() => null),
          locator.click(),
        ]);
        if (popup) await popup.close();
      } else {
        await locator.click();
      }
      interactions += 1;
      // Let the click's navigation/state settle before the next locator
      // lookup — flow maps model real user pacing, not a race against React.
      await page.waitForTimeout(150);
    }
    if (interactions === 0) {
      // A 0-action flow (e.g. verifying a post-auth on-mount effect like
      // SaveToggle's auto-save-on-return) still has in-flight async work
      // right after page load — without this, ctx.close() below aborts it
      // before it lands, so the flow "passes" on click-budget alone while
      // silently proving nothing about whether the effect actually ran.
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    }
    const wallMs = Date.now() - t0;

    const budgetOk = interactions <= flow.budget;
    const timeOk = wallMs <= flow.time_budget_ms;
    return {
      flow,
      status: budgetOk && timeOk ? "PASS" : "FAIL",
      interactions,
      wallMs,
      budgetOk,
      timeOk,
    };
  } catch (e) {
    return { flow, status: "FAIL", reason: String(e).split("\n")[0].slice(0, 200) };
  } finally {
    await ctx.close();
  }
}

async function main() {
  const files = fs
    .readdirSync(FLOWS_DIR)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .sort();
  if (files.length === 0) {
    console.error(`No flow files found in ${FLOWS_DIR}`);
    process.exit(2);
  }

  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ executablePath: EXE });

  const results = [];
  for (const f of files) {
    const flow = loadFlow(path.join(FLOWS_DIR, f));
    const result = await replayFlow(browser, flow);
    results.push(result);
  }
  await browser.close();

  console.log("");
  let anyFail = false;
  for (const r of results) {
    const name = r.flow.flow || r.flow.file;
    if (r.status === "SKIP") {
      console.log(`SKIP  ${name} — ${r.reason}`);
      continue;
    }
    if (r.status === "FAIL" && r.reason && r.interactions === undefined) {
      console.log(`FAIL  ${name} — error: ${r.reason}`);
      anyFail = true;
      continue;
    }
    const budgetPart = `interactions=${r.interactions}/${r.flow.budget}${r.budgetOk ? "" : " OVER"}`;
    const timePart = `time=${r.wallMs}ms/${r.flow.time_budget_ms}ms${r.timeOk ? "" : " OVER"}`;
    console.log(`${r.status}  ${name} — ${budgetPart}  ${timePart}`);
    if (r.status === "FAIL") anyFail = true;
  }
  console.log("");

  process.exit(anyFail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
