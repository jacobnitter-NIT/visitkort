export interface Card {
  id?: string;
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  mobile: string;
  website: string;
  linkedin: string;
  address: string;
  notes: string;
  event: string;
  met_at: string;
  tags: string[];
  status: string;
  follow_up: string;
  next_action: string;
  favorite: boolean;
  photo_ids: string[];
  portrait_id: string;
  created_at?: string;
  updated_at?: string;
}
export interface Interaction {
  id: string;
  contact_id: string;
  kind: string;
  happened_at: string;
  note: string;
  created_at: string;
}
export interface Share {
  token: string;
  kind: string;
  contact_id?: string;
  created_at: string;
  expires_at?: string;
  revoked: number;
  name: string;
}
export const blankCard = (): Card => ({
  name: "",
  title: "",
  company: "",
  email: "",
  phone: "",
  mobile: "",
  website: "",
  linkedin: "",
  address: "",
  notes: "",
  event: "",
  met_at: "",
  tags: [],
  status: "Ny kontakt",
  follow_up: "",
  next_action: "",
  favorite: false,
  photo_ids: [],
  portrait_id: "",
});
export const publicFields = [
  "name",
  "title",
  "company",
  "email",
  "phone",
  "mobile",
  "website",
  "linkedin",
  "address",
] as const;
export function sanitizeCard(input: unknown): Card {
  const c = blankCard();
  if (!input || typeof input !== "object") return c;
  const obj = input as Record<string, unknown>;
  for (const k of Object.keys(c)) {
    if (k === "tags" || k === "photo_ids")
      (c as unknown as Record<string, unknown>)[k] = Array.isArray(obj[k])
        ? obj[k]
            .filter((v) => typeof v === "string")
            .slice(0, k === "tags" ? 20 : 4)
            .map((v) => v.slice(0, 120))
        : [];
    else if (k === "favorite") c.favorite = obj[k] === true;
    else
      (c as unknown as Record<string, unknown>)[k] =
        typeof obj[k] === "string"
          ? obj[k].slice(0, k === "notes" ? 10000 : 1000)
          : c[k as keyof Card];
  }
  return c;
}
export function safeWeb(value: string) {
  try {
    const u = new URL(
      value.match(/^https?:\/\//i) ? value : `https://${value}`,
    );
    return ["http:", "https:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}
export function vcard(card: Partial<Card>) {
  const esc = (v: string = "") =>
    v
      .replace(/\\/g, "\\\\")
      .replace(/\r\n|\r|\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${esc(card.name)}`,
    `N:;${esc(card.name)};;;`,
  ];
  for (const [key, val] of [
    ["ORG", card.company],
    ["TITLE", card.title],
    ["EMAIL;TYPE=INTERNET", card.email],
    ["TEL;TYPE=WORK", card.phone],
    ["TEL;TYPE=CELL", card.mobile],
    ["URL", safeWeb(card.website || "")],
    ["X-SOCIALPROFILE;TYPE=linkedin", safeWeb(card.linkedin || "")],
  ] as const)
    if (val) lines.push(`${key}:${esc(val)}`);
  if (card.address) lines.push(`ADR;TYPE=WORK:;;${esc(card.address)};;;;`);
  lines.push("END:VCARD");
  // RFC 6350/2425 folding at 75 UTF-8 octets. Do not split a multibyte character.
  return (
    lines
      .map((l) => {
        let out = "",
          bytes = 0;
        for (const ch of l) {
          const n = new TextEncoder().encode(ch).length;
          if (bytes + n > 75) {
            out += "\r\n ";
            bytes = 1;
          }
          out += ch;
          bytes += n;
        }
        return out;
      })
      .join("\r\n") + "\r\n"
  );
}
function unescapeValue(s: string) {
  return s.replace(/\\n/gi, "\n").replace(/\\([,;:\\])/g, "$1");
}
function splitEsc(s: string, sep: string) {
  const result: string[] = [];
  let part = "",
    escape = false;
  for (const ch of s) {
    if (ch === sep && !escape) {
      result.push(part);
      part = "";
    } else part += ch;
    if (ch === "\\" && !escape) escape = true;
    else escape = false;
  }
  result.push(part);
  return result;
}
export function parseQR(raw: string): Card {
  const c = blankCard();
  const text = raw.trim().replace(/\r?\n[ \t]/g, "");
  if (/^BEGIN:VCARD/i.test(text)) {
    for (const line of text.split(/\r?\n/)) {
      const pos = line.indexOf(":");
      if (pos < 0) continue;
      const key = line.slice(0, pos).toUpperCase(),
        val = line.slice(pos + 1),
        v = unescapeValue(val);
      const base = key.split(";")[0].split(".").pop();
      if (base === "FN") c.name = v;
      else if (base === "N" && !c.name)
        c.name = splitEsc(val, ";")
          .slice(0, 2)
          .reverse()
          .map(unescapeValue)
          .join(" ")
          .trim();
      else if (base === "ORG")
        c.company = splitEsc(val, ";").map(unescapeValue).join(" · ");
      else if (base === "TITLE") c.title = v;
      else if (base === "EMAIL") c.email = v;
      else if (base === "TEL") {
        if (key.includes("CELL")) c.mobile = v;
        else c.phone = v;
      } else if (base === "URL") c.website = safeWeb(v);
      else if (base === "ADR")
        c.address = splitEsc(val, ";")
          .filter(Boolean)
          .map(unescapeValue)
          .join(", ");
      else if (base === "X-SOCIALPROFILE" && key.includes("LINKEDIN"))
        c.linkedin = safeWeb(v);
    }
    return c;
  }
  if (/^MECARD:/i.test(text)) {
    for (const part of splitEsc(text.slice(7), ";")) {
      const pos = part.indexOf(":");
      const key = part.slice(0, pos),
        v = unescapeValue(part.slice(pos + 1));
      if (key === "N")
        c.name = v.includes(",") ? v.split(",").reverse().join(" ").trim() : v;
      else if (key === "TEL") c.phone = v;
      else if (key === "EMAIL") c.email = v;
      else if (key === "ORG") c.company = v;
      else if (key === "URL") c.website = safeWeb(v);
      else if (key === "ADR") c.address = v;
    }
    return c;
  }
  if (/^https?:\/\//i.test(text)) {
    c.website = safeWeb(text);
    return c;
  }
  throw new Error(
    "QR-koden indeholder ikke et understøttet visitkort eller weblink.",
  );
}
export function csv(cards: Card[]) {
  const fields = [
    "name",
    "title",
    "company",
    "email",
    "phone",
    "mobile",
    "website",
    "linkedin",
    "address",
    "event",
    "met_at",
    "tags",
    "status",
    "follow_up",
    "next_action",
    "notes",
  ] as const;
  const quote = (v: unknown) => {
    let s = Array.isArray(v) ? v.join(", ") : String(v ?? "");
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  return (
    "\ufeff" +
    fields.map(quote).join(";") +
    "\r\n" +
    cards.map((c) => fields.map((f) => quote(c[f])).join(";")).join("\r\n")
  );
}
