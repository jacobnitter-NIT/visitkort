export async function api<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch("/api" + path, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init.headers,
    },
  });
  if (!res.ok) {
    let message = "Forbindelsen kunne ikke oprettes.";
    try {
      message = ((await res.json()) as { error?: string }).error || message;
    } catch {}
    throw new Error(message);
  }
  return res.json();
}
export function download(name: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export async function shrink(file: File, max = 1600): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const factor = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * factor);
  canvas.height = Math.round(bitmap.height * factor);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error("Billedet kunne ikke behandles.")),
      "image/jpeg",
      0.86,
    ),
  );
  return new File([blob], "visitkort.jpg", { type: blob.type });
}
export async function upload(file: File) {
  const form = new FormData();
  form.set("file", await shrink(file));
  return (await api<{ id: string }>("/upload", { method: "POST", body: form }))
    .id;
}
const draftDB = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("visitkort-drafts", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("drafts", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
export type Draft = { id: string; file: File; date: string; event: string };
export async function storeDraft(file: File, event: string) {
  const db = await draftDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    tx.objectStore("drafts").put({
      id: crypto.randomUUID(),
      file,
      date: new Date().toISOString(),
      event,
    });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function drafts() {
  const db = await draftDB();
  return new Promise<Draft[]>((resolve, reject) => {
    const r = db.transaction("drafts").objectStore("drafts").getAll();
    r.onsuccess = () => {
      db.close();
      resolve(r.result);
    };
    r.onerror = () => reject(r.error);
  });
}
export async function deleteDraft(id: string) {
  const db = await draftDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    tx.objectStore("drafts").delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
