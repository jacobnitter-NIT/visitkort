import { tr, getLanguage } from "./i18n";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { shrink } from "./api";
import {
  cropCard,
  detectCorners,
  fullCorners,
  loadVision,
  validCorners,
  type Corners,
} from "./card-crop";

export function CardCrop({
  file,
  onUse,
  onCancel,
}: {
  file: File;
  onUse: (file: File) => void;
  onCancel: () => void;
}) {
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [url, setUrl] = useState("");
  const [corners, setCorners] = useState<Corners>(fullCorners);
  const [working, setWorking] = useState(true);
  const [cv, setCV] = useState<any>(null);
  const [message, setMessage] = useState("Finder kortets kanter…");
  const drag = useRef<number | null>(null),
    stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false,
      imageURL = "";
    (async () => {
      try {
        const reduced = await shrink(file, 2000);
        const bitmap = await createImageBitmap(reduced),
          canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
        bitmap.close();
        imageURL = URL.createObjectURL(reduced);
        if (cancelled) {
          URL.revokeObjectURL(imageURL);
          return;
        }
        setSource(canvas);
        setUrl(imageURL);
        const vision = await loadVision();
        if (cancelled) return;
        setCV(() => vision);
        const detected = await detectCorners(vision, canvas);
        if (cancelled) return;
        setCorners(detected || fullCorners());
        setMessage(
          detected
            ? "Kortets kanter er fundet. Kontrollér markeringen før scanning."
            : "Kanterne var ikke tydelige. Flyt de fire hjørner til kortets kanter, eller brug hele billedet.",
        );
      } catch (error) {
        if (!cancelled) setMessage((error as Error).message);
      } finally {
        if (!cancelled) setWorking(false);
      }
    })();
    return () => {
      cancelled = true;
      if (imageURL) URL.revokeObjectURL(imageURL);
    };
  }, [file]);
  function move(clientX: number, clientY: number) {
    if (drag.current === null || !stage.current) return;
    const rect = stage.current.getBoundingClientRect(),
      index = drag.current;
    setCorners(
      (prev) =>
        prev.map((p, i) =>
          i === index
            ? {
                x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
                y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
              }
            : p,
        ) as Corners,
    );
  }
  async function useCrop() {
    if (!source || !cv) return;
    setWorking(true);
    try {
      onUse(await cropCard(cv, source, corners));
    } catch (error) {
      setMessage((error as Error).message);
      setWorking(false);
    }
  }
  return (
    <div className="padded card-crop">
      <p role="status">
        {working && <LoaderCircle className="spin" size={18} />} {tr(message)}
      </p>
      {url && (
        <div
          className="crop-stage"
          ref={stage}
          style={{
            width: source
              ? `min(100%, ${(65 * source.width) / source.height}vh)`
              : undefined,
          }}
        >
          <img
            src={url}
            alt={tr("Visitkort med justerbar beskæring")}
            draggable={false}
          />
          <svg
            className="crop-outline"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d={`M0 0H100V100H0Z M${corners.map((p) => `${p.x * 100} ${p.y * 100}`).join("L")}Z`}
              fill="rgba(0,0,0,.48)"
              fillRule="evenodd"
            />
            <polygon
              points={corners.map((p) => `${p.x * 100},${p.y * 100}`).join(" ")}
              fill="none"
              stroke="#80dfb4"
              strokeWidth=".6"
            />
          </svg>
          {corners.map((p, i) => (
            <button
              key={i}
              className="crop-handle"
              aria-label={
                getLanguage() === "en"
                  ? `Corner ${i + 1}. Use arrow keys to move.`
                  : `Hjørne ${i + 1}. Brug piletasterne til at flytte.`
              }
              disabled={working || !cv}
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
              onPointerDown={(e) => {
                drag.current = i;
                e.currentTarget.setPointerCapture(e.pointerId);
                e.preventDefault();
              }}
              onPointerMove={(e) => move(e.clientX, e.clientY)}
              onPointerUp={() => {
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
              onKeyDown={(e) => {
                const delta = {
                  ArrowLeft: [-0.005, 0],
                  ArrowRight: [0.005, 0],
                  ArrowUp: [0, -0.005],
                  ArrowDown: [0, 0.005],
                }[e.key];
                if (delta) {
                  e.preventDefault();
                  setCorners(
                    (prev) =>
                      prev.map((p, k) =>
                        k === i
                          ? {
                              x: Math.max(0, Math.min(1, p.x + delta[0])),
                              y: Math.max(0, Math.min(1, p.y + delta[1])),
                            }
                          : p,
                      ) as Corners,
                  );
                }
              }}
            />
          ))}
        </div>
      )}
      {cv && (
        <p className="crop-hint">
          {tr(
            "Træk hjørnerne til kortets kanter. Skæve vinkler rettes automatisk.",
          )}
        </p>
      )}
      <div className="crop-actions">
        <button
          className="primary"
          disabled={working || !source || !cv || !validCorners(corners)}
          onClick={useCrop}
        >
          {tr("Brug beskæring og scan")}
        </button>
        <button
          className="secondary"
          disabled={working}
          onClick={() => onUse(file)}
        >
          {tr("Brug hele billedet")}
        </button>
        <button className="text-btn" disabled={working} onClick={onCancel}>
          {tr("Vælg et andet billede")}
        </button>
      </div>
    </div>
  );
}
