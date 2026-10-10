import test from "node:test";
import assert from "node:assert/strict";
import opencv from "@techstark/opencv-js";
import {
  detectMat,
  warpMat,
  fullCorners,
  validCorners,
  type Corners,
} from "../src/card-crop.ts";
const cv: any = await opencv;
test("detects an entire business card rather than its printed text", () => {
  const mat = cv.Mat.zeros(500, 800, cv.CV_8UC4);
  cv.rectangle(
    mat,
    new cv.Point(100, 100),
    new cv.Point(700, 450),
    new cv.Scalar(245, 245, 245, 255),
    -1,
  );
  cv.rectangle(
    mat,
    new cv.Point(180, 170),
    new cv.Point(430, 190),
    new cv.Scalar(10, 10, 10, 255),
    -1,
  );
  const corners = detectMat(cv, mat);
  assert.ok(corners);
  assert.ok(Math.abs(corners[0].x - 100 / 800) < 0.02);
  assert.ok(Math.abs(corners[0].y - 100 / 500) < 0.02);
  assert.ok(Math.abs(corners[2].x - 700 / 800) < 0.02);
  assert.ok(Math.abs(corners[2].y - 450 / 500) < 0.02);
});
test("detects a tilted card and rejects an image with no visible edges", () => {
  const mat = cv.Mat.zeros(500, 800, cv.CV_8UC4);
  const polygon = cv.matFromArray(
    4,
    1,
    cv.CV_32SC2,
    [100, 120, 650, 70, 710, 390, 140, 450],
  );
  cv.fillConvexPoly(mat, polygon, new cv.Scalar(250, 250, 250, 255));
  polygon.delete();
  const corners = detectMat(cv, mat);
  assert.ok(corners);
  assert.ok(validCorners(corners));
  assert.equal(detectMat(cv, cv.Mat.zeros(500, 800, cv.CV_8UC4)), null);
});
test("perspective correction removes the background and preserves card pixels", () => {
  const mat = cv.Mat.zeros(500, 800, cv.CV_8UC4);
  cv.rectangle(
    mat,
    new cv.Point(100, 100),
    new cv.Point(700, 450),
    new cv.Scalar(210, 220, 230, 255),
    -1,
  );
  const result = warpMat(cv, mat, [
    { x: 100 / 799, y: 100 / 499 },
    { x: 700 / 799, y: 100 / 499 },
    { x: 700 / 799, y: 450 / 499 },
    { x: 100 / 799, y: 450 / 499 },
  ]);
  assert.equal(result.width, 600);
  assert.equal(result.height, 350);
  assert.deepEqual([...result.data.slice(0, 4)], [210, 220, 230, 255]);
  const middle =
    (Math.floor(result.height / 2) * result.width +
      Math.floor(result.width / 2)) *
    4;
  assert.deepEqual(
    [...result.data.slice(middle, middle + 4)],
    [210, 220, 230, 255],
  );
});
test("crossed and collapsed crop outlines are rejected", () => {
  assert.ok(validCorners(fullCorners()));
  assert.equal(
    validCorners([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ]),
    false,
  );
  assert.equal(
    validCorners([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ]),
    false,
  );
  assert.equal(
    validCorners([
      { x: -0.1, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ]),
    false,
  );
});
