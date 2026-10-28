const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const siteDir = path.join(__dirname, "..", "site");
const html = fs.readFileSync(path.join(siteDir, "index.html"), "utf8");

test("index.html has a title and viewport meta tag", () => {
  assert.match(html, /<title>Battleship vs\. AI<\/title>/);
  assert.match(html, /<meta name="viewport"/);
});

// GitHub Pages serves this site from /battleship-game/, so root-absolute
// paths like "/style.css" would 404 there. Every local asset must be
// relative and must exist with exactly that (case-sensitive) name.
test("all local assets referenced by index.html are relative and exist", () => {
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const local = refs.filter((r) => !/^(https?:)?\/\//.test(r) && !r.startsWith("#"));
  assert.ok(local.length > 0, "expected at least one local asset");
  for (const ref of local) {
    assert.ok(!ref.startsWith("/"), `${ref} must be a relative path`);
    const files = fs.readdirSync(path.dirname(path.join(siteDir, ref)));
    assert.ok(files.includes(path.basename(ref)), `${ref} does not exist (check case)`);
  }
});
