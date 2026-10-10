import type { Card } from "./model";
export interface Conference {
  id?: string;
  name: string;
  date: string;
  location: string;
  notes: string;
  next_action: string;
  follow_up: string;
  completed: boolean;
  updated_at?: string;
}
export const blankConference = (name = ""): Conference => ({
  name,
  date: "",
  location: "",
  notes: "",
  next_action: "",
  follow_up: "",
  completed: false,
});
export function sanitizeConference(value: unknown): Conference {
  const result = blankConference();
  if (!value || typeof value !== "object") return result;
  const input = value as Record<string, unknown>;
  for (const key of ["name", "location", "notes", "next_action"] as const)
    result[key] =
      typeof input[key] === "string"
        ? input[key].trim().slice(0, key === "notes" ? 10000 : 1000)
        : "";
  for (const key of ["date", "follow_up"] as const) {
    const v = input[key];
    if (
      typeof v === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      !Number.isNaN(Date.parse(v + "T12:00:00Z")) &&
      new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v
    )
      result[key] = v;
  }
  result.completed = input.completed === true;
  return result;
}
export function conferenceGroups(cards: Card[], conferences: Conference[]) {
  const groups = new Map<
    string,
    { conference: Conference; contacts: Card[] }
  >();
  for (const conference of conferences)
    groups.set(conference.name.trim(), { conference, contacts: [] });
  for (const card of cards) {
    const name = card.event.trim();
    if (!name) continue;
    if (!groups.has(name))
      groups.set(name, { conference: blankConference(name), contacts: [] });
    groups.get(name)!.contacts.push(card);
  }
  return [...groups.values()];
}
