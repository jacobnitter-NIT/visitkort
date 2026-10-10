import { tr, trf, useLanguage, getLanguage, LanguagePicker } from "./i18n";
import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { CardCrop } from "./CardCrop";
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
        getLanguage() === "en" ? "en-GB" : "da-DK",
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
      <h3>{tr(title)}</h3>
      <p>{tr(text)}</p>
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
    <p className="warning">{tr(err)}</p>
  ) : src ? (
    <img className="qr" src={src} alt={tr("QR-kode til kontaktoplysninger")} />
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
            <h2>{tr(title)}</h2>
            {subtitle && <p>{tr(subtitle)}</p>}
          </div>
          <button className="icon-btn" aria-label={tr("Luk")} onClick={onClose}>
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function App() {
  useLanguage();
  const [crop, setCrop] = useState<{ file: File; draft?: Draft } | null>(null);
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
    setToast(tr(s));
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
        <p>{tr("Åbner dit netværk…")}</p>
      </div>
    );
  if (!auth)
    return (
      <div className="login">
        <div className="login-language">
          <LanguagePicker />
        </div>
        <div className="login-brand">
          <div className="brand-mark">
            <ContactRound />
          </div>
          <h1>
            {tr("Gode relationer")}
            <br />
            {tr("starter med et møde.")}
          </h1>
          <p>
            {tr("Et visitkort er begyndelsen.")}
            <br />
            {tr("Her holder du forbindelsen.")}
          </p>
          <div className="login-decoration">
            <span>{tr("Dit netværk")}</span>
            <ContactRound size={80} />
            <span>{tr("Samlet ét sted")}</span>
          </div>
        </div>
        <div className="login-form">
          <span className="eyebrow">{tr("DIT PRIVATE NETVÆRK")}</span>
          <h2>{tr("Velkommen tilbage")}</h2>
          <p>{tr("Log ind for at se dine kontakter og følge op.")}</p>
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
              {tr("Adgangskode")}
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
                {tr(error)}
              </p>
            )}
            {!configured && (
              <p className="warning">
                {tr(
                  "Appen er endnu ikke konfigureret. Følg INSTALLATION.md for database og login.",
                )}
              </p>
            )}
            <button className="primary full" disabled={!!busy || !configured}>
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Lock size={18} />
              )}
              {tr("Åbn Visitkort")}
            </button>
          </form>
          <div className="private-hint">
            <ShieldCheck size={17} />
            {tr("Kun du har adgang til kontaktbiblioteket.")}
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
            <p>
              {pending.length}
              {tr("scanningskladder gemt på denne enhed.")}
            </p>
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
        <span className="nav-caption">{tr("DIT NETVÆRK")}</span>
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
                key={tr(String(name))}
                className={page === name ? "active" : ""}
                onClick={() => {
                  setPage(String(name));
                  setSelected(null);
                  setQuery("");
                }}
              >
                <I size={20} />
                {tr(String(name))}
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
            {tr("Dit næste møde.")}
            <br />
            {tr("Din næste forbindelse.")}
          </strong>
          <p>{tr("Del dit eget visitkort med en QR-kode.")}</p>
          <button onClick={() => setPage("Mit visitkort")}>
            {tr("Åbn mit visitkort")}
            <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="owner">
          <Avatar
            card={profile.name ? profile : { name: tr("Privat bruger") }}
          />
          <div>
            <strong>{profile.name || tr("Dit private netværk")}</strong>
            <span>
              <Lock size={11} />
              {tr("Personligt bibliotek")}
            </span>
          </div>
          <button
            className="icon-btn"
            aria-label={tr("Log ud")}
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
            {tr("Dit netværk")}
            <ChevronRight size={14} /> <strong>{tr(page)}</strong>
          </span>
          <div className="top-actions">
            <LanguagePicker />
            <span className={"connection " + (!online ? "offline" : "")}>
              <i />
              {online ? tr("Privat & online") : "Offline"}
            </span>
            <button className="primary" onClick={() => setScan(true)}>
              <ScanLine size={18} /> <span>{tr("Scan visitkort")}</span>
            </button>
          </div>
        </header>
        {error && (
          <div role="alert" className="warning">
            {tr(error)}
            <button
              onClick={() =>
                run(async () => {
                  await load();
                  setError("");
                })
              }
            >
              {tr("Prøv igen")}
            </button>
          </div>
        )}
        {!online && (
          <div className="offline-strip">
            <WifiOff size={17} />
            {tr("Ingen forbindelse. Du kan gemme fotos som scanningskladder.")}
          </div>
        )}
        <div className="content">
          {page === "Overblik" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">{tr("RELATIONER, DER VARER")}</span>
                  <h1>
                    {profile.name
                      ? trf("Hej {name}.", { name: profile.name.split(" ")[0] })
                      : tr("Dit netværk, samlet.")}
                  </h1>
                  <p>
                    {tr(
                      "Hold forbindelsen. Gør det næste møde til en god relation.",
                    )}
                  </p>
                </div>
                <button
                  className="secondary"
                  onClick={() => {
                    setEditProfile(false);
                    setEdit({ ...blankCard(), event, met_at: today() });
                  }}
                >
                  <Plus size={17} />
                  {tr("Tilføj kontakt")}
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
                  note={
                    due.length
                      ? tr("Klar til næste skridt")
                      : tr("Du er helt med")
                  }
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
                      <span className="eyebrow">{tr("NÆSTE SKRIDT")}</span>
                      <h2>{tr("Tid til at følge op")}</h2>
                    </div>
                    <button
                      className="text-btn"
                      onClick={() => setPage("Opfølgning")}
                    >
                      {tr("Se alle")}
                      <ArrowUpRight size={16} />
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
                      title={tr("Plads til næste forbindelse")}
                      text={tr(
                        "Tilføj en opfølgningsdato på en kontakt. Så husker appen, hvem du skal tage fat i.",
                      )}
                    />
                  )}
                </section>
                <section className="scan-feature">
                  <span className="eyebrow">
                    {tr("FRA VISITKORT TIL RELATION")}
                  </span>
                  <h2>
                    {tr("Et foto.")}
                    <br />
                    {tr("En ny forbindelse.")}
                  </h2>
                  <p>
                    {tr("Scan et visitkort eller en QR-kode.")}
                    <br />
                    {tr("Gem detaljerne, mens mødet er frisk.")}
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
                    <ScanLine size={19} />
                    {tr("Scan et visitkort")} <ArrowUpRight size={18} />
                  </button>
                </section>
              </div>
              <section className="panel recent">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">{tr("NYE FORBINDELSER")}</span>
                    <h2>{tr("Senest tilføjet")}</h2>
                  </div>
                  <button
                    className="text-btn"
                    onClick={() => setPage("Kontakter")}
                  >
                    {tr("Alle kontakter")}
                    <ArrowUpRight size={16} />
                  </button>
                </div>
                {cards.length ? (
                  <div className="contact-table">
                    <div className="table-head">
                      <span>{tr("PERSON")}</span>
                      <span>{tr("SELSKAB")}</span>
                      <span>{tr("MØDESTED")}</span>
                      <span>{tr("STATUS")}</span>
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
                              <small>
                                {c.title || c.email || tr("Kontakt")}
                              </small>
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
                    title={tr("Dit netværk starter her")}
                    text={tr(
                      "Scan dit første visitkort eller opret en kontakt manuelt.",
                    )}
                    action={
                      <button className="primary" onClick={() => setScan(true)}>
                        <ScanLine size={17} />
                        {tr("Scan dit første kort")}
                      </button>
                    }
                  />
                )}
              </section>
              {pending.length > 0 && (
                <DraftList
                  pending={pending}
                  busy={!!busy}
                  onScan={(d) => setCrop({ file: d.file, draft: d })}
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
                  <span className="eyebrow">
                    {tr("MENNESKERNE BAG KORTENE")}
                  </span>
                  <h1>
                    {tr("Kontakter")}{" "}
                    <span className="title-count">{cards.length}</span>
                  </h1>
                  <p>{tr("Søg, find og hold forbindelsen.")}</p>
                </div>
                <button
                  className="primary"
                  onClick={() => {
                    setEditProfile(false);
                    setEdit({ ...blankCard(), event, met_at: today() });
                  }}
                >
                  <Plus size={18} />
                  {tr("Ny kontakt")}
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
                      aria-label={tr("Søg kontakter")}
                      placeholder={tr("Søg navn, selskab, konference…")}
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
                        {s === "Favoritter" && <Star size={13} />} {tr(s)}
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
                          query
                            ? tr("Ingen resultater")
                            : tr("Ingen kontakter endnu")
                        }
                        text={
                          query
                            ? tr("Prøv et andet navn, selskab eller tag.")
                            : tr(
                                "Tilføj din første kontakt med kameraet eller manuelt.",
                              )
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
                        description: trf(
                          "{name} og kontaktens historik slettes. Delingslinks bliver også fjernet.",
                          { name: selected.name },
                        ),
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
                        description: trf(
                          "Behold {name}, tilføj manglende felter og historik fra {other}, og slet dubletten. Dublettens delingslinks deaktiveres.",
                          { name: selected.name, other: remove.name },
                        ),
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
                    <h3>{tr("Et menneske bag hvert kort")}</h3>
                    <p>
                      {tr("Vælg en kontakt for at se detaljer,")}
                      <br />
                      {tr("noter og jeres seneste interaktioner.")}
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
                  <span className="eyebrow">{tr("HOLD FORBINDELSEN")}</span>
                  <h1>{tr("Det næste skridt.")}</h1>
                  <p>{tr("Dine aftaler med dig selv — samlet ét sted.")}</p>
                </div>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <h2>{tr("Planlagte opfølgninger")}</h2>
                  <span className="pill">
                    {allFollow.length}
                    {tr("i alt")}
                  </span>
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
                    title={tr("Ingen planlagte opfølgninger")}
                    text={tr(
                      "Åbn en kontakt og vælg en dato og næste handling.",
                    )}
                  />
                )}
              </section>
            </>
          )}
          {page === "Mit visitkort" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    {tr("GØR DET NEMT AT HOLDE KONTAKT")}
                  </span>
                  <h1>{tr("Dit digitale visitkort.")}</h1>
                  <p>{tr("Alle dine detaljer. Klar til næste møde.")}</p>
                </div>
                <button
                  className="primary"
                  onClick={() => {
                    setEditProfile(true);
                    setEdit(profile);
                  }}
                >
                  <NotebookPen size={18} />
                  {tr("Rediger mit kort")}
                </button>
              </div>
              <div className="profile-grid">
                <div className="my-card">
                  <div className="card-top">
                    <span>{tr("PERSONLIGT VISITKORT")}</span>
                    <ContactRound />
                  </div>
                  <Avatar card={profile} large />
                  <h2>{profile.name || tr("Dit navn")}</h2>
                  <p>
                    {profile.title || tr("Din titel")}
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
                  <div className="card-bottom">
                    {tr("Et møde er kun begyndelsen.")}
                  </div>
                </div>
                <section className="panel share-profile">
                  <span className="eyebrow">{tr("DEL DIN FORBINDELSE")}</span>
                  <h2>{tr("Scan. Gem. Hold kontakt.")}</h2>
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
                          <Download size={16} />
                          {tr("Kontaktfil")}
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
                            <Share2 size={16} />
                            {tr("Del link")}
                          </button>
                        )}
                      </div>
                      {profileShare && (
                        <p className="fineprint">
                          {tr(
                            "Alle med linket kan se dine kontaktoplysninger og dit billede. De kan ikke se kontaktbiblioteket eller dine noter. Ændringer i dit kort vises automatisk.",
                          )}
                        </p>
                      )}
                    </>
                  ) : (
                    <Empty
                      title={tr("Sæt ansigt på dit netværk")}
                      text={tr(
                        "Tilføj dine detaljer og et profilbillede for at gøre dit visitkort klar.",
                      )}
                      action={
                        <button
                          className="primary"
                          onClick={() => {
                            setEditProfile(true);
                            setEdit(profile);
                          }}
                        >
                          {tr("Opret mit visitkort")}
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
                  <span className="eyebrow">{tr("DU HAR KONTROLLEN")}</span>
                  <h1>{tr("Dit bibliotek.")}</h1>
                  <p>
                    {tr(
                      "Administrér eksport, deling og dine scanningskladder.",
                    )}
                  </p>
                </div>
              </div>
              <div className="settings-grid">
                <section className="panel padded">
                  <h2>{tr("Konferencetilstand")}</h2>
                  <p>
                    {tr(
                      "Brug samme mødested til alle nye kontakter, indtil du ændrer det.",
                    )}
                  </p>
                  <label>
                    {tr("Aktuelt event / mødested")}
                    <input
                      value={event}
                      placeholder={tr("Fx konference, København, oktober 2026")}
                      onChange={(e) => setEvent(e.target.value)}
                    />
                  </label>
                  <p className="fineprint">
                    {tr(
                      "Gemmes på denne enhed og foreslås ved nye scanninger.",
                    )}
                  </p>
                </section>
                <section className="panel padded">
                  <h2>{tr("Eksport & import")}</h2>
                  <p>{tr("Tag dine kontakter med dig.")}</p>
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
                      <Download size={16} />
                      {tr("Alle kontakter")}
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
                      <Download size={16} />
                      {tr("JSON-eksport")}
                    </button>
                    <label className="secondary file-label">
                      <Upload size={16} />
                      {tr("Importér JSON")}
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
                                  notify(
                                    trf("{count} kontakter importeret", {
                                      count: r.count,
                                    }),
                                  );
                                },
                              });
                            });
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <p className="fineprint">
                    {tr(
                      "JSON indeholder kontakter, historik og egne profildata, men ikke billeder. Import tilføjer kontakter og historik; profilen skal udfyldes separat. CSV- og vCard-eksport indeholder ingen interaktionshistorik.",
                    )}
                  </p>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <h2>{tr("Delingslinks")}</h2>
                  <span className="pill">
                    {
                      shares.filter(
                        (s) =>
                          !s.revoked &&
                          (!s.expires_at ||
                            s.expires_at > new Date().toISOString()),
                      ).length
                    }{" "}
                    {tr("aktive")}
                  </span>
                </div>
                {shares.length ? (
                  shares.map((s) => (
                    <div className="sharing-row" key={s.token}>
                      <div>
                        <strong>
                          {s.kind === "profile"
                            ? tr("Mit offentlige visitkort")
                            : s.name}
                        </strong>
                        <small>
                          {s.revoked
                            ? "Deaktiveret"
                            : s.expires_at
                              ? trf("Udløber {date}", {
                                  date: date(s.expires_at),
                                })
                              : tr("Aktivt indtil du deaktiverer det")}
                        </small>
                      </div>
                      {!s.revoked && (
                        <>
                          <button
                            className="icon-btn"
                            aria-label={tr("Kopiér link")}
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
                            {tr("Deaktivér")}
                          </button>
                        </>
                      )}
                    </div>
                  ))
                ) : (
                  <Empty
                    title={tr("Ingen delingslinks")}
                    text={tr(
                      "Du kan dele dit eget kort eller en valgt kontakt.",
                    )}
                  />
                )}
              </section>
              {pending.length > 0 && (
                <DraftList
                  pending={pending}
                  busy={!!busy}
                  onScan={(d) => setCrop({ file: d.file, draft: d })}
                  onDelete={(d) =>
                    run(async () => {
                      await deleteDraft(d.id);
                      setPending(await drafts());
                    })
                  }
                />
              )}
              <p className="fineprint">
                {tr(
                  "Visitkort 1.0 · Privat bibliotek · Kontaktfiler og delingslinks sendes kun, når du selv vælger at dele.",
                )}
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
              key={tr(String(name))}
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
                {name === "Mit visitkort" ? tr("Mit kort") : tr(String(name))}
              </span>
            </button>
          );
        })}
        <button
          className="mobile-settings"
          aria-label={tr("Indstillinger")}
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
      {crop && (
        <Modal
          title={tr("Beskær dit visitkort")}
          subtitle={tr("Kun kortet. Klar til aflæsning.")}
          onClose={() => setCrop(null)}
        >
          <CardCrop
            file={crop.file}
            onCancel={() => setCrop(null)}
            onUse={(file) => {
              const draft = crop.draft;
              setCrop(null);
              run(() => photoScan(file, draft));
            }}
          />
        </Modal>
      )}
      {scan && !crop && (
        <ScanModal
          busy={busy === "scan"}
          event={event}
          onEvent={setEvent}
          onClose={() => setScan(false)}
          onPhoto={(f) => setCrop({ file: f })}
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
        <Modal title={tr(confirm.title)} onClose={() => setConfirm(null)}>
          <div className="padded">
            <p>{tr(confirm.description)}</p>
            <div className="button-row">
              <button className="secondary" onClick={() => setConfirm(null)}>
                {tr("Annullér")}
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
                {tr("Bekræft")}
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
      {tr(text)}
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
          <span>{card.next_action || tr("Følg op på relationen")}</span>
          <small>{card.company}</small>
        </div>
      </button>
      <span
        className={"due-date " + (card.follow_up < today() ? "overdue" : "")}
      >
        {card.follow_up === today() ? tr("I dag") : date(card.follow_up)}
      </span>
      <button
        className="done-btn"
        title={tr("Markér som afsluttet")}
        aria-label={tr("Afslut opfølgning for ") + card.name}
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
          {tr("Kontaktdata i QR")}
        </button>
        <button
          className={mode === "link" ? "active" : ""}
          onClick={() => setMode("link")}
        >
          {tr("Profil med billede")}
        </button>
      </div>
      {mode === "data" ? (
        <>
          <QR value={vcard(profile)} />
          <p className="fineprint">
            {tr(
              "Kontaktdata ligger direkte i koden. Billedet medfølger via profillinket.",
            )}
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
            {tr("Vis offentligt kort")}
            <ExternalLink size={14} />
          </a>
        </>
      ) : (
        <div className="activate-card">
          <LinkIcon size={28} />
          <p>
            {tr(
              "Aktivér en offentlig profil med dine kontaktoplysninger og dit billede.",
            )}
          </p>
          <button className="primary" onClick={onActivate}>
            {tr("Aktivér profillink")}
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
          aria-label={tr("Tilbage til kontaktliste")}
          onClick={onBack}
        >
          <ArrowLeft />
        </button>
        <span className="eyebrow">{tr("KONTAKTDETALJER")}</span>
        <div>
          <button
            className={"icon-btn " + (card.favorite ? "favorite" : "")}
            aria-label={tr("Skift favorit")}
            onClick={() => onChange({ ...card, favorite: !card.favorite })}
          >
            <Star size={19} fill={card.favorite ? "currentColor" : "none"} />
          </button>
          <button
            className="icon-btn"
            aria-label={tr("Slet kontakt")}
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
          <Share2 size={16} />
          {tr("Del kontakt")}
        </button>
        <button className="secondary" onClick={onEdit}>
          <NotebookPen size={16} />
          {tr("Rediger")}
        </button>
        <button
          className="icon-btn"
          title={tr("Gem i telefonens kontakter")}
          aria-label={tr("Hent kontaktfil")}
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
            <small>{tr("I MØDTES HER")}</small>
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
          {tr("Mulig dublet:")}{" "}
          {duplicates.map((c) => (
            <button className="text-btn" key={c.id} onClick={() => onMerge(c)}>
              {c.name} {tr("· Sammenlæg")}
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
            {tr(t)}
          </button>
        ))}
      </div>
      {tab === "Historik" && (
        <div className="detail-tab-content">
          {card.notes && (
            <div className="private-note">
              <span>
                <Lock size={12} />
                {tr("DIN PRIVATE NOTE")}
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
              aria-label={tr("Ny interaktion")}
              placeholder={tr("Hvad talte I om? Hvad skal du huske?")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div>
              <select
                aria-label={tr("Interaktionstype")}
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                {["Note", "Møde", "Telefon", "Mail", "Opfølgning"].map((t) => (
                  <option key={t} value={t}>
                    {tr(t)}
                  </option>
                ))}
              </select>
              <input
                aria-label={tr("Interaktionsdato")}
                type="date"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
              <button className="primary" disabled={busy}>
                <Plus size={15} />
                {tr("Gem")}
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
                    {tr(i.kind)} <small>{date(i.happened_at)}</small>
                  </strong>
                  <p>{i.note}</p>
                </div>
                <button
                  className="icon-btn"
                  aria-label={tr("Slet interaktion")}
                  onClick={async () => {
                    if (!window.confirm(tr("Slet denne interaktion?"))) return;
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
                {tr("Tilføj den første note om jeres relation.")}
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
                  alt={tr("Visitkort side ") + (i + 1)}
                />
              </a>
            ))
          ) : (
            <p>{tr("Ingen fotos gemt. Tilføj dem under Rediger.")}</p>
          )}
          <QR value={vcard(card)} />
          <p className="fineprint">
            {tr("Denne QR indeholder kun kontaktdata, ingen interne noter.")}
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
            <option key={s} value={s}>
              {tr(s)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {tr("Følg op den")}
        <input
          type="date"
          value={c.follow_up}
          onChange={(e) => setC({ ...c, follow_up: e.target.value })}
        />
      </label>
      <label>
        {tr("Næste handling")}
        <textarea
          placeholder={tr("Fx send præsentation og aftal et møde")}
          value={c.next_action}
          onChange={(e) => setC({ ...c, next_action: e.target.value })}
        />
      </label>
      <button className="primary">
        <Check size={16} />
        {tr("Gem opfølgning")}
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
          ? tr("Dit personlige visitkort")
          : c.id
            ? tr("Rediger kontakt")
            : tr("En ny forbindelse")
      }
      subtitle={
        own
          ? tr("Disse kontaktoplysninger kan deles via dit visitkort.")
          : tr("Kontrollér detaljerne, før du gemmer.")
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
                {c.portrait_id
                  ? tr("Skift profilbillede")
                  : tr("Tilføj profilbillede")}
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
                  {tr("Fjern billede")}
                </button>
              )}
            </div>
          </div>
          <div className="form-grid">
            {publicFields.map((k) => (
              <label key={k}>
                {tr(labels[k])}
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
              {tr("Der findes allerede en kontakt med denne mail:")}{" "}
              {duplicate.name}
              {tr(". Du kan sammenlægge dem på kontaktens side.")}
            </p>
          )}
          {!own && (
            <>
              <div className="form-section">
                <span className="eyebrow">{tr("KONTEKST & RELATION")}</span>
                <div className="form-grid">
                  <label>
                    {tr("Hvor mødtes I?")}
                    <input
                      value={c.event}
                      onChange={(e) => set("event", e.target.value)}
                      list="events"
                      placeholder={tr("Konference, middag, møde…")}
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
                    {tr("Dato for mødet")}
                    <input
                      type="date"
                      value={c.met_at}
                      onChange={(e) => set("met_at", e.target.value)}
                    />
                  </label>
                  <label>
                    {tr("Tags (adskilt med komma)")}
                    <input
                      value={tagText}
                      onChange={(e) => setTagText(e.target.value)}
                      placeholder={tr("Luftfart, turisme, partner")}
                    />
                  </label>
                  <label>
                    Status
                    <select
                      value={c.status}
                      onChange={(e) => set("status", e.target.value)}
                    >
                      {statusNames.map((s) => (
                        <option key={s} value={s}>
                          {tr(s)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {tr("Følg op den")}
                    <input
                      type="date"
                      value={c.follow_up}
                      onChange={(e) => set("follow_up", e.target.value)}
                    />
                  </label>
                  <label>
                    {tr("Næste handling")}
                    <input
                      value={c.next_action}
                      onChange={(e) => set("next_action", e.target.value)}
                      placeholder={tr("Send materiale, aftal kaffe…")}
                    />
                  </label>
                </div>
                <label>
                  {tr("Privat note")}
                  <textarea
                    rows={3}
                    value={c.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    placeholder={tr(
                      "Hvad skal du huske om personen og samtalen?",
                    )}
                  />
                </label>
              </div>
              <div className="form-section">
                <span className="eyebrow">{tr("FOTO AF VISITKORTET")}</span>
                <div className="photo-thumbs">
                  {c.photo_ids.map((id) => (
                    <div key={id}>
                      <img
                        src={"/api/files/" + id}
                        alt={tr("Foto af visitkort")}
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={tr("Fjern visitkortfoto")}
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
                    <ImagePlus size={16} />
                    {tr("Tilføj side / foto")}
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
              ? tr("Deling styres under Mit visitkort")
              : tr("Gemmes i dit private bibliotek")}
          </span>
          <button type="button" className="secondary" onClick={onClose}>
            {tr("Annullér")}
          </button>
          <button className="primary" disabled={busy || uploading}>
            {busy || uploading ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Check size={17} />
            )}
            {tr("Gem")} {own ? tr("mit kort") : tr("kontakt")}
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
      title={tr("En ny forbindelse")}
      subtitle={tr("Et foto er alt, der skal til.")}
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
            <Camera size={16} />
            {tr("Visitkortfoto")}
          </button>
          <button
            className={mode === "qr" ? "active" : ""}
            onClick={() => setMode("qr")}
          >
            <QrCode size={16} />
            {tr("QR-kode")}
          </button>
        </div>
        {busy ? (
          <div className="scan-wait">
            <LoaderCircle className="spin" size={34} />
            <h3>{tr("Aflæser dit visitkort…")}</h3>
            <p>{tr("Du kan kontrollere og rette alle detaljer bagefter.")}</p>
          </div>
        ) : mode === "foto" ? (
          <>
            <label className="capture-area">
              <div className="capture-outline">
                <ScanLine size={50} />
              </div>
              <strong>{tr("Tag et billede af visitkortet")}</strong>
              <span>
                {tr("Godt lys og et skarpt billede giver det bedste resultat.")}
              </span>
              <span className="primary">
                <Camera size={18} />
                {tr("Åbn kamera")}
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
              <Upload size={17} />
              {tr("Vælg fra billeder")}
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
                  <p>
                    {tr("Scan en QR-kode med kontaktdata eller et weblink.")}
                  </p>
                </>
              )}
              <button className="primary" onClick={() => setCamera(!camera)}>
                <Camera size={17} />
                {camera ? tr("Stop kamera") : tr("Scan med kamera")}
              </button>
              {cameraError && <p className="warning">{cameraError}</p>}
            </div>
            <label className="secondary full file-label">
              <ImagePlus size={17} />
              {tr("Importér QR fra billede")}
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
              {tr("Indsæt vCard, MeCard eller weblink")}
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
              {tr("Importér detaljer")}
            </button>
          </>
        )}
        <label className="scan-event">
          {tr("Mødested / konference")}
          <input
            value={event}
            onChange={(e) => onEvent(e.target.value)}
            placeholder={tr("Hvor møder du personen?")}
          />
        </label>
        <button className="text-btn full" disabled={busy} onClick={onManual}>
          {tr("Opret kontakt manuelt")}
          <ArrowUpRight size={15} />
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
            <ContactRound size={17} />
            {tr("Importér fra telefonkontakter")}
          </button>
        )}
        <p className="fineprint centered">
          {tr(
            "Fotos sendes til Cloudflare Workers AI for aflæsning. Kontaktdata gemmes først, når du vælger Gem.",
          )}
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
      subtitle={tr("Vælg de oplysninger, kollegaen skal modtage.")}
      onClose={onClose}
    >
      <div className="padded">
        {url ? (
          <>
            <QR value={url} />
            <p className="centered">
              {tr("Linket udløber om")} {days} {tr(days === 1 ? "dag" : "dage")}
              .
            </p>
            <button
              className="primary full"
              onClick={() => shareLink(url, card.name, notify)}
            >
              <Share2 size={17} />
              {tr("Send / kopiér link")}
            </button>
            <a
              className="text-btn full"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              {tr("Forhåndsvis delingen")}
              <ExternalLink size={15} />
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
                      {tr(labels[f])}
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
                {tr("Medtag profilbillede")}
              </label>
            )}
            {card.notes && (
              <label className="checkbox note-warning">
                <input
                  type="checkbox"
                  checked={notes}
                  onChange={(e) => setNotes(e.target.checked)}
                />
                {tr("Medtag min private kontakt-note")}
              </label>
            )}
            <p className="fineprint">
              {tr(
                "Interaktionshistorik, mødested, tags og opfølgningsopgaver deles ikke. Kun kontakt-noten kan tilvælges.",
              )}
            </p>
            <label>
              {tr("Linkets levetid")}
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                <option value={1}>{tr("1 dag")}</option>
                <option value={7}>{tr("7 dage")}</option>
                <option value={30}>{tr("30 dage")}</option>
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
              {tr("Opret delingslink")}
            </button>
            <button
              className="secondary full"
              onClick={() =>
                download("kontakt.vcf", vcard(subset()), "text/vcard")
              }
            >
              <Download size={17} />
              {tr("Hent valgt kontaktdata som vCard")}
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
          <Empty title={tr("Dette kort er ikke tilgængeligt")} text={tr(err)} />
        </section>
      ) : c ? (
        <section className="public-card">
          <span className="eyebrow">
            {c.kind === "profile"
              ? tr("LAD OS HOLDE KONTAKT")
              : tr("EN FORBINDELSE DELT MED DIG")}
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
            <ContactRound size={19} />
            {tr("Gem i mine kontakter")}
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
              <span>{tr("DELT NOTE")}</span>
              <p>{c.notes}</p>
            </div>
          )}
          <p className="fineprint">
            {tr(
              "Åbn den hentede kontaktfil på telefonen for at gemme personen i din kontaktbog.",
            )}
          </p>
        </section>
      ) : (
        <LoaderCircle className="spin" />
      )}
      <p className="public-footer">
        {tr("Gode relationer starter med et møde.")}
      </p>
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
      <Camera size={18} />
      {tr("Gem visitkortfoto offline")}
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
        <h2>{tr("Scanningskladder på denne enhed")}</h2>
        <span className="pill">{pending.length}</span>
      </div>
      {pending.map((d) => (
        <div className="sharing-row" key={d.id}>
          <div>
            <strong>{d.event || tr("Visitkortfoto")}</strong>
            <small>
              {date(d.date)}
              {tr("· Ikke gemt i databasen endnu")}
            </small>
          </div>
          <button
            className="secondary"
            disabled={busy || !navigator.onLine}
            onClick={() => onScan(d)}
          >
            <ScanLine size={16} />
            {tr("Aflæs")}
          </button>
          <button
            className="icon-btn"
            aria-label={tr("Slet kladde")}
            onClick={() => onDelete(d)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <p className="fineprint padded">
        {tr(
          "Kladden bliver på denne enhed, også efter logout, indtil du aflæser eller sletter den. Slet kladder før du giver enheden til andre.",
        )}
      </p>
    </section>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
