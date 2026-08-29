/* One entry point for every check.
 *
 *   node tools/verify.js            # run everything
 *   node tools/verify.js --quick    # skip the slow responsive sweep
 *   node tools/verify.js smoke cursor
 *
 * Each check is a separate script so it can be run alone while working;
 * this composes them and gives one pass/fail for the whole site.
 */
const { spawnSync } = require("child_process");
const path = require("path");

const CHECKS = [
  { name: "smoke",      script: "smoke.js",        blurb: "every page loads, no 404s, no console errors" },
  { name: "cursor",     script: "cursor-check.js", blurb: "the custom cursor tracks the pointer" },
  { name: "behaviour",  script: "behaviour.js",    blurb: "mode system, mobile menu, floorplan, focus" },
  { name: "links",      script: "link-check.js",   blurb: "internal links resolve, case-sensitively" },
  { name: "responsive", script: "responsive.js",   blurb: "no overflow, tap targets, clipped text", slow: true },
];

const args = process.argv.slice(2);
const quick = args.includes("--quick");
const only = args.filter((a) => !a.startsWith("--"));

const chosen = CHECKS.filter((c) => {
  if (only.length) return only.includes(c.name);
  return !(quick && c.slow);
});

const results = [];
for (const c of chosen) {
  process.stdout.write(`\n── ${c.name} — ${c.blurb}\n`);
  const r = spawnSync(process.execPath, [path.join(__dirname, c.script)], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const out = (r.stdout || "") + (r.stderr || "");
  process.stdout.write(out.split("\n").slice(-14).join("\n"));

  // responsive.js reports findings without exiting non-zero, so its
  // verdict is read from the summary line rather than the exit code.
  let ok = r.status === 0;
  if (c.name === "responsive") {
    const m = out.match(/(\d+) page\(s\) with findings/);
    ok = !!m && m[1] === "0";
  }
  results.push({ name: c.name, ok });
}

console.log("\n" + "─".repeat(52));
results.forEach((r) => console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name}`));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
