// Counts `!important` added by a PR in CSS files and fails above a limit.
// Usage: node scripts/ci/check-important.mjs <base-ref> [limit]
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const base = process.argv[2] ?? "origin/main";
const limit = Number(process.argv[3] ?? process.env.IMPORTANT_LIMIT ?? 3);

const diff = execFileSync("git", ["diff", "--unified=0", `${base}...HEAD`, "--", "*.css"], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});

const found = [];
let file = "";
let line = 0;
for (const l of diff.split("\n")) {
  if (l.startsWith("+++ ")) file = l.slice(6);
  else if (l.startsWith("@@")) line = Number(/\+(\d+)/.exec(l)?.[1] ?? 0) - 1;
  else if (l.startsWith("+")) {
    line++;
    if (/!important/i.test(l)) found.push({ file, line, text: l.slice(1).trim() });
  }
}

for (const f of found) console.log(`::warning file=${f.file},line=${f.line}::Added !important: ${f.text}`);
const msg = found.length
  ? `### !important check\nThis PR adds **${found.length}** \`!important\` (limit ${limit}).\n` +
    found.map((f) => `- \`${f.file}:${f.line}\` \`${f.text}\``).join("\n")
  : "### !important check\nNo `!important` added.";
console.log(msg);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, msg + "\n");
if (found.length > limit) {
  console.error(`Too many !important added (${found.length} > ${limit}). See CONTRIBUTING.md.`);
  process.exit(1);
}
