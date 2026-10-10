import { copyFile } from "node:fs/promises";
await copyFile(
  "node_modules/@techstark/opencv-js/dist/opencv.js",
  "dist/opencv.js",
);
import { build } from "esbuild";
await build({
  entryPoints: ["src/crop-worker.ts"],
  outfile: "dist/crop-worker.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  minify: true,
});
