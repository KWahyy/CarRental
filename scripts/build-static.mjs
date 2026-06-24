import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const outDir = join(root, "dist");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const pathsToCopy = [
  "index.html",
  "fleet.html",
  "partner.html",
  "admin",
  "assets",
  "cars",
  "images",
  "public",
  "src",
  "supabase"
];

for (const path of pathsToCopy) {
  const source = join(root, path);
  if (existsSync(source)) {
    cpSync(source, join(outDir, path), { recursive: true });
  }
}

console.log("Static site copied to dist/");
