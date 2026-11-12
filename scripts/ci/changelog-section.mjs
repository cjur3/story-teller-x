// Prints the CHANGELOG.md section for a version (falls back to [Unreleased]).
// Usage: node scripts/ci/changelog-section.mjs <version> [path]
import { readFileSync } from "node:fs";

const version = (process.argv[2] ?? "").replace(/^v/, "");
const file = process.argv[3] ?? "CHANGELOG.md";
const lines = readFileSync(file, "utf8").split(/\r?\n/);

function section(matcher) {
  const start = lines.findIndex((l) => /^## /.test(l) && matcher(l));
  if (start < 0) return "";
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  if (end < 0) end = lines.length;
  return lines.slice(start + 1, end).join("\n").trim();
}

const esc = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
let body = version ? section((l) => new RegExp(`^## \\[?v?${esc}\\]?(\\s|$)`).test(l)) : "";
if (!body) body = section((l) => /^## \[?unreleased\]?/i.test(l));
// "### Added" etc. without any bullet is an empty section
if (!/^\s*[-*] /m.test(body)) {
  console.error(`CHANGELOG.md has no entries for ${version || "the release"} or [Unreleased].`);
  process.exit(1);
}
console.log(body);
