import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Users,
  ScanLine,
  CalendarClock,
  ContactRound,
  Settings,
  Search,
  Plus,
  ArrowUpRight,
  ChevronRight,
  ArrowLeft,
  Check,
  Mail,
  Phone,
  Globe,
  MapPin,
  Building2,
  Share2,
  Star,
  MoreHorizontal,
  X,
  Camera,
  ImagePlus,
  QrCode,
  Upload,
  Download,
  LogOut,
  Lock,
  LoaderCircle,
  Trash2,
  ExternalLink,
  Copy,
  CheckCheck,
  NotebookPen,
  MessageSquare,
  Link as LinkIcon,
  WifiOff,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import QRCode from "qrcode";
import type { IScannerControls } from "@zxing/browser";
const qrReader = async () =>
  new (await import("@zxing/browser")).BrowserQRCodeReader();
import {
  blankCard,
  publicFields,
  parseQR,
  vcard,
  csv,
  safeWeb,
  type Card,
  type Interaction,
  type Share,
} from "./model";
import {
  api,
  upload,
  download,
  shrink,
  storeDraft,
  drafts,
  deleteDraft,
  type Draft,
} from "./api";
import "./style.css";
const today = () => new Date().toLocaleDateString("sv-SE");
const date = (v: string) =>
  v
    ? new Date(v.length === 10 ? v + "T12:00:00" : v).toLocaleDateString(
        "da-DK",
        { day: "numeric", month: "short", year: "numeric" },
      )
    : "";
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
const labels: Record<string, string> = {
  name: "Fulde navn",
  title: "Titel / stilling",
  company: "Selskab",
  email: "E-mail",
  phone: "Telefon (arbejde)",
  mobile: "Mobil",
  website: "Website",
  linkedin: "LinkedIn",
  address: "Adresse",
};
const statusNames = [
  "Ny kontakt",
  "I dialog",
  "Aktiv relation",
  "Afventer",
  "Arkiveret",
];
function Avatar({
  card,
  large = false,
  publicPhoto,
}: {
  card: Partial<Card>;
  large?: boolean;
  publicPhoto?: string;
}) {
  return (
    <div
      className={"avatar " + (large ? "large" : "")}
      style={{
        background: ["#e6eee9", "#eeeadf", "#e2eaf0", "#f1e4e3"][
          (card.name || "").length % 4
        ],
      }}
    >
      {publicPhoto || card.portrait_id ? (
        <img src={publicPhoto || `/api/files/${card.portrait_id}`} alt="" />
      ) : (
        initials(card.name || "")
      )}
    </div>
  );
}
function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <ContactRound size={30} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function QR({ value }: { value: string }) {
  const [src, setSrc] = useState(""),
    [err, setErr] = useState("");
  useEffect(() => {
    setErr("");
    QRCode.toDataURL(value, {
      width: 420,
      margin: 3,
      errorCorrectionLevel: "M",
      color: { dark: "#102d35", light: "#ffffff" },
    })
      .then(setSrc)
      .catch(() =>
        setErr(
          "For mange detaljer til en QR-kode. Brug profillinket eller vCard-filen.",
        ),
      );
  }, [value]);
  return err ? (
    <p className="warning">{err}</p>
  ) : src ? (
    <img className="qr" src={src} alt="QR-kode til kontaktoplysninger" />
  ) : (
    <LoaderCircle className="spin" />
  );
}
function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prior = document.activeElement as HTMLElement;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const modal = document.querySelector(".modal");
        const nodes = Array.from(
          modal?.querySelectorAll<HTMLElement>(
            "button:not([disabled]),input,select,textarea,a[href]",
          ) || [],
        ).filter((x) => x.offsetParent !== null);
        if (nodes.length && e.shiftKey && document.activeElement === nodes[0]) {
          e.preventDefault();
          nodes.at(-1)!.focus();
        } else if (
          nodes.length &&
          !e.shiftKey &&
          document.activeElement === nodes.at(-1)
        ) {
          e.preventDefault();
          nodes[0].focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    setTimeout(
      () => document.querySelector<HTMLElement>(".modal button")?.focus(),
      10,
    );
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
      prior?.focus();
    };
  }, []);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={"modal " + (wide ? "wide" : "")}
      >
        <header>
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn" aria-label="Luk" onClick={onClose}>
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function App() {
  const [auth, setAuth] = useState<boolean | null>(null),
    [configured, setConfigured] = useState(true),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  const [cards, setCards] = useState<Card[]>([]),
    [profile, setProfile] = useState<Card>(blankCard),
    [shares, setShares] = useState<Share[]>([]),
    [pending, setPending] = useState<Draft[]>([]);
  const [page, setPage] = useState("Overblik"),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("Alle"),
    [selected, setSelected] = useState<Card | null>(null),
    [edit, setEdit] = useState<Card | null>(null),
    [editProfile, setEditProfile] = useState(false),
    [scan, setScan] = useState(false),
    [shareCard, setShareCard] = useState<Card | null>(null),
    [toast, setToast] = useState(""),
    [event, setEvent] = useState(
      () => localStorage.getItem("visitkort-event") || "",
    ),
    [online, setOnline] = useState(navigator.onLine);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);
  const publicToken = location.pathname.match(/^\/p\/([a-f0-9]{64})$/)?.[1];
  function notify(s: string) {
    setToast(s);
    setTimeout(() => setToast(""), 4500);
  }
  async function load() {
    const [c, p, s] = await Promise.all([
      api<Card[]>("/contacts"),
      api<Card>("/profile"),
      api<Share[]>("/shares"),
    ]);
    setCards(c);
    setProfile(p);
    setShares(s);
    setSelected((prev) =>
      prev ? c.find((x) => x.id === prev.id) || null : null,
    );
  }
  useEffect(() => {
    if (publicToken) return;
    api("/session")
      .then((r) => {
        setAuth(r.authenticated);
        setConfigured(r.configured);
        if (r.authenticated) load().catch((e) => setError(e.message));
      })
      .catch((e) => {
        setAuth(false);
        setError(e.message);
      });
    drafts()
      .then(setPending)
      .catch(() => {});
    const fn = () => setOnline(navigator.onLine);
    window.addEventListener("online", fn);
    window.addEventListener("offline", fn);
    return () => {
      window.removeEventListener("online", fn);
      window.removeEventListener("offline", fn);
    };
  }, []);
  useEffect(() => localStorage.setItem("visitkort-event", event), [event]);
  async function run(action: () => Promise<void>) {
    try {
      await action();
    } catch (e) {
      notify((e as Error).message);
    }
  }
  if (publicToken) return <PublicCard token={publicToken} />;
  if (auth === null)
    return (
      <div className="center">
        <LoaderCircle className="spin" />
        <p>Åbner dit netværk…</p>
      </div>
    );
  if (!auth)
    return (
      <div className="login">
        <div className="login-brand">
          <div className="brand-mark">
            <ContactRound />
          </div>
          <h1>
            Gode relationer
            <br />
            starter med et møde.
          </h1>
          <p>
            Et visitkort er begyndelsen.
            <br />
            Her holder du forbindelsen.
          </p>
          <div className="login-decoration">
            <span>Dit netværk</span>
            <ContactRound size={80} />
            <span>Samlet ét sted</span>
          </div>
        </div>
        <div className="login-form">
          <span className="eyebrow">DIT PRIVATE NETVÆRK</span>
          <h2>Velkommen tilbage</h2>
          <p>Log ind for at se dine kontakter og følge op.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy("login");
              setError("");
              try {
                await api("/login", {
                  method: "POST",
                  body: JSON.stringify({ password }),
                });
                setPassword("");
                setAuth(true);
                await load();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy("");
              }
            }}
          >
            <label>
              Adgangskode
              <input
                type="password"
                autoComplete="current-password"
                autoFocus
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="warning">
                {error}
              </p>
            )}
            {!configured && (
              <p className="warning">
                Appen er endnu ikke konfigureret. Følg INSTALLATION.md for
                database og login.
              </p>
            )}
            <button className="primary full" disabled={!!busy || !configured}>
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Lock size={18} />
              )}
              Åbn Visitkort
            </button>
          </form>
          <div className="private-hint">
            <ShieldCheck size={17} /> Kun du har adgang til kontaktbiblioteket.
          </div>
          {!online && (
            <OfflineCapture
              event={event}
              onSaved={async () => {
                setPending(await drafts());
                notify("Foto gemt som kladde på denne enhed.");
              }}
            />
          )}
          {pending.length > 0 && (
            <p>{pending.length} scanningskladder gemt på denne enhed.</p>
          )}
        </div>
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  const due = cards
    .filter(
      (c) => c.follow_up && c.follow_up <= today() && c.status !== "Arkiveret",
    )
    .sort((a, b) => a.follow_up.localeCompare(b.follow_up));
  const allFollow = cards
    .filter((c) => c.follow_up && c.status !== "Arkiveret")
    .sort((a, b) => a.follow_up.localeCompare(b.follow_up));
  const filtered = cards.filter(
    (c) =>
      (status === "Alle" ||
        (status === "Favoritter" && c.favorite) ||
        status === c.status) &&
      [c.name, c.company, c.email, c.title, c.event, c.notes, ...c.tags]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const profileShare = shares.find((s) => s.kind === "profile" && !s.revoked);
  async function save(c: Card) {
    setBusy("save");
    try {
      if (editProfile) {
        const p = await api<Card>("/profile", {
          method: "PUT",
          body: JSON.stringify(c),
        });
        setProfile(p);
      } else {
        const saved = await api<Card>("/contacts" + (c.id ? "/" + c.id : ""), {
          method: c.id ? "PUT" : "POST",
          body: JSON.stringify(c),
        });
        setSelected(saved);
        setPage("Kontakter");
      }
      setEdit(null);
      setEditProfile(false);
      await load();
      notify("Gemt");
    } finally {
      setBusy("");
    }
  }
  async function photoScan(file: File, draft?: Draft) {
    setBusy("scan");
    let id = "";
    try {
      id = await upload(file);
      let c = {
        ...blankCard(),
        event: draft?.event || event,
        met_at: today(),
        photo_ids: [id],
      };
      try {
        const result = await api("/scan", {
          method: "POST",
          body: JSON.stringify({ file_id: id }),
        });
        c = {
          ...c,
          ...result.card,
          event: c.event,
          met_at: c.met_at,
          photo_ids: [id],
        };
      } catch (e) {
        notify((e as Error).message);
      }
      setScan(false);
      setEditProfile(false);
      setEdit(c);
      if (draft) {
        await deleteDraft(draft.id);
        setPending(await drafts());
      }
    } catch (e) {
      if (!navigator.onLine) {
        if (!draft) await storeDraft(await shrink(file), event);
        setPending(await drafts());
        setScan(false);
        notify("Foto gemt som kladde. Scan det, når du er online.");
      } else throw e;
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="/" className="brand">
          <span className="brand-mark">
            <ContactRound size={23} />
          </span>
          visitkort<span className="brand-dot">.</span>
        </a>
        <span className="nav-caption">DIT NETVÆRK</span>
        <nav>
          {[
            [LayoutDashboard, "Overblik"],
            [Users, "Kontakter"],
            [CalendarClock, "Opfølgning"],
            [ContactRound, "Mit visitkort"],
            [Settings, "Indstillinger"],
          ].map(([Icon, name]) => {
            const I = Icon as typeof Users;
            return (
              <button
                key={String(name)}
                className={page === name ? "active" : ""}
                onClick={() => {
                  setPage(String(name));
                  setSelected(null);
                  setQuery("");
                }}
              >
                <I size={20} />
                {String(name)}
                {name === "Opfølgning" && due.length > 0 && (
                  <span className="nav-count">{due.length}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-tip">
          <QrCode size={24} />
          <strong>
            Dit næste møde.
            <br />
            Din næste forbindelse.
          </strong>
          <p>Del dit eget visitkort med en QR-kode.</p>
          <button onClick={() => setPage("Mit visitkort")}>
            Åbn mit visitkort <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="owner">
          <Avatar card={profile.name ? profile : { name: "Privat bruger" }} />
          <div>
            <strong>{profile.name || "Dit private netværk"}</strong>
            <span>
              <Lock size={11} /> Personligt bibliotek
            </span>
          </div>
          <button
            className="icon-btn"
            aria-label="Log ud"
            onClick={() =>
              run(async () => {
                await api("/logout", { method: "POST" });
                setCards([]);
                setProfile(blankCard());
                setShares([]);
                setSelected(null);
                setAuth(false);
              })
            }
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span className="breadcrumb">
            Dit netværk <ChevronRight size={14} /> <strong>{page}</strong>
          </span>
          <div className="top-actions">
            <span className={"connection " + (!online ? "offline" : "")}>
              <i />
              {online ? "Privat & online" : "Offline"}
            </span>
            <button className="primary" onClick={() => setScan(true)}>
              <ScanLine size={18} /> <span>Scan visitkort</span>
            </button>
          </div>
        </header>
        {error && (
          <div role="alert" className="warning">
            {error}
            <button
              onClick={() =>
                run(async () => {
                  await load();
                  setError("");
                })
              }
            >
              Prøv igen
            </button>
          </div>
        )}
        {!online && (
          <div className="offline-strip">
            <WifiOff size={17} /> Ingen forbindelse. Du kan gemme fotos som
            scanningskladder.
          </div>
        )}
        <div className="content">
          {page === "Overblik" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">RELATIONER, DER VARER</span>
                  <h1>
                    {profile.name
                      ? `Hej ${profile.name.split(" ")[0]}.`
                      : "Dit netværk, samlet."}
                  </h1>
                  <p>
                    Hold forbindelsen. Gør det næste møde til en god relation.
                  </p>
                </div>
                <button
                  className="secondary"
                  onClick={() => {
                    setEditProfile(false);
                    setEdit({ ...blankCard(), event, met_at: today() });
                  }}
                >
                  <Plus size={17} /> Tilføj kontakt
                </button>
              </div>
              <div className="stats">
                <Stat
                  label="Kontakter i dit netværk"
                  value={cards.length}
                  icon={<Users />}
                  note="Personer, du vil huske"
                />
                <Stat
                  label="Opfølgninger nu"
                  value={due.length}
                  icon={<CalendarClock />}
                  note={due.length ? "Klar til næste skridt" : "Du er helt med"}
                />
                <Stat
                  label="Selskaber"
                  value={
                    new Set(
                      cards
                        .map((c) => c.company.trim().toLowerCase())
                        .filter(Boolean),
                    ).size
                  }
                  icon={<Building2 />}
                  note="Forbindelser på tværs"
                />
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">NÆSTE SKRIDT</span>
                      <h2>Tid til at følge op</h2>
                    </div>
                    <button
                      className="text-btn"
                      onClick={() => setPage("Opfølgning")}
                    >
                      Se alle <ArrowUpRight size={16} />
                    </button>
                  </div>
                  {due.length ? (
                    due.slice(0, 4).map((c) => (
                      <FollowRow
                        key={c.id}
                        card={c}
                        onOpen={() => {
                          setSelected(c);
                          setPage("Kontakter");
                        }}
                        onDone={() =>
                          run(async () => {
                            await api("/contacts/" + c.id, {
                              method: "PUT",
                              body: JSON.stringify({
                                ...c,
                                follow_up: "",
                                next_action: "",
                              }),
                            });
                            await api("/contacts/" + c.id + "/interactions", {
                              method: "POST",
                              body: JSON.stringify({
                                kind: "Opfølgning",
                                happened_at: today(),
                                note:
                                  "Opfølgning afsluttet: " +
                                  (c.next_action || "Kontakt fulgt op"),
                              }),
                            });
                            await load();
                            notify("Opfølgning afsluttet");
                          })
                        }
                      />
                    ))
                  ) : (
                    <Empty
                      title="Plads til næste forbindelse"
                      text="Tilføj en opfølgningsdato på en kontakt. Så husker appen, hvem du skal tage fat i."
                    />
                  )}
                </section>
                <section className="scan-feature">
                  <span className="eyebrow">FRA VISITKORT TIL RELATION</span>
                  <h2>
                    Et foto.
                    <br />
                    En ny forbindelse.
                  </h2>
                  <p>
                    Scan et visitkort eller en QR-kode.
                    <br />
                    Gem detaljerne, mens mødet er frisk.
                  </p>
                  <div className="illustrated-card">
                    <span className="mini-logo">
                      <ContactRound size={22} />
                    </span>
                    <div>
                      <i />
                      <i />
                      <i />
                    </div>
                    <QrCode size={40} />
                  </div>
                  <button onClick={() => setScan(true)}>
                    <ScanLine size={19} /> Scan et visitkort{" "}
                    <ArrowUpRight size={18} />
                  </button>
                </section>
              </div>
              <section className="panel recent">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">NYE FORBINDELSER</span>
                    <h2>Senest tilføjet</h2>
                  </div>
                  <button
                    className="text-btn"
                    onClick={() => setPage("Kontakter")}
                  >
                    Alle kontakter <ArrowUpRight size={16} />
                  </button>
                </div>
                {cards.length ? (
                  <div className="contact-table">
                    <div className="table-head">
                      <span>PERSON</span>
                      <span>SELSKAB</span>
                      <span>MØDESTED</span>
                      <span>STATUS</span>
                    </div>
                    {[...cards]
                      .sort((a, b) =>
                        (b.created_at || "").localeCompare(a.created_at || ""),
                      )
                      .slice(0, 5)
                      .map((c) => (
                        <button
                          className="table-row"
                          key={c.id}
                          onClick={() => {
                            setSelected(c);
                            setPage("Kontakter");
                          }}
                        >
                          <div className="person">
                            <Avatar card={c} />
                            <div>
                              <strong>{c.name}</strong>
                              <small>{c.title || c.email || "Kontakt"}</small>
                            </div>
                          </div>
                          <span>{c.company || "—"}</span>
                          <span>{c.event || "—"}</span>
                          <span>
                            <Badge text={c.status} />
                          </span>
                        </button>
                      ))}
                  </div>
                ) : (
                  <Empty
                    title="Dit netværk starter her"
                    text="Scan dit første visitkort eller opret en kontakt manuelt."
                    action={
                      <button className="primary" onClick={() => setScan(true)}>
                        <ScanLine size={17} /> Scan dit første kort
                      </button>
                    }
                  />
                )}
              </section>
              {pending.length > 0 && (
                <DraftList
                  pending={pending}
                  busy={!!busy}
                  onScan={(d) => run(() => photoScan(d.file, d))}
                  onDelete={(d) =>
                    run(async () => {
                      await deleteDraft(d.id);
                      setPending(await drafts());
                    })
                  }
                />
              )}
            </>
          )}
          {page === "Kontakter" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">MENNESKERNE BAG KORTENE</span>
                  <h1>
                    Kontakter{" "}
                    <span className="title-count">{cards.length}</span>
                  </h1>
                  <p>Søg, find og hold forbindelsen.</p>
                </div>
                <button
                  className="primary"
                  onClick={() => {
                    setEditProfile(false);
                    setEdit({ ...blankCard(), event, met_at: today() });
                  }}
                >
                  <Plus size={18} /> Ny kontakt
                </button>
              </div>
              <div className="contact-workspace">
                <section
                  className={
                    "panel list-panel " + (selected ? "has-selection" : "")
                  }
                >
                  <div className="search-box">
                    <Search size={18} />
                    <input
                      aria-label="Søg kontakter"
                      placeholder="Søg navn, selskab, konference…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <div className="filter-tabs">
                    {["Alle", "Favoritter", ...statusNames].map((s) => (
                      <button
                        key={s}
                        className={status === s ? "selected" : ""}
                        onClick={() => setStatus(s)}
                      >
                        {s === "Favoritter" && <Star size={13} />} {s}
                      </button>
                    ))}
                  </div>
                  <div className="contact-list">
                    {filtered.length ? (
                      filtered.map((c) => (
                        <button
                          className={
                            "contact-row " +
                            (selected?.id === c.id ? "selected" : "")
                          }
                          key={c.id}
                          onClick={() => setSelected(c)}
                        >
                          <Avatar card={c} />
                          <div>
                            <strong>
                              {c.name}{" "}
                              {c.favorite && (
                                <Star size={12} fill="currentColor" />
                              )}
                            </strong>
                            <span>
                              {[c.title, c.company]
                                .filter(Boolean)
                                .join(" · ") || "Kontaktoplysninger"}
                            </span>
                            {c.event && (
                              <small>
                                <MapPin size={11} /> {c.event}
                              </small>
                            )}
                          </div>
                          <ChevronRight size={16} />
                        </button>
                      ))
                    ) : (
                      <Empty
                        title={
                          query ? "Ingen resultater" : "Ingen kontakter endnu"
                        }
                        text={
                          query
                            ? "Prøv et andet navn, selskab eller tag."
                            : "Tilføj din første kontakt med kameraet eller manuelt."
                        }
                      />
                    )}
                  </div>
                </section>
                {selected ? (
                  <ContactDetail
                    card={selected}
                    cards={cards}
                    onBack={() => setSelected(null)}
                    onEdit={() => {
                      setEditProfile(false);
                      setEdit(selected);
                    }}
                    onShare={() => setShareCard(selected)}
                    onChange={(c) =>
                      run(async () => {
                        await api("/contacts/" + c.id, {
                          method: "PUT",
                          body: JSON.stringify(c),
                        });
                        await load();
                      })
                    }
                    onDelete={() =>
                      setConfirm({
                        title: "Slet kontakt?",
                        description: `${selected.name} og kontaktens historik slettes. Delingslinks bliver også fjernet.`,
                        action: async () => {
                          await api("/contacts/" + selected.id, {
                            method: "DELETE",
                          });
                          setSelected(null);
                          await load();
                          notify("Kontakt slettet");
                        },
                      })
                    }
                    onMerge={(remove) =>
                      setConfirm({
                        title: "Sammenlæg kontakter?",
                        description: `Behold ${selected.name}, tilføj manglende felter og historik fra ${remove.name}, og slet dubletten. Dublettens delingslinks deaktiveres.`,
                        action: async () => {
                          await api("/merge", {
                            method: "POST",
                            body: JSON.stringify({
                              keep: selected.id,
                              remove: remove.id,
                            }),
                          });
                          await load();
                          notify("Kontakter sammenlagt");
                        },
                      })
                    }
                    notify={notify}
                  />
                ) : (
                  <div className="detail-placeholder">
                    <ContactRound size={46} />
                    <h3>Et menneske bag hvert kort</h3>
                    <p>
                      Vælg en kontakt for at se detaljer,
                      <br />
                      noter og jeres seneste interaktioner.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
          {page === "Opfølgning" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">HOLD FORBINDELSEN</span>
                  <h1>Det næste skridt.</h1>
                  <p>Dine aftaler med dig selv — samlet ét sted.</p>
                </div>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Planlagte opfølgninger</h2>
                  <span className="pill">{allFollow.length} i alt</span>
                </div>
                {allFollow.length ? (
                  allFollow.map((c) => (
                    <FollowRow
                      key={c.id}
                      card={c}
                      onOpen={() => {
                        setPage("Kontakter");
                        setSelected(c);
                      }}
                      onDone={() =>
                        run(async () => {
                          await api("/contacts/" + c.id, {
                            method: "PUT",
                            body: JSON.stringify({
                              ...c,
                              follow_up: "",
                              next_action: "",
                            }),
                          });
                          await api("/contacts/" + c.id + "/interactions", {
                            method: "POST",
                            body: JSON.stringify({
                              kind: "Opfølgning",
                              happened_at: today(),
                              note:
                                "Afsluttet: " + (c.next_action || "Opfølgning"),
                            }),
                          });
                          await load();
                          notify("Afsluttet");
                        })
                      }
                    />
                  ))
                ) : (
                  <Empty
                    title="Ingen planlagte opfølgninger"
                    text="Åbn en kontakt og vælg en dato og næste handling."
                  />
                )}
              </section>
            </>
          )}
          {page === "Mit visitkort" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">GØR DET NEMT AT HOLDE KONTAKT</span>
                  <h1>Dit digitale visitkort.</h1>
                  <p>Alle dine detaljer. Klar til næste møde.</p>
                </div>
                <button
                  className="primary"
                  onClick={() => {
                    setEditProfile(true);
                    setEdit(profile);
                  }}
                >
                  <NotebookPen size={18} /> Rediger mit kort
                </button>
              </div>
              <div className="profile-grid">
                <div className="my-card">
                  <div className="card-top">
                    <span>PERSONLIGT VISITKORT</span>
                    <ContactRound />
                  </div>
                  <Avatar card={profile} large />
                  <h2>{profile.name || "Dit navn"}</h2>
                  <p>
                    {profile.title || "Din titel"}
                    {profile.company && (
                      <>
                        <br />
                        <strong>{profile.company}</strong>
                      </>
                    )}
                  </p>
                  <div className="my-card-line" />
                  {profile.email && (
                    <span>
                      <Mail size={17} />
                      {profile.email}
                    </span>
                  )}
                  {(profile.mobile || profile.phone) && (
                    <span>
                      <Phone size={17} />
                      {profile.mobile || profile.phone}
                    </span>
                  )}
                  {profile.website && (
                    <span>
                      <Globe size={17} />
                      {profile.website}
                    </span>
                  )}
                  <div className="card-bottom">Et møde er kun begyndelsen.</div>
                </div>
                <section className="panel share-profile">
                  <span className="eyebrow">DEL DIN FORBINDELSE</span>
                  <h2>Scan. Gem. Hold kontakt.</h2>
                  {profile.name ? (
                    <>
                      <ProfileQR
                        profile={profile}
                        share={profileShare}
                        onActivate={() =>
                          run(async () => {
                            await api("/shares", {
                              method: "POST",
                              body: JSON.stringify({
                                kind: "profile",
                                include_photo: true,
                              }),
                            });
                            await load();
                            notify("Offentligt visitkort aktiveret");
                          })
                        }
                      />
                      <div className="button-row">
                        <button
                          className="secondary"
                          onClick={() =>
                            download(
                              "mit-visitkort.vcf",
                              vcard(profile),
                              "text/vcard",
                            )
                          }
                        >
                          <Download size={16} /> Kontaktfil
                        </button>
                        {profileShare && (
                          <button
                            className="primary"
                            onClick={() =>
                              run(() =>
                                shareLink(
                                  location.origin + "/p/" + profileShare.token,
                                  profile.name,
                                  notify,
                                ),
                              )
                            }
                          >
                            <Share2 size={16} /> Del link
                          </button>
                        )}
                      </div>
                      {profileShare && (
                        <p className="fineprint">
                          Alle med linket kan se dine kontaktoplysninger og dit
                          billede. De kan ikke se kontaktbiblioteket eller dine
                          noter. Ændringer i dit kort vises automatisk.
                        </p>
                      )}
                    </>
                  ) : (
                    <Empty
                      title="Sæt ansigt på dit netværk"
                      text="Tilføj dine detaljer og et profilbillede for at gøre dit visitkort klar."
                      action={
                        <button
                          className="primary"
                          onClick={() => {
                            setEditProfile(true);
                            setEdit(profile);
                          }}
                        >
                          Opret mit visitkort
                        </button>
                      }
                    />
                  )}
                </section>
              </div>
            </>
          )}
          {page === "Indstillinger" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">DU HAR KONTROLLEN</span>
                  <h1>Dit bibliotek.</h1>
                  <p>Administrér eksport, deling og dine scanningskladder.</p>
                </div>
              </div>
              <div className="settings-grid">
                <section className="panel padded">
                  <h2>Konferencetilstand</h2>
                  <p>
                    Brug samme mødested til alle nye kontakter, indtil du ændrer
                    det.
                  </p>
                  <label>
                    Aktuelt event / mødested
                    <input
                      value={event}
                      placeholder="Fx konference, København, oktober 2026"
                      onChange={(e) => setEvent(e.target.value)}
                    />
                  </label>
                  <p className="fineprint">
                    Gemmes på denne enhed og foreslås ved nye scanninger.
                  </p>
                </section>
                <section className="panel padded">
                  <h2>Eksport & import</h2>
                  <p>Tag dine kontakter med dig.</p>
                  <div className="button-row wrap">
                    <button
                      className="secondary"
                      onClick={() =>
                        download(
                          "visitkort.csv",
                          csv(cards),
                          "text/csv;charset=utf-8",
                        )
                      }
                    >
                      <Download size={16} /> CSV / Excel
                    </button>
                    <button
                      className="secondary"
                      onClick={() =>
                        download(
                          "kontakter.vcf",
                          cards.map(vcard).join(""),
                          "text/vcard",
                        )
                      }
                    >
                      <Download size={16} /> Alle kontakter
                    </button>
                    <button
                      className="secondary"
                      onClick={() =>
                        run(async () =>
                          download(
                            "visitkort-backup.json",
                            JSON.stringify(await api("/export"), null, 2),
                            "application/json",
                          ),
                        )
                      }
                    >
                      <Download size={16} /> JSON-eksport
                    </button>
                    <label className="secondary file-label">
                      <Upload size={16} /> Importér JSON
                      <input
                        type="file"
                        accept=".json"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file)
                            run(async () => {
                              const data = JSON.parse(await file.text());
                              setConfirm({
                                title: "Importér kontaktbibliotek?",
                                description:
                                  "Kontakter og historik tilføjes som nye poster. Billeder medfølger ikke. Dit eget visitkort ændres ikke.",
                                action: async () => {
                                  const r = await api("/import", {
                                    method: "POST",
                                    body: JSON.stringify(data),
                                  });
                                  await load();
                                  notify(`${r.count} kontakter importeret`);
                                },
                              });
                            });
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <p className="fineprint">
                    JSON indeholder kontakter, historik og egne profildata, men
                    ikke billeder. Import tilføjer kontakter og historik;
                    profilen skal udfyldes separat. CSV- og vCard-eksport
                    indeholder ingen interaktionshistorik.
                  </p>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Delingslinks</h2>
                  <span className="pill">
                    {
                      shares.filter(
                        (s) =>
                          !s.revoked &&
                          (!s.expires_at ||
                            s.expires_at > new Date().toISOString()),
                      ).length
                    }{" "}
                    aktive
                  </span>
                </div>
                {shares.length ? (
                  shares.map((s) => (
                    <div className="sharing-row" key={s.token}>
                      <div>
                        <strong>
                          {s.kind === "profile"
                            ? "Mit offentlige visitkort"
                            : s.name}
                        </strong>
                        <small>
                          {s.revoked
                            ? "Deaktiveret"
                            : s.expires_at
                              ? `Udløber ${date(s.expires_at)}`
                              : "Aktivt indtil du deaktiverer det"}
                        </small>
                      </div>
                      {!s.revoked && (
                        <>
                          <button
                            className="icon-btn"
                            aria-label="Kopiér link"
                            onClick={() =>
                              run(async () => {
                                await navigator.clipboard.writeText(
                                  location.origin + "/p/" + s.token,
                                );
                                notify("Link kopieret");
                              })
                            }
                          >
                            <Copy size={17} />
                          </button>
                          <button
                            className="danger text-btn"
                            onClick={() =>
                              setConfirm({
                                title: "Deaktivér delingslink?",
                                description:
                                  "Linket og QR-koden til linket vil ikke længere åbne visitkortet. Allerede importerede kontaktfiler kan ikke tilbagekaldes.",
                                action: async () => {
                                  await api("/shares/" + s.token, {
                                    method: "DELETE",
                                  });
                                  await load();
                                  notify("Link deaktiveret");
                                },
                              })
                            }
                          >
                            Deaktivér
                          </button>
                        </>
                      )}
                    </div>
                  ))
                ) : (
                  <Empty
                    title="Ingen delingslinks"
                    text="Du kan dele dit eget kort eller en valgt kontakt."
                  />
                )}
              </section>
              {pending.length > 0 && (
                <DraftList
                  pending={pending}
                  busy={!!busy}
                  onScan={(d) => run(() => photoScan(d.file, d))}
                  onDelete={(d) =>
                    run(async () => {
                      await deleteDraft(d.id);
                      setPending(await drafts());
                    })
                  }
                />
              )}
              <p className="fineprint">
                Visitkort 1.0 · Privat bibliotek · Kontaktfiler og delingslinks
                sendes kun, når du selv vælger at dele.
              </p>
            </>
          )}
        </div>
      </main>
      <nav className="mobile-nav">
        {[
          [LayoutDashboard, "Overblik"],
          [Users, "Kontakter"],
          [ScanLine, "Scan"],
          [CalendarClock, "Opfølgning"],
          [ContactRound, "Mit visitkort"],
        ].map(([Icon, name]) => {
          const I = Icon as typeof Users;
          return (
            <button
              key={String(name)}
              className={page === name ? "active" : ""}
              onClick={() => {
                if (name === "Scan") setScan(true);
                else {
                  setPage(String(name));
                  setSelected(null);
                }
              }}
            >
              <I size={21} />
              <span>
                {name === "Mit visitkort" ? "Mit kort" : String(name)}
              </span>
            </button>
          );
        })}
        <button
          className="mobile-settings"
          aria-label="Indstillinger"
          onClick={() => setPage("Indstillinger")}
        >
          <Settings size={19} />
        </button>
      </nav>
      {edit && (
        <EditCard
          initial={edit}
          own={editProfile}
          cards={cards}
          busy={busy === "save"}
          onSave={(c) => run(() => save(c))}
          onClose={() => {
            setEdit(null);
            setEditProfile(false);
          }}
          notify={notify}
        />
      )}
      {scan && (
        <ScanModal
          busy={busy === "scan"}
          event={event}
          onEvent={setEvent}
          onClose={() => setScan(false)}
          onPhoto={(f) => run(() => photoScan(f))}
          onQR={(c) =>
            run(async () => {
              let imported = c;
              if (c.website) {
                const u = new URL(c.website);
                const match = u.pathname.match(/^\/p\/([a-f0-9]{64})$/);
                if (u.origin === location.origin && match) {
                  const data = await api("/public/" + match[1]);
                  imported = {
                    ...blankCard(),
                    ...data,
                    portrait_id: "",
                    photo_ids: [],
                  };
                } else
                  notify(
                    "QR-koden indeholder et weblink. Kontaktdata kan udfyldes manuelt.",
                  );
              }
              setScan(false);
              setEditProfile(false);
              setEdit({ ...imported, event, met_at: today() });
            })
          }
          onManual={() => {
            setScan(false);
            setEditProfile(false);
            setEdit({ ...blankCard(), event, met_at: today() });
          }}
          notify={notify}
        />
      )}
      {shareCard && (
        <ShareModal
          card={shareCard}
          onClose={() => setShareCard(null)}
          onShared={() => load()}
          notify={notify}
        />
      )}
      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(null)}>
          <div className="padded">
            <p>{confirm.description}</p>
            <div className="button-row">
              <button className="secondary" onClick={() => setConfirm(null)}>
                Annullér
              </button>
              <button
                className="primary"
                disabled={!!busy}
                onClick={() =>
                  run(async () => {
                    setBusy("confirm");
                    try {
                      await confirm.action();
                      setConfirm(null);
                    } finally {
                      setBusy("");
                    }
                  })
                }
              >
                Bekræft
              </button>
            </div>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  icon,
  note,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  note: string;
}) {
  return (
    <div className="stat">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
      <div className="stat-icon">{icon}</div>
    </div>
  );
}
function Badge({ text }: { text: string }) {
  return (
    <span
      className={
        "badge " +
        (text === "Aktiv relation"
          ? "green"
          : text === "I dialog"
            ? "blue"
            : "")
      }
    >
      <i />
      {text}
    </span>
  );
}
function FollowRow({
  card,
  onOpen,
  onDone,
}: {
  card: Card;
  onOpen: () => void;
  onDone: () => void;
}) {
  return (
    <div className="follow-row">
      <button className="follow-person" onClick={onOpen}>
        <Avatar card={card} />
        <div>
          <strong>{card.name}</strong>
          <span>{card.next_action || "Følg op på relationen"}</span>
          <small>{card.company}</small>
        </div>
      </button>
      <span
        className={"due-date " + (card.follow_up < today() ? "overdue" : "")}
      >
        {card.follow_up === today() ? "I dag" : date(card.follow_up)}
      </span>
      <button
        className="done-btn"
        title="Markér som afsluttet"
        aria-label={"Afslut opfølgning for " + card.name}
        onClick={onDone}
      >
        <Check size={17} />
      </button>
    </div>
  );
}
async function shareLink(
  url: string,
  title: string,
  notify: (s: string) => void,
) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text: title, url });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  await navigator.clipboard.writeText(url);
  notify("Link kopieret — klar til at sende");
}
function ProfileQR({
  profile,
  share,
  onActivate,
}: {
  profile: Card;
  share?: Share;
  onActivate: () => void;
}) {
  const [mode, setMode] = useState("data");
  return (
    <>
      <div className="segment">
        <button
          className={mode === "data" ? "active" : ""}
          onClick={() => setMode("data")}
        >
          Kontaktdata i QR
        </button>
        <button
          className={mode === "link" ? "active" : ""}
          onClick={() => setMode("link")}
        >
          Profil med billede
        </button>
      </div>
      {mode === "data" ? (
        <>
          <QR value={vcard(profile)} />
          <p className="fineprint">
            Kontaktdata ligger direkte i koden. Billedet medfølger via
            profillinket.
          </p>
        </>
      ) : share ? (
        <>
          <QR value={location.origin + "/p/" + share.token} />
          <a
            className="text-btn"
            href={"/p/" + share.token}
            target="_blank"
            rel="noreferrer"
          >
            Vis offentligt kort <ExternalLink size={14} />
          </a>
        </>
      ) : (
        <div className="activate-card">
          <LinkIcon size={28} />
          <p>
            Aktivér en offentlig profil med dine kontaktoplysninger og dit
            billede.
          </p>
          <button className="primary" onClick={onActivate}>
            Aktivér profillink
          </button>
        </div>
      )}
    </>
  );
}
function ContactDetail({
  card,
  cards,
  onBack,
  onEdit,
  onShare,
  onChange,
  onDelete,
  onMerge,
  notify,
}: {
  card: Card;
  cards: Card[];
  onBack: () => void;
  onEdit: () => void;
  onShare: () => void;
  onChange: (c: Card) => void;
  onDelete: () => void;
  onMerge: (c: Card) => void;
  notify: (s: string) => void;
}) {
  const [history, setHistory] = useState<Interaction[]>([]),
    [note, setNote] = useState(""),
    [kind, setKind] = useState("Note"),
    [when, setWhen] = useState(today()),
    [tab, setTab] = useState("Historik"),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setHistory([]);
    setNote("");
    setKind("Note");
    setWhen(today());
    api<Interaction[]>("/contacts/" + card.id + "/interactions")
      .then(setHistory)
      .catch((e) => notify(e.message));
  }, [card.id]);
  const normalPhone = (c: Card) => (c.mobile || c.phone).replace(/\D/g, "");
  const duplicates = cards.filter(
    (c) =>
      c.id !== card.id &&
      ((c.email &&
        card.email &&
        c.email.toLowerCase() === card.email.toLowerCase()) ||
        (normalPhone(c) && normalPhone(c) === normalPhone(card))),
  );
  return (
    <section className="panel detail-panel">
      <div className="detail-actions">
        <button
          className="icon-btn mobile-back"
          aria-label="Tilbage til kontaktliste"
          onClick={onBack}
        >
          <ArrowLeft />
        </button>
        <span className="eyebrow">KONTAKTDETALJER</span>
        <div>
          <button
            className={"icon-btn " + (card.favorite ? "favorite" : "")}
            aria-label="Skift favorit"
            onClick={() => onChange({ ...card, favorite: !card.favorite })}
          >
            <Star size={19} fill={card.favorite ? "currentColor" : "none"} />
          </button>
          <button
            className="icon-btn"
            aria-label="Slet kontakt"
            onClick={onDelete}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      <div className="detail-identity">
        <Avatar card={card} large />
        <h2>{card.name}</h2>
        <p>{card.title}</p>
        {card.company && (
          <span>
            <Building2 size={14} />
            {card.company}
          </span>
        )}
        <Badge text={card.status} />
      </div>
      <div className="button-row detail-buttons">
        <button className="primary" onClick={onShare}>
          <Share2 size={16} /> Del kontakt
        </button>
        <button className="secondary" onClick={onEdit}>
          <NotebookPen size={16} /> Rediger
        </button>
        <button
          className="icon-btn"
          title="Gem i telefonens kontakter"
          aria-label="Hent kontaktfil"
          onClick={() => download("kontakt.vcf", vcard(card), "text/vcard")}
        >
          <Download size={19} />
        </button>
      </div>
      <div className="detail-links">
        {card.email && (
          <a href={"mailto:" + card.email}>
            <Mail size={17} />
            <span>{card.email}</span>
            <ArrowUpRight size={14} />
          </a>
        )}
        {[card.mobile, card.phone].filter(Boolean).map((p, i) => (
          <a key={i} href={"tel:" + p.replace(/[^\d+]/g, "")}>
            <Phone size={17} />
            <span>{p}</span>
            <ArrowUpRight size={14} />
          </a>
        ))}
        {[card.website, card.linkedin].filter(Boolean).map((p, i) => (
          <a key={i} href={safeWeb(p)} target="_blank" rel="noreferrer">
            <Globe size={17} />
            <span>{p}</span>
            <ArrowUpRight size={14} />
          </a>
        ))}
        {card.address && (
          <div>
            <MapPin size={17} />
            {card.address}
          </div>
        )}
      </div>
      {card.event && (
        <div className="met-box">
          <MapPin size={17} />
          <div>
            <small>I MØDTES HER</small>
            <strong>{card.event}</strong>
            {card.met_at && <span>{date(card.met_at)}</span>}
          </div>
        </div>
      )}
      <div className="tag-list">
        {card.tags.map((t) => (
          <span className="tag" key={t}>
            {t}
          </span>
        ))}
      </div>
      {duplicates.length > 0 && (
        <div className="warning">
          Mulig dublet:{" "}
          {duplicates.map((c) => (
            <button className="text-btn" key={c.id} onClick={() => onMerge(c)}>
              {c.name} · Sammenlæg
            </button>
          ))}
        </div>
      )}
      <div className="detail-tabs">
        {["Historik", "Opfølgning", "Visitkort"].map((t) => (
          <button
            className={tab === t ? "active" : ""}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Historik" && (
        <div className="detail-tab-content">
          {card.notes && (
            <div className="private-note">
              <span>
                <Lock size={12} /> DIN PRIVATE NOTE
              </span>
              <p>{card.notes}</p>
            </div>
          )}
          <form
            className="note-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api("/contacts/" + card.id + "/interactions", {
                  method: "POST",
                  body: JSON.stringify({ note, kind, happened_at: when }),
                });
                setNote("");
                setHistory(await api("/contacts/" + card.id + "/interactions"));
                notify("Interaktion gemt");
              } catch (e) {
                notify((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <textarea
              required
              aria-label="Ny interaktion"
              placeholder="Hvad talte I om? Hvad skal du huske?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div>
              <select
                aria-label="Interaktionstype"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                {["Note", "Møde", "Telefon", "Mail", "Opfølgning"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <input
                aria-label="Interaktionsdato"
                type="date"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
              <button className="primary" disabled={busy}>
                <Plus size={15} /> Gem
              </button>
            </div>
          </form>
          <div className="timeline">
            {history.map((i) => (
              <div className="timeline-item" key={i.id}>
                <div className="timeline-dot">
                  <MessageSquare size={13} />
                </div>
                <div>
                  <strong>
                    {i.kind} <small>{date(i.happened_at)}</small>
                  </strong>
                  <p>{i.note}</p>
                </div>
                <button
                  className="icon-btn"
                  aria-label="Slet interaktion"
                  onClick={async () => {
                    if (!window.confirm("Slet denne interaktion?")) return;
                    try {
                      await api("/interactions/" + i.id, { method: "DELETE" });
                      setHistory(history.filter((x) => x.id !== i.id));
                    } catch (e) {
                      notify((e as Error).message);
                    }
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {!history.length && (
              <p className="fineprint">
                Tilføj den første note om jeres relation.
              </p>
            )}
          </div>
        </div>
      )}
      {tab === "Opfølgning" && (
        <FollowForm
          key={`${card.id}-${card.updated_at}`}
          card={card}
          onSave={onChange}
        />
      )}
      {tab === "Visitkort" && (
        <div className="detail-tab-content">
          {card.photo_ids.length ? (
            card.photo_ids.map((id, i) => (
              <a
                className="card-photo-link"
                key={id}
                href={"/api/files/" + id}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  className="card-photo"
                  src={"/api/files/" + id}
                  alt={"Visitkort side " + (i + 1)}
                />
              </a>
            ))
          ) : (
            <p>Ingen fotos gemt. Tilføj dem under Rediger.</p>
          )}
          <QR value={vcard(card)} />
          <p className="fineprint">
            Denne QR indeholder kun kontaktdata, ingen interne noter.
          </p>
        </div>
      )}
    </section>
  );
}
function FollowForm({
  card,
  onSave,
}: {
  card: Card;
  onSave: (c: Card) => void;
}) {
  const [c, setC] = useState(card);
  return (
    <form
      className="detail-tab-content"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(c);
      }}
    >
      <label>
        Status
        <select
          value={c.status}
          onChange={(e) => setC({ ...c, status: e.target.value })}
        >
          {statusNames.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label>
        Følg op den
        <input
          type="date"
          value={c.follow_up}
          onChange={(e) => setC({ ...c, follow_up: e.target.value })}
        />
      </label>
      <label>
        Næste handling
        <textarea
          placeholder="Fx send præsentation og aftal et møde"
          value={c.next_action}
          onChange={(e) => setC({ ...c, next_action: e.target.value })}
        />
      </label>
      <button className="primary">
        <Check size={16} /> Gem opfølgning
      </button>
    </form>
  );
}
function EditCard({
  initial,
  own,
  cards,
  busy,
  onSave,
  onClose,
  notify,
}: {
  initial: Card;
  own: boolean;
  cards: Card[];
  busy: boolean;
  onSave: (c: Card) => void;
  onClose: () => void;
  notify: (s: string) => void;
}) {
  const [tagText, setTagText] = useState(initial.tags.join(", "));
  const [c, setC] = useState({ ...initial }),
    [uploading, setUploading] = useState(false);
  const set = (k: string, v: unknown) => setC((prev) => ({ ...prev, [k]: v }));
  const duplicate = cards.find(
    (x) =>
      x.id !== c.id &&
      c.email &&
      x.email.toLowerCase() === c.email.toLowerCase(),
  );
  return (
    <Modal
      title={
        own
          ? "Dit personlige visitkort"
          : c.id
            ? "Rediger kontakt"
            : "En ny forbindelse"
      }
      subtitle={
        own
          ? "Disse kontaktoplysninger kan deles via dit visitkort."
          : "Kontrollér detaljerne, før du gemmer."
      }
      onClose={onClose}
      wide
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            ...c,
            tags: tagText
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          });
        }}
      >
        <div className="form-body">
          <div className="portrait-upload">
            <Avatar card={c} large />
            <div>
              <label className="secondary file-label">
                <ImagePlus size={17} />
                {c.portrait_id ? "Skift profilbillede" : "Tilføj profilbillede"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setUploading(true);
                    try {
                      set("portrait_id", await upload(f));
                    } catch (e) {
                      notify((e as Error).message);
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
              </label>
              {c.portrait_id && (
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => set("portrait_id", "")}
                >
                  Fjern billede
                </button>
              )}
            </div>
          </div>
          <div className="form-grid">
            {publicFields.map((k) => (
              <label key={k}>
                {labels[k]}
                {k === "name" && <span className="required"> *</span>}
                <input
                  required={k === "name"}
                  type={
                    k === "email"
                      ? "email"
                      : k === "phone" || k === "mobile"
                        ? "tel"
                        : "text"
                  }
                  value={c[k]}
                  onChange={(e) => set(k, e.target.value)}
                  maxLength={1000}
                  placeholder={k === "website" ? "https://" : undefined}
                />
              </label>
            ))}
          </div>
          {duplicate && (
            <p className="warning">
              Der findes allerede en kontakt med denne mail: {duplicate.name}.
              Du kan sammenlægge dem på kontaktens side.
            </p>
          )}
          {!own && (
            <>
              <div className="form-section">
                <span className="eyebrow">KONTEKST & RELATION</span>
                <div className="form-grid">
                  <label>
                    Hvor mødtes I?
                    <input
                      value={c.event}
                      onChange={(e) => set("event", e.target.value)}
                      list="events"
                      placeholder="Konference, middag, møde…"
                    />
                    <datalist id="events">
                      {[
                        ...new Set(cards.map((c) => c.event).filter(Boolean)),
                      ].map((x) => (
                        <option key={x} value={x} />
                      ))}
                    </datalist>
                  </label>
                  <label>
                    Dato for mødet
                    <input
                      type="date"
                      value={c.met_at}
                      onChange={(e) => set("met_at", e.target.value)}
                    />
                  </label>
                  <label>
                    Tags (adskilt med komma)
                    <input
                      value={tagText}
                      onChange={(e) => setTagText(e.target.value)}
                      placeholder="Luftfart, turisme, partner"
                    />
                  </label>
                  <label>
                    Status
                    <select
                      value={c.status}
                      onChange={(e) => set("status", e.target.value)}
                    >
                      {statusNames.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Følg op den
                    <input
                      type="date"
                      value={c.follow_up}
                      onChange={(e) => set("follow_up", e.target.value)}
                    />
                  </label>
                  <label>
                    Næste handling
                    <input
                      value={c.next_action}
                      onChange={(e) => set("next_action", e.target.value)}
                      placeholder="Send materiale, aftal kaffe…"
                    />
                  </label>
                </div>
                <label>
                  Privat note
                  <textarea
                    rows={3}
                    value={c.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    placeholder="Hvad skal du huske om personen og samtalen?"
                  />
                </label>
              </div>
              <div className="form-section">
                <span className="eyebrow">FOTO AF VISITKORTET</span>
                <div className="photo-thumbs">
                  {c.photo_ids.map((id) => (
                    <div key={id}>
                      <img src={"/api/files/" + id} alt="Foto af visitkort" />
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Fjern visitkortfoto"
                        onClick={() =>
                          set(
                            "photo_ids",
                            c.photo_ids.filter((x) => x !== id),
                          )
                        }
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                {c.photo_ids.length < 4 && (
                  <label className="secondary file-label">
                    <ImagePlus size={16} /> Tilføj side / foto
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setUploading(true);
                        try {
                          const id = await upload(f);
                          setC((prev) => ({
                            ...prev,
                            photo_ids: [...prev.photo_ids, id],
                          }));
                        } catch (e) {
                          notify((e as Error).message);
                        } finally {
                          setUploading(false);
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            </>
          )}
        </div>
        <footer className="modal-footer">
          <span>
            <Lock size={13} />
            {own
              ? "Deling styres under Mit visitkort"
              : "Gemmes i dit private bibliotek"}
          </span>
          <button type="button" className="secondary" onClick={onClose}>
            Annullér
          </button>
          <button className="primary" disabled={busy || uploading}>
            {busy || uploading ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Check size={17} />
            )}
            Gem {own ? "mit kort" : "kontakt"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
function ScanModal({
  busy,
  event,
  onEvent,
  onClose,
  onPhoto,
  onQR,
  onManual,
  notify,
}: {
  busy: boolean;
  event: string;
  onEvent: (s: string) => void;
  onClose: () => void;
  onPhoto: (f: File) => void;
  onQR: (c: Card) => void;
  onManual: () => void;
  notify: (s: string) => void;
}) {
  const [mode, setMode] = useState("foto"),
    [raw, setRaw] = useState(""),
    [camera, setCamera] = useState(false),
    [cameraError, setCameraError] = useState("");
  const video = useRef<HTMLVideoElement>(null),
    controls = useRef<IScannerControls | null>(null);
  useEffect(() => {
    if (!camera || !video.current) return;
    let cancelled = false;
    const start = async () => {
      const reader = await qrReader();
      if (cancelled) return;
      await reader
        .decodeFromVideoDevice(
          undefined,
          video.current!,
          (result, _error, ctrl) => {
            if (result && !cancelled) {
              ctrl.stop();
              setCamera(false);
              try {
                onQR(parseQR(result.getText()));
              } catch (e) {
                notify((e as Error).message);
              }
            }
          },
        )
        .then((c) => {
          if (cancelled) c.stop();
          else controls.current = c;
        })
        .catch(() => {
          setCameraError(
            "Kameraet kunne ikke åbnes. Giv kameratilladelse, eller vælg et billede af QR-koden.",
          );
          setCamera(false);
        });
    };
    start();
    return () => {
      cancelled = true;
      controls.current?.stop();
      controls.current = null;
    };
  }, [camera]);
  async function qrFile(f: File) {
    const url = URL.createObjectURL(f);
    try {
      const result = await (await qrReader()).decodeFromImageUrl(url);
      onQR(parseQR(result.getText()));
    } catch (e) {
      notify((e as Error).message || "QR-koden kunne ikke læses.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return (
    <Modal
      title="En ny forbindelse"
      subtitle="Et foto er alt, der skal til."
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="padded">
        <div className="segment">
          <button
            className={mode === "foto" ? "active" : ""}
            onClick={() => {
              setMode("foto");
              setCamera(false);
            }}
          >
            <Camera size={16} /> Visitkortfoto
          </button>
          <button
            className={mode === "qr" ? "active" : ""}
            onClick={() => setMode("qr")}
          >
            <QrCode size={16} /> QR-kode
          </button>
        </div>
        {busy ? (
          <div className="scan-wait">
            <LoaderCircle className="spin" size={34} />
            <h3>Aflæser dit visitkort…</h3>
            <p>Du kan kontrollere og rette alle detaljer bagefter.</p>
          </div>
        ) : mode === "foto" ? (
          <>
            <label className="capture-area">
              <div className="capture-outline">
                <ScanLine size={50} />
              </div>
              <strong>Tag et billede af visitkortet</strong>
              <span>
                Godt lys og et skarpt billede giver det bedste resultat.
              </span>
              <span className="primary">
                <Camera size={18} /> Åbn kamera
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPhoto(f);
                }}
              />
            </label>
            <label className="secondary full file-label">
              <Upload size={17} /> Vælg fra billeder
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPhoto(f);
                }}
              />
            </label>
          </>
        ) : (
          <>
            <div className="capture-area">
              {camera ? (
                <video
                  ref={video}
                  className="camera-video"
                  autoPlay
                  playsInline
                  muted
                />
              ) : (
                <>
                  <QrCode size={70} />
                  <p>Scan en QR-kode med kontaktdata eller et weblink.</p>
                </>
              )}
              <button className="primary" onClick={() => setCamera(!camera)}>
                <Camera size={17} />
                {camera ? "Stop kamera" : "Scan med kamera"}
              </button>
              {cameraError && <p className="warning">{cameraError}</p>}
            </div>
            <label className="secondary full file-label">
              <ImagePlus size={17} /> Importér QR fra billede
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) qrFile(f);
                }}
              />
            </label>
            <label>
              Indsæt vCard, MeCard eller weblink
              <textarea
                rows={3}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="BEGIN:VCARD…"
              />
            </label>
            <button
              className="secondary full"
              disabled={!raw}
              onClick={() => {
                try {
                  onQR(parseQR(raw));
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              Importér detaljer
            </button>
          </>
        )}
        <label className="scan-event">
          Mødested / konference
          <input
            value={event}
            onChange={(e) => onEvent(e.target.value)}
            placeholder="Hvor møder du personen?"
          />
        </label>
        <button className="text-btn full" disabled={busy} onClick={onManual}>
          Opret kontakt manuelt <ArrowUpRight size={15} />
        </button>
        {"contacts" in navigator && (
          <button
            className="secondary full"
            disabled={busy}
            onClick={async () => {
              try {
                const picker = (
                  navigator as unknown as {
                    contacts: {
                      select: (
                        props: string[],
                        opts: { multiple: boolean },
                      ) => Promise<
                        { name?: string[]; email?: string[]; tel?: string[] }[]
                      >;
                    };
                  }
                ).contacts;
                const people = await picker.select(["name", "email", "tel"], {
                  multiple: false,
                });
                if (people[0])
                  onQR({
                    ...blankCard(),
                    name: people[0].name?.[0] || "",
                    email: people[0].email?.[0] || "",
                    phone: people[0].tel?.[0] || "",
                    mobile: people[0].tel?.[1] || "",
                  });
              } catch (e) {
                if ((e as Error).name !== "AbortError")
                  notify("Telefonens kontaktvælger kunne ikke åbnes.");
              }
            }}
          >
            <ContactRound size={17} /> Importér fra telefonkontakter
          </button>
        )}
        <p className="fineprint centered">
          Fotos sendes til Cloudflare Workers AI for aflæsning. Kontaktdata
          gemmes først, når du vælger Gem.
        </p>
      </div>
    </Modal>
  );
}
function ShareModal({
  card,
  onClose,
  onShared,
  notify,
}: {
  card: Card;
  onClose: () => void;
  onShared: () => void;
  notify: (s: string) => void;
}) {
  const [fields, setFields] = useState<string[]>([...publicFields]),
    [notes, setNotes] = useState(false),
    [photo, setPhoto] = useState(true),
    [days, setDays] = useState(7),
    [url, setURL] = useState(""),
    [busy, setBusy] = useState(false);
  const subset = () =>
    Object.fromEntries(
      fields.map((f) => [f, card[f as keyof Card]]),
    ) as Partial<Card>;
  return (
    <Modal
      title={"Del " + card.name}
      subtitle="Vælg de oplysninger, kollegaen skal modtage."
      onClose={onClose}
    >
      <div className="padded">
        {url ? (
          <>
            <QR value={url} />
            <p className="centered">
              Linket udløber om {days} {days === 1 ? "dag" : "dage"}.
            </p>
            <button
              className="primary full"
              onClick={() => shareLink(url, card.name, notify)}
            >
              <Share2 size={17} /> Send / kopiér link
            </button>
            <a
              className="text-btn full"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              Forhåndsvis delingen <ExternalLink size={15} />
            </a>
          </>
        ) : (
          <>
            <div className="share-preview">
              <Avatar card={card} />
              <div>
                <strong>{card.name}</strong>
                <span>{card.company}</span>
              </div>
            </div>
            <div className="share-fields">
              {publicFields
                .filter((f) => !!card[f])
                .map((f) => (
                  <label key={f} className="checkbox">
                    <input
                      type="checkbox"
                      checked={fields.includes(f)}
                      disabled={f === "name"}
                      onChange={(e) =>
                        setFields(
                          e.target.checked
                            ? [...fields, f]
                            : fields.filter((x) => x !== f),
                        )
                      }
                    />
                    <span>
                      {labels[f]}
                      <small>{card[f]}</small>
                    </span>
                  </label>
                ))}
            </div>
            {card.portrait_id && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={photo}
                  onChange={(e) => setPhoto(e.target.checked)}
                />
                Medtag profilbillede
              </label>
            )}
            {card.notes && (
              <label className="checkbox note-warning">
                <input
                  type="checkbox"
                  checked={notes}
                  onChange={(e) => setNotes(e.target.checked)}
                />
                Medtag min private kontakt-note
              </label>
            )}
            <p className="fineprint">
              Interaktionshistorik, mødested, tags og opfølgningsopgaver deles
              ikke. Kun kontakt-noten kan tilvælges.
            </p>
            <label>
              Linkets levetid
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                <option value={1}>1 dag</option>
                <option value={7}>7 dage</option>
                <option value={30}>30 dage</option>
              </select>
            </label>
            <button
              className="primary full"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await api("/shares", {
                    method: "POST",
                    body: JSON.stringify({
                      kind: "contact",
                      contact_id: card.id,
                      fields,
                      include_notes: notes,
                      include_photo: photo,
                      days,
                    }),
                  });
                  setURL(location.origin + "/p/" + result.token);
                  onShared();
                } catch (e) {
                  notify((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <LinkIcon size={17} />
              )}
              Opret delingslink
            </button>
            <button
              className="secondary full"
              onClick={() =>
                download("kontakt.vcf", vcard(subset()), "text/vcard")
              }
            >
              <Download size={17} /> Hent valgt kontaktdata som vCard
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
function PublicCard({ token }: { token: string }) {
  const [c, setC] = useState<
      (Partial<Card> & { photo: boolean; kind: string }) | null
    >(null),
    [err, setErr] = useState("");
  useEffect(() => {
    api("/public/" + token)
      .then(setC)
      .catch((e) => setErr(e.message));
  }, [token]);
  return (
    <div className="public-page">
      <div className="public-brand">
        <ContactRound size={24} /> visitkort.
      </div>
      {err ? (
        <section className="public-card">
          <Empty title="Dette kort er ikke tilgængeligt" text={err} />
        </section>
      ) : c ? (
        <section className="public-card">
          <span className="eyebrow">
            {c.kind === "profile"
              ? "LAD OS HOLDE KONTAKT"
              : "EN FORBINDELSE DELT MED DIG"}
          </span>
          <Avatar
            card={c}
            large
            publicPhoto={
              c.photo ? "/api/public/" + token + "/photo" : undefined
            }
          />
          <h1>{c.name}</h1>
          <p>{c.title}</p>
          {c.company && <strong className="public-company">{c.company}</strong>}
          <a className="primary full" href={"/api/public/" + token + "/vcard"}>
            <ContactRound size={19} /> Gem i mine kontakter
          </a>
          <div className="detail-links">
            {c.email && (
              <a href={"mailto:" + c.email}>
                <Mail size={18} />
                {c.email}
                <ArrowUpRight size={15} />
              </a>
            )}
            {[c.mobile, c.phone].filter(Boolean).map((p, i) => (
              <a key={i} href={"tel:" + p!.replace(/[^\d+]/g, "")}>
                <Phone size={18} />
                {p}
                <ArrowUpRight size={15} />
              </a>
            ))}
            {[c.website, c.linkedin].filter(Boolean).map((p, i) => (
              <a key={i} href={safeWeb(p!)} target="_blank" rel="noreferrer">
                <Globe size={18} />
                {p}
                <ArrowUpRight size={15} />
              </a>
            ))}
            {c.address && (
              <div>
                <MapPin size={18} />
                {c.address}
              </div>
            )}
          </div>
          {c.notes && (
            <div className="private-note">
              <span>DELT NOTE</span>
              <p>{c.notes}</p>
            </div>
          )}
          <p className="fineprint">
            Åbn den hentede kontaktfil på telefonen for at gemme personen i din
            kontaktbog.
          </p>
        </section>
      ) : (
        <LoaderCircle className="spin" />
      )}
      <p className="public-footer">Gode relationer starter med et møde.</p>
    </div>
  );
}
function OfflineCapture({
  event,
  onSaved,
}: {
  event: string;
  onSaved: () => void;
}) {
  return (
    <label className="secondary full file-label">
      <Camera size={18} /> Gem visitkortfoto offline
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) {
            await storeDraft(await shrink(f), event);
            onSaved();
          }
        }}
      />
    </label>
  );
}
function DraftList({
  pending,
  busy,
  onScan,
  onDelete,
}: {
  pending: Draft[];
  busy: boolean;
  onScan: (d: Draft) => void;
  onDelete: (d: Draft) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Scanningskladder på denne enhed</h2>
        <span className="pill">{pending.length}</span>
      </div>
      {pending.map((d) => (
        <div className="sharing-row" key={d.id}>
          <div>
            <strong>{d.event || "Visitkortfoto"}</strong>
            <small>{date(d.date)} · Ikke gemt i databasen endnu</small>
          </div>
          <button
            className="secondary"
            disabled={busy || !navigator.onLine}
            onClick={() => onScan(d)}
          >
            <ScanLine size={16} /> Aflæs
          </button>
          <button
            className="icon-btn"
            aria-label="Slet kladde"
            onClick={() => onDelete(d)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <p className="fineprint padded">
        Kladden bliver på denne enhed, også efter logout, indtil du aflæser
        eller sletter den. Slet kladder før du giver enheden til andre.
      </p>
    </section>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
