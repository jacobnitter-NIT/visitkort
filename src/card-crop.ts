export type Point = { x: number; y: number };
export type Corners = [Point, Point, Point, Point]; // clockwise: TL, TR, BR, BL
let worker: Worker | undefined;
let serial = 0;
const pending = new Map<
  number,
  { resolve: (v: any) => void; reject: (e: Error) => void }
>();
export function loadVision(): Promise<Worker> {
  if (!worker) {
    worker = new Worker("/crop-worker.js");
    worker.onmessage = ({ data }) => {
      const request = pending.get(data.id);
      if (!request) return;
      pending.delete(data.id);
      if (data.error) request.reject(new Error(data.error));
      else request.resolve(data.result);
    };
    worker.onerror = () => {
      pending.forEach((request) =>
        request.reject(new Error("Kantgenkendelse kunne ikke indlæses.")),
      );
      pending.clear();
      worker?.terminate();
      worker = undefined;
    };
  }
  return request(worker, "ready").then(() => worker!);
}
function request(
  worker: Worker,
  action: string,
  args: Record<string, unknown> = {},
): Promise<any> {
  const id = ++serial;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(
        new Error(
          "Kantgenkendelse tog for lang tid. Du kan stadig bruge hele billedet.",
        ),
      );
    }, 45000);
    pending.set(id, {
      resolve: (v) => {
        clearTimeout(timeout);
        resolve(v);
      },
      reject: (e) => {
        clearTimeout(timeout);
        reject(e);
      },
    });
    worker.postMessage({ id, action, ...args });
  });
}
export const fullCorners = (): Corners => [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function validCorners(points: Corners): boolean {
  if (
    points.some(
      (p) =>
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        p.x < 0 ||
        p.x > 1 ||
        p.y < 0 ||
        p.y > 1,
    )
  )
    return false;
  const cross = points.map((a, i) => {
    const b = points[(i + 1) % 4],
      c = points[(i + 2) % 4];
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  });
  const area =
    Math.abs(
      points.reduce(
        (v, p, i) =>
          v + p.x * points[(i + 1) % 4].y - p.y * points[(i + 1) % 4].x,
        0,
      ),
    ) / 2;
  return cross.every((v) => v > 0.0001) && area > 0.015;
}
export async function detectCorners(
  worker: Worker,
  source: HTMLCanvasElement,
): Promise<Corners | null> {
  const canvas = document.createElement("canvas"),
    factor = Math.min(1, 800 / Math.max(source.width, source.height));
  canvas.width = Math.round(source.width * factor);
  canvas.height = Math.round(source.height * factor);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  const image = canvas
    .getContext("2d")!
    .getImageData(0, 0, canvas.width, canvas.height);
  return request(worker, "detect", { image });
}
export function detectMat(cv: any, src: any): Corners | null {
  const canvas = { width: src.cols, height: src.rows };
  const gray = new cv.Mat(),
    blurred = new cv.Mat(),
    edges = new cv.Mat(),
    hierarchy = new cv.Mat(),
    contours = new cv.MatVector();
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  let best: Corners | null = null,
    bestArea = 0;
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    // Try several thresholds: a dark card and a pale card need different contrast.
    for (const threshold of [35, 70, 110]) {
      cv.Canny(blurred, edges, threshold, threshold * 2.5);
      cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
      cv.findContours(
        edges,
        contours,
        hierarchy,
        cv.RETR_LIST,
        cv.CHAIN_APPROX_SIMPLE,
      );
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i),
          polygon = new cv.Mat();
        try {
          cv.approxPolyDP(
            contour,
            polygon,
            cv.arcLength(contour, true) * 0.025,
            true,
          );
          const area = Math.abs(cv.contourArea(polygon)),
            fraction = area / (canvas.width * canvas.height);
          if (
            polygon.rows !== 4 ||
            !cv.isContourConvex(polygon) ||
            fraction < 0.12 ||
            fraction > 0.96 ||
            area <= bestArea
          )
            continue;
          let points: Point[] = Array.from({ length: 4 }, (_, k) => ({
            x: polygon.data32S[k * 2] / canvas.width,
            y: polygon.data32S[k * 2 + 1] / canvas.height,
          }));
          const center = {
            x: points.reduce((s, p) => s + p.x, 0) / 4,
            y: points.reduce((s, p) => s + p.y, 0) / 4,
          };
          points.sort(
            (a, b) =>
              Math.atan2(a.y - center.y, a.x - center.x) -
              Math.atan2(b.y - center.y, b.x - center.x),
          );
          const first = points.reduce(
            (v, p, i) => (p.x + p.y < points[v].x + points[v].y ? i : v),
            0,
          );
          points = [...points.slice(first), ...points.slice(0, first)];
          const corners = points as Corners;
          if (!validCorners(corners)) continue;
          const px = points.map((p) => ({
            x: p.x * canvas.width,
            y: p.y * canvas.height,
          }));
          const width = (distance(px[0], px[1]) + distance(px[2], px[3])) / 2,
            height = (distance(px[0], px[3]) + distance(px[1], px[2])) / 2;
          const ratio = Math.max(width, height) / Math.min(width, height);
          if (ratio < 1.15 || ratio > 2.6) continue;
          best = corners;
          bestArea = area;
        } finally {
          contour.delete();
          polygon.delete();
        }
      }
    }
    return best;
  } finally {
    src.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    hierarchy.delete();
    contours.delete();
    kernel.delete();
  }
}
export function warpMat(
  cv: any,
  src: any,
  corners: Corners,
): { width: number; height: number; data: Uint8ClampedArray } {
  if (!validCorners(corners))
    throw new Error("Flyt hjørnerne, så de danner en firkant omkring kortet.");
  const p = corners.map((p) => ({
    x: p.x * (src.cols - 1),
    y: p.y * (src.rows - 1),
  }));
  const width = Math.max(
    1,
    Math.round(Math.max(distance(p[0], p[1]), distance(p[2], p[3]))),
  );
  const height = Math.max(
    1,
    Math.round(Math.max(distance(p[0], p[3]), distance(p[1], p[2]))),
  );
  const dst = new cv.Mat();
  const from = cv.matFromArray(
    4,
    1,
    cv.CV_32FC2,
    p.flatMap((p) => [p.x, p.y]),
  );
  const to = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    0,
    width - 1,
    0,
    width - 1,
    height - 1,
    0,
    height - 1,
  ]);
  const matrix = cv.getPerspectiveTransform(from, to);
  try {
    cv.warpPerspective(
      src,
      dst,
      matrix,
      new cv.Size(width, height),
      cv.INTER_LINEAR,
      cv.BORDER_REPLICATE,
    );
    return { width, height, data: new Uint8ClampedArray(dst.data) };
  } finally {
    src.delete();
    dst.delete();
    from.delete();
    to.delete();
    matrix.delete();
  }
}
export async function cropCard(
  worker: Worker,
  source: HTMLCanvasElement,
  corners: Corners,
): Promise<File> {
  const image = source
    .getContext("2d")!
    .getImageData(0, 0, source.width, source.height);
  const result = await request(worker, "crop", { image, corners });
  const canvas = document.createElement("canvas");
  canvas.width = result.width;
  canvas.height = result.height;
  canvas
    .getContext("2d")!
    .putImageData(
      new ImageData(result.data, result.width, result.height),
      0,
      0,
    );
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error("Billedet kunne ikke beskæres.")),
      "image/jpeg",
      0.92,
    ),
  );
  return new File([blob], "visitkort-beskaaret.jpg", { type: "image/jpeg" });
}
