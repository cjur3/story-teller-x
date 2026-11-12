// Every asset folder touched by a PR needs a LICENSE.md (author, source, allowed license).
// Usage: node scripts/ci/check-licenses.mjs <base-ref> | --all
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, posix } from "node:path";

const ASSET_EXT = /\.(webp|png|jpe?g|gif|svg|wbmp|xcf|psd|mp3|ogg|wav|flac|webm|woff2?|ttf|otf)$/i;
const EXCLUDED = [/^img\/git\//, /^img\/nav\//]; // showcase screenshots, nav arrows
const ALLOWED = /\b(CC0|public domain|CC[- ]BY(?![- ]?(NC|ND))|MIT|Apache[- ]2|BSD|OFL|SIL Open Font|FiftySounds license)\b/i;
const FORBIDDEN = /(\bNC\b|non-?commercial|\bND\b|no[- ]derivatives|unity asset store|personal use)/i;

const arg = process.argv[2] ?? "origin/main";
const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const files =
  arg === "--all"
    ? git("ls-files").split("\n")
    : git("diff", "--name-only", "--diff-filter=AMR", `${arg}...HEAD`).split("\n");

const assets = files.filter((f) => f && ASSET_EXT.test(f) && !EXCLUDED.some((r) => r.test(f)) && existsSync(f));

const problems = new Map();
const checked = new Map();
function licenseFor(file) {
  // nearest LICENSE.md walking up, but not past the repo root
  for (let dir = posix.dirname(file); dir !== "."; dir = posix.dirname(dir)) {
    const p = posix.join(dir, "LICENSE.md");
    if (existsSync(p)) return p;
  }
  return null;
}
function validate(path) {
  if (checked.has(path)) return checked.get(path);
  const t = readFileSync(path, "utf8");
  const errs = [];
  if (!/https?:\/\//.test(t)) errs.push("no source/license URL");
  if (!/author|by\s|credit/i.test(t)) errs.push("no author credit");
  if (FORBIDDEN.test(t)) errs.push("mentions a forbidden license");
  if (!ALLOWED.test(t)) errs.push("no allowed license named");
  checked.set(path, errs);
  return errs;
}

for (const f of assets) {
  const lic = licenseFor(f);
  if (!lic) problems.set(f, ["no LICENSE.md in its folder"]);
  else {
    const errs = validate(lic);
    if (errs.length) problems.set(f, [`${lic}: ${errs.join(", ")}`]);
  }
}

for (const [f, errs] of problems) console.log(`::error file=${f}::${errs.join("; ")}`);
console.log(`Checked ${assets.length} asset file(s), ${problems.size} problem(s).`);
process.exit(problems.size ? 1 : 0);
