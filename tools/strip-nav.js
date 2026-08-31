#!/usr/bin/env node
/* ─── STRIP THE TOP NAV ───────────────────────────────────────────────
   Phase 3b: the floorplan is the navigation, so the sticky nav bar comes
   off every page. Run once; it is idempotent, so a second run reports
   "already done" rather than eating something else.

   What it does per page:
     1. removes the <nav>…</nav> block and the comment banner above it
     2. removes the inline .nav__* / nav {} rules that styled it
     3. links assets/css/glass.css, which styles what replaces it

   index.html is skipped: its only <nav> is <nav class="footer-nav">,
   which is a footer and stays.

   Anything it cannot handle confidently is REPORTED, not guessed at.
   ──────────────────────────────────────────────────────────────────── */
"use strict";

const fs = require("fs");
const path = require("path");

const DIST = path.join(__dirname, "..", "dist");
const apply = !process.argv.includes("--dry");

/* Inline rule blocks whose selectors are entirely about the old nav.
   A selector list is only dropped when EVERY selector in it is dead —
   a rule like `nav a, .card a {}` still has live work to do. */
const DEAD = /^(nav\b|\.nav__|html\.nav-open\b|body\.nav-open\b)/;

function isDeadSelector(sel) {
  const s = sel.trim();
  if (!s) return false;
  // `nav .foo`, `nav > a`, `.nav__links a` — the nav prefix kills it.
  return DEAD.test(s);
}

/* Walks a CSS string and drops top-level rules whose selectors are all
   dead. Written as a brace-counting scan rather than a regex: nav rules
   live inside @media blocks on most pages, and a regex that tries to
   match balanced braces gets those wrong. */
function stripCss(css) {
  let out = "";
  let i = 0;
  let dropped = 0;

  while (i < css.length) {
    // Comments and at-rule preludes pass through untouched.
    const brace = css.indexOf("{", i);
    if (brace === -1) {
      out += css.slice(i);
      break;
    }

    let prelude = css.slice(i, brace);
    // Find the matching close brace.
    let depth = 1;
    let j = brace + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    const body = css.slice(brace + 1, j - 1);
    const trimmed = prelude.trim();

    if (trimmed.startsWith("@") || trimmed.includes("@media") || trimmed.includes("@supports")) {
      // Recurse into the at-rule, then drop it if nothing survived.
      const inner = stripCss(body);
      dropped += inner.dropped;
      if (inner.css.trim()) {
        out += prelude + "{" + inner.css + "}";
      } else {
        // Keep the leading comment/whitespace that preceded the prelude.
        const lead = prelude.slice(0, prelude.lastIndexOf("@"));
        out += lead;
        dropped++;
      }
      i = j;
      continue;
    }

    // A plain rule. Split off any comment sitting before the selectors.
    const lastComment = prelude.lastIndexOf("*/");
    const lead = lastComment === -1 ? "" : prelude.slice(0, lastComment + 2);
    const selectors = (lastComment === -1 ? prelude : prelude.slice(lastComment + 2))
      .split(",")
      .filter((s) => s.trim());

    if (selectors.length && selectors.every(isDeadSelector)) {
      out += lead;
      dropped++;
    } else {
      out += prelude + "{" + body + "}";
    }
    i = j;
  }

  return { css: out, dropped };
}

const problems = [];
let changed = 0;

fs.readdirSync(DIST)
  .filter((f) => f.endsWith(".html") && f !== "index.html")
  .sort()
  .forEach((file) => {
    const full = path.join(DIST, file);
    let html = fs.readFileSync(full, "utf8");
    const before = html;

    /* ── 1. the <nav> element ───────────────────────────────── */
    const opens = html.match(/<nav\b[^>]*>/g) || [];
    const closes = html.match(/<\/nav>/g) || [];

    if (opens.length > 1 || closes.length > 1) {
      problems.push(`${file}: ${opens.length} <nav> / ${closes.length} </nav> — expected one of each`);
      return;
    }
    if (opens.length === 1) {
      if (/class=["'][^"']*footer-nav/.test(opens[0])) {
        problems.push(`${file}: only <nav> is a footer-nav — nothing to strip, check by hand`);
        return;
      }
      const start = html.indexOf(opens[0]);
      const end = html.indexOf("</nav>", start);
      if (end === -1) {
        problems.push(`${file}: <nav> has no closing tag`);
        return;
      }
      html = html.slice(0, start) + html.slice(end + "</nav>".length);
      // The banner comment above it, and the blank line it leaves behind.
      html = html.replace(/[ \t]*<!--[^>]*?NAV[^>]*?-->\n?/g, "");
      html = html.replace(/\n[ \t]*\n[ \t]*\n/g, "\n\n");
    }

    /* ── 2. the inline CSS that styled it ───────────────────── */
    html = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/g, (m, css) => {
      const res = stripCss(css);
      return res.dropped ? m.replace(css, res.css) : m;
    });

    /* ── 3. link glass.css ──────────────────────────────────── */
    if (!html.includes("assets/css/glass.css")) {
      const anchor = '<link rel="stylesheet" href="assets/css/chrome.css" />';
      if (!html.includes(anchor)) {
        problems.push(`${file}: no chrome.css link to anchor glass.css to`);
        return;
      }
      html = html.replace(
        anchor,
        anchor + '\n    <link rel="stylesheet" href="assets/css/glass.css" />'
      );
    }

    if (html !== before) {
      changed++;
      if (apply) fs.writeFileSync(full, html);
    }
  });

console.log(`${apply ? "rewrote" : "would rewrite"} ${changed} page(s)`);
if (problems.length) {
  console.log("\nNOT handled — look at these by hand:");
  problems.forEach((p) => console.log("  " + p));
  process.exitCode = 1;
}
