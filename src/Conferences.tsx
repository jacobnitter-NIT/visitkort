import React, { useState, useEffect } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  Users,
  MapPin,
  Check,
  ArrowUpRight,
  Save,
  ScanLine,
  Mail,
  Phone,
  X,
} from "lucide-react";
import { api } from "./api";
import { tr, trf, getLanguage } from "./i18n";
import type { Card } from "./model";
import {
  blankConference,
  conferenceGroups,
  type Conference,
} from "./conference-model";
const today = () => new Date().toLocaleDateString("sv-SE");
const date = (v: string) =>
  v
    ? new Date(v + "T12:00:00").toLocaleDateString(
        getLanguage() === "en" ? "en-GB" : "da-DK",
        { day: "numeric", month: "short", year: "numeric" },
      )
    : "";
export function Conferences({
  cards,
  onContact,
  onAdd,
  onScan,
  onError,
}: {
  cards: Card[];
  onContact: (c: Card) => void;
  onAdd: (name: string) => void;
  onScan: (name: string) => void;
  onError: (message: string) => void;
}) {
  const [conferences, setConferences] = useState<Conference[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [creating, setCreating] = useState(false),
    [name, setName] = useState(""),
    [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    api<Conference[]>("/conferences")
      .then(setConferences)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  async function save(c: Conference) {
    const result = await api<Conference>("/conferences", {
      method: "PUT",
      body: JSON.stringify(c),
    });
    setConferences((prev) => [
      result,
      ...prev.filter((x) => x.name !== result.name),
    ]);
    return result;
  }
  const groups = conferenceGroups(cards, conferences);
  const pending = groups.filter(
    (g) =>
      !g.conference.completed &&
      (g.conference.follow_up || g.conference.next_action),
  );
  const due = pending.filter(
    (g) => g.conference.follow_up && g.conference.follow_up <= today(),
  );
  const shown = groups
    .filter((g) => {
      if (filter === "pending" && !pending.includes(g)) return false;
      if (filter === "due" && !due.includes(g)) return false;
      const text = [
        g.conference.name,
        g.conference.location,
        g.conference.notes,
        ...g.contacts.flatMap((c) => [c.name, c.company]),
      ]
        .join(" ")
        .toLocaleLowerCase();
      return text.includes(query.trim().toLocaleLowerCase());
    })
    .sort((a, b) => {
      const ad =
        !!a.conference.follow_up &&
        a.conference.follow_up <= today() &&
        !a.conference.completed;
      const bd =
        !!b.conference.follow_up &&
        b.conference.follow_up <= today() &&
        !b.conference.completed;
      return (
        Number(bd) - Number(ad) ||
        b.conference.date.localeCompare(a.conference.date) ||
        a.conference.name.localeCompare(b.conference.name)
      );
    });
  return (
    <section className="conference-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{tr("FRA MØDE TIL RELATION")}</span>
          <h1>{tr("Konferencer")}</h1>
          <p>{tr("Dine møder, mennesker og næste skridt — samlet ét sted.")}</p>
        </div>
        <button
          className="primary"
          disabled={loading || !!error}
          onClick={() => setCreating(true)}
        >
          <Plus size={18} />
          {tr("Ny konference")}
        </button>
      </div>
      <div className="conference-stats">
        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          <CalendarDays />
          <strong>{groups.length}</strong>
          <span>{tr("Konferencer")}</span>
        </button>
        <button onClick={() => setFilter("all")}>
          <Users />
          <strong>{groups.reduce((n, g) => n + g.contacts.length, 0)}</strong>
          <span>{tr("Kontakter fra events")}</span>
        </button>
        <button
          className={filter === "pending" ? "active" : ""}
          onClick={() => setFilter("pending")}
        >
          <ArrowUpRight />
          <strong>{pending.length}</strong>
          <span>{tr("Fælles opfølgninger")}</span>
        </button>
        <button
          className={filter === "due" ? "active" : ""}
          onClick={() => setFilter("due")}
        >
          <CalendarDays />
          <strong>{due.length}</strong>
          <span>{tr("Forfalder nu")}</span>
        </button>
      </div>
      <label className="conference-search">
        <Search size={18} />
        <input
          aria-label={tr("Søg konferencer eller kontakter")}
          placeholder={tr("Søg konferencer eller kontakter")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="warning">
          {tr(error)}
        </p>
      )}
      {loading && <p>{tr("Indlæser konferencer…")}</p>}
      {creating && (
        <form
          className="conference-create"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const existing = groups.find(
              (g) =>
                g.conference.name.toLocaleLowerCase() ===
                name.trim().toLocaleLowerCase(),
            );
            if (existing) {
              setOpen(existing.conference.name);
              setQuery("");
              setFilter("all");
              setName("");
              setCreating(false);
              return;
            }
            try {
              const result = await save(blankConference(name.trim()));
              setOpen(result.name);
              setName("");
              setCreating(false);
            } catch (e) {
              onError((e as Error).message);
            }
          }}
        >
          <label>
            {tr("Konferencens navn")}
            <input
              autoFocus
              required
              maxLength={1000}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tr("Fx Arctic Circle 2026")}
            />
          </label>
          <button className="primary" type="submit">
            {tr("Opret")}
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={tr("Luk")}
            onClick={() => setCreating(false)}
          >
            <X />
          </button>
        </form>
      )}
      {!loading && !shown.length && (
        <div className="conference-empty">
          <CalendarDays size={36} />
          <h2>
            {groups.length
              ? tr("Ingen match")
              : tr("Dit næste event starter her")}
          </h2>
          <p>
            {groups.length
              ? tr("Prøv en anden søgning eller vis alle konferencer.")
              : tr(
                  "Opret en konference, eller tilføj et eventnavn på en kontakt. Kontakterne samles automatisk her.",
                )}
          </p>
          <button
            className="secondary"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
          >
            {tr("Vis alle")}
          </button>
        </div>
      )}
      <div className="conference-list">
        {shown.map((g) => (
          <ConferenceGroup
            key={g.conference.name}
            group={g}
            open={open === g.conference.name}
            toggle={() =>
              setOpen(open === g.conference.name ? null : g.conference.name)
            }
            save={save}
            onContact={onContact}
            onAdd={onAdd}
            onScan={onScan}
            disabled={!!error}
          />
        ))}
      </div>
      {cards.some((c) => !c.event.trim()) && (
        <p className="conference-footnote">
          {trf(
            "{count} kontakter er uden konference. Tilføj et eventnavn på kontaktens profil for at gruppere dem.",
            { count: cards.filter((c) => !c.event.trim()).length },
          )}
        </p>
      )}
    </section>
  );
}
function ConferenceGroup({
  group,
  open,
  toggle,
  save,
  onContact,
  onAdd,
  onScan,
  disabled,
}: {
  group: ReturnType<typeof conferenceGroups>[number];
  open: boolean;
  toggle: () => void;
  save: (c: Conference) => Promise<Conference>;
  onContact: (c: Card) => void;
  onAdd: (name: string) => void;
  onScan: (name: string) => void;
  disabled: boolean;
}) {
  const { conference, contacts } = group;
  const [draft, setDraft] = useState(conference),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => setDraft(conference), [conference.id, conference.updated_at]);
  const dueContacts = contacts.filter(
    (c) => c.follow_up && c.follow_up <= today() && c.status !== "Arkiveret",
  ).length;
  const due =
    !conference.completed &&
    conference.follow_up &&
    conference.follow_up <= today();
  return (
    <article className={"conference-panel " + (open ? "is-open" : "")}>
      <button
        className="conference-heading"
        onClick={toggle}
        aria-expanded={open}
      >
        <span className="conference-symbol">
          <CalendarDays size={23} />
        </span>
        <span className="conference-title">
          <strong>{conference.name}</strong>
          <span>
            {conference.date && date(conference.date)}
            {conference.location && <> · {conference.location}</>}
            {!conference.date &&
              !conference.location &&
              tr("Tilføj dato og sted")}
          </span>
        </span>
        <span className="conference-badges">
          <span>
            {contacts.length} {tr("kontakter")}
          </span>
          {dueContacts > 0 && (
            <span className="attention">
              {dueContacts} {tr("skal følges op")}
            </span>
          )}
          {conference.completed ? (
            <span className="done">
              <Check size={13} />
              {tr("Fælles opfølgning afsluttet")}
            </span>
          ) : due ? (
            <span className="attention">
              {tr("Fælles opfølgning forfalder")}
            </span>
          ) : conference.follow_up ? (
            <span>{date(conference.follow_up)}</span>
          ) : null}
        </span>
        {open ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>
      {open && (
        <div className="conference-body">
          <div className="conference-people">
            <div className="conference-section-heading">
              <h2>{tr("Mennesker du mødte")}</h2>
              <div>
                <button
                  className="secondary"
                  onClick={() => onAdd(conference.name)}
                >
                  <Plus size={15} />
                  {tr("Tilføj kontakt")}
                </button>
                <button
                  className="secondary"
                  onClick={() => onScan(conference.name)}
                >
                  <ScanLine size={15} />
                  {tr("Scan")}
                </button>
              </div>
            </div>
            {!contacts.length && (
              <p className="conference-muted">
                {tr(
                  "Ingen kontakter endnu. Tilføj den første, eller scan et visitkort.",
                )}
              </p>
            )}
            {[...contacts]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => (
                <div className="conference-person" key={c.id}>
                  <button
                    className="conference-person-toggle"
                    aria-expanded={expanded === c.id}
                    onClick={() =>
                      setExpanded(expanded === c.id ? null : c.id!)
                    }
                  >
                    <span className="conference-avatar">
                      {c.name
                        .split(/\s+/)
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <span>
                      <strong>{c.name}</strong>
                      <small>{c.company || c.title || tr("Kontakt")}</small>
                    </span>
                    {c.follow_up && c.status !== "Arkiveret" && (
                      <span
                        className={c.follow_up <= today() ? "attention" : ""}
                      >
                        {date(c.follow_up)}
                      </span>
                    )}
                    {expanded === c.id ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </button>
                  {expanded === c.id && (
                    <div className="conference-person-detail">
                      {c.title && <p>{c.title}</p>}
                      {c.email && (
                        <a href={"mailto:" + c.email}>
                          <Mail size={15} />
                          {c.email}
                        </a>
                      )}
                      {(c.mobile || c.phone) && (
                        <a
                          href={
                            "tel:" +
                            (c.mobile || c.phone).replace(/[^\d+]/g, "")
                          }
                        >
                          <Phone size={15} />
                          {c.mobile || c.phone}
                        </a>
                      )}
                      {c.notes && <p className="conference-note">{c.notes}</p>}
                      {c.next_action && (
                        <p>
                          <strong>{tr("Næste skridt")}: </strong>
                          {c.next_action}
                        </p>
                      )}
                      <button
                        className="secondary"
                        onClick={() => onContact(c)}
                      >
                        {tr("Åbn kontakt")}
                        <ArrowUpRight size={15} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
          <form
            className="conference-followup"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setMessage("");
              try {
                await save(draft);
                setMessage(tr("Gemt"));
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <span className="eyebrow">{tr("DET FÆLLES OVERBLIK")}</span>
            <h2>{tr("Konference & opfølgning")}</h2>
            <p className="conference-muted">
              {tr(
                "Noter og handlinger for hele konferencen. Kontaktopfølgninger vises separat.",
              )}
            </p>
            <div className="conference-fields">
              <label>
                {tr("Dato")}
                <input
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                />
              </label>
              <label>
                {tr("Sted")}
                <input
                  maxLength={1000}
                  value={draft.location}
                  onChange={(e) =>
                    setDraft({ ...draft, location: e.target.value })
                  }
                />
              </label>
            </div>
            <label>
              {tr("Noter & udbytte")}
              <textarea
                rows={5}
                maxLength={10000}
                placeholder={tr("Vigtigste indsigter, aftaler og muligheder…")}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </label>
            <label>
              {tr("Fælles næste handling")}
              <textarea
                rows={2}
                maxLength={1000}
                placeholder={tr(
                  "Fx del et resumé, send materiale eller planlæg næste møde",
                )}
                value={draft.next_action}
                onChange={(e) =>
                  setDraft({ ...draft, next_action: e.target.value })
                }
              />
            </label>
            <label>
              {tr("Opfølgningsdato")}
              <input
                type="date"
                value={draft.follow_up}
                onChange={(e) =>
                  setDraft({ ...draft, follow_up: e.target.value })
                }
              />
            </label>
            <label className="conference-check">
              <input
                type="checkbox"
                checked={draft.completed}
                onChange={(e) =>
                  setDraft({ ...draft, completed: e.target.checked })
                }
              />
              {tr("Fælles opfølgning afsluttet")}
            </label>
            <button
              className="primary"
              disabled={busy || disabled}
              type="submit"
            >
              <Save size={16} />
              {busy ? tr("Gemmer…") : tr("Gem konference")}
            </button>
            <span role="status">{message}</span>
          </form>
        </div>
      )}
    </article>
  );
}
