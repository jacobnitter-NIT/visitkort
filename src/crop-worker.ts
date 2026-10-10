import { detectMat, warpMat } from "./card-crop";
const scope = self as any;
let ready: Promise<any> | undefined;
function vision() {
  if (!ready)
    ready = (async () => {
      scope.importScripts("/opencv.js");
      const cv = await scope.cv;
      if (cv.Mat) return cv;
      return new Promise((resolve) => {
        cv.onRuntimeInitialized = () => resolve(cv);
      });
    })();
  return ready;
}
scope.onmessage = async ({ data }: any) => {
  try {
    const cv = await vision();
    let result: any = true;
    if (data.action !== "ready") {
      const mat = cv.matFromImageData(data.image);
      result =
        data.action === "detect"
          ? detectMat(cv, mat)
          : warpMat(cv, mat, data.corners);
    }
    scope.postMessage({ id: data.id, result });
  } catch (error) {
    scope.postMessage({
      id: data.id,
      error:
        error instanceof Error
          ? error.message
          : "Kantgenkendelse kunne ikke indlæses.",
    });
  }
};
