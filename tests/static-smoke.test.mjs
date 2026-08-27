import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const expectedIds = ["corpusInput", "matrix", "trainToggle", "temperature", "spokenText"];

function localReferences(markup) {
  return [...markup.matchAll(/\b(?:src|href)=["']([^"'#?]+)["']/gi)]
    .map((match) => match[1])
    .filter((reference) => !/^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/i.test(reference));
}

test("静态资源、脚本与关键实验控件保持完整", () => {
  assert.match(html, /<meta[^>]+name=["']viewport["']/i);
  for (const id of expectedIds) assert.match(html, new RegExp(`id=["']${id}["']`));
  for (const reference of localReferences(html)) assert.ok(existsSync(resolve(root, reference)), reference);
  const script = resolve(root, "app.js");
  assert.equal(spawnSync(process.execPath, ["--check", script]).status, 0);
  const css = readFileSync(resolve(root, "styles.css"), "utf8");
  assert.match(css, /@media/i);
});

test("静态页面不声明重复的固定 ID", () => {
  const ids = [...html.matchAll(/\bid=["']([A-Za-z][\w:-]*)["']/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});
