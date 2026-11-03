import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Home,
  LogOut,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  User,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

const API_URL =
  localStorage.getItem("spcaAdminApiUrl") ||
  import.meta.env.VITE_API_URL ||
  "https://team08-api.onrender.com";

async function fetchJson(path, token, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const FIELD_STATUSES = [
  { value: "EN_ROUTE", label: "Heading to Location", sub: "I am on my way to the reported site." },
  { value: "ON_SCENE", label: "Arrived on Scene", sub: "I have reached the reported location." },
  { value: "HELPED", label: "Animal Helped", sub: "Animal has been assisted or rescued." },
  { value: "UNABLE_TO_LOCATE", label: "Unable to Locate", sub: "Could not find the animal at the site." },
];

function fieldStatusBadge(fieldStatus) {
  const map = {
    ASSIGNED: { label: "Assigned", cls: "fa-badge fa-badge-new" },
    EN_ROUTE: { label: "En Route", cls: "fa-badge fa-badge-progress" },
    ON_SCENE: { label: "On Scene", cls: "fa-badge fa-badge-progress" },
    HELPED: { label: "Helped", cls: "fa-badge fa-badge-done" },
    UNABLE_TO_LOCATE: { label: "Not Found", cls: "fa-badge fa-badge-warn" },
    UNASSIGNED: { label: "Pending", cls: "fa-badge fa-badge-muted" },
  };
  const entry = map[fieldStatus] || map.UNASSIGNED;
  return <span className={entry.cls}>{entry.label}</span>;
}

function groupReports(reports) {
  const newReports = reports.filter((report) => report.fieldStatus === "ASSIGNED" || report.fieldStatus === "UNASSIGNED");
  const activeReports = reports.filter((report) => report.fieldStatus === "EN_ROUTE" || report.fieldStatus === "ON_SCENE");
  const completedReports = reports.filter((report) => report.fieldStatus === "HELPED" || report.fieldStatus === "UNABLE_TO_LOCATE");
  return { newReports, activeReports, completedReports };
}

export default function FieldAgentApp({ onLogout, token, user }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("new");
  const [bottomNav, setBottomNav] = useState("home");
  const [selected, setSelected] = useState(null);
  const [updateView, setUpdateView] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateNotes, setUpdateNotes] = useState("");
  const [updateOutcome, setUpdateOutcome] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitOk, setSubmitOk] = useState("");

  async function loadReports() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson("/api/reports/stray", token);
      setReports(data.reports || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  async function submitFieldUpdate() {
    if (!updateStatus) return;
    setSubmitting(true);
    setSubmitError("");
    setSubmitOk("");
    try {
      const data = await fetchJson(`/api/reports/stray/${selected.id}/field-update`, token, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldStatus: updateStatus,
          fieldNotes: updateNotes || undefined,
          fieldOutcome: updateOutcome || undefined,
        }),
      });
      setReports((prev) => prev.map((r) => (r.id === data.report.id ? data.report : r)));
      setSelected(data.report);
      setSubmitOk("Status updated successfully.");
      setUpdateView(false);
      setUpdateStatus("");
      setUpdateNotes("");
      setUpdateOutcome("");
    } catch (e) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function openMaps(report) {
    if (report.latitude && report.longitude) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${report.latitude},${report.longitude}`,
        "_blank"
      );
    } else if (report.location) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(report.location)}`,
        "_blank"
      );
    }
  }

  const { newReports, activeReports, completedReports } = groupReports(reports);
  const tabReports = tab === "new" ? newReports : tab === "inprog" ? activeReports : completedReports;

  const completedCount = reports.filter(
    (r) => r.fieldStatus === "HELPED" || r.fieldStatus === "UNABLE_TO_LOCATE"
  ).length;

  if (updateView && selected) {
    return (
      <div className="fa-shell">
        <header className="fa-subheader">
          <button className="fa-back" onClick={() => { setUpdateView(false); setSubmitError(""); }}>
            <ArrowLeft size={20} />
          </button>
          <span>Update Status</span>
          <span />
        </header>

        <div className="fa-scroll-area">
          <div className="fa-update-meta">
            <strong>{selected.animalType}</strong>
            <span className="fa-loc"><MapPin size={13} /> {selected.location}</span>
          </div>

          <p className="fa-section-label">Current Status</p>
          <div className="fa-current-status">{fieldStatusBadge(selected.fieldStatus)}</div>

          <p className="fa-section-label">Update to</p>
          <div className="fa-radio-list">
            {FIELD_STATUSES.map((s) => (
              <label key={s.value} className={`fa-radio-row${updateStatus === s.value ? " selected" : ""}`}>
                <input
                  type="radio"
                  name="fieldStatus"
                  value={s.value}
                  checked={updateStatus === s.value}
                  onChange={() => setUpdateStatus(s.value)}
                />
                <span className="fa-radio-check">{updateStatus === s.value ? <CheckCircle2 size={20} /> : <span className="fa-radio-circle" />}</span>
                <span>
                  <strong>{s.label}</strong>
                  <small>{s.sub}</small>
                </span>
              </label>
            ))}
          </div>

          <p className="fa-section-label">Add Notes</p>
          <textarea
            className="fa-textarea"
            placeholder="Write any notes about the situation..."
            maxLength={1000}
            value={updateNotes}
            onChange={(e) => setUpdateNotes(e.target.value)}
          />
          <p className="fa-char-count">{updateNotes.length}/1000</p>

          {updateStatus === "HELPED" || updateStatus === "UNABLE_TO_LOCATE" ? (
            <>
              <p className="fa-section-label">Outcome</p>
              <textarea
                className="fa-textarea"
                placeholder="Describe what happened and what action was taken..."
                maxLength={1000}
                value={updateOutcome}
                onChange={(e) => setUpdateOutcome(e.target.value)}
              />
            </>
          ) : null}

          {submitError ? <p className="fa-error">{submitError}</p> : null}

          <button
            className="fa-primary-btn"
            disabled={!updateStatus || submitting}
            onClick={submitFieldUpdate}
          >
            {submitting ? "Updating..." : "Update Status"}
          </button>
        </div>
      </div>
    );
  }

  if (selected) {
    const img = selected.imageUrl || selected.images?.[0]?.dataUri;
    const isDone = selected.fieldStatus === "HELPED" || selected.fieldStatus === "UNABLE_TO_LOCATE";
    return (
      <div className="fa-shell">
        <header className="fa-subheader">
          <button className="fa-back" onClick={() => { setSelected(null); setSubmitOk(""); setSubmitError(""); }}>
            <ArrowLeft size={20} />
          </button>
          <span>Report Details</span>
          {fieldStatusBadge(selected.fieldStatus)}
        </header>

        <div className="fa-scroll-area">
          {img ? (
            <div className="fa-detail-img-wrap">
              <img src={img} alt="Animal" className="fa-detail-img" />
            </div>
          ) : null}

          <div className="fa-detail-body">
            <div className="fa-detail-top">
              <h2 className="fa-detail-title">
                {selected.animalType}
                {selected.condition ? ` — ${selected.condition}` : ""}
              </h2>
              <p className="fa-detail-loc"><MapPin size={14} /> {selected.location}</p>
              <p className="fa-detail-time">{timeAgo(selected.createdAt)}</p>
            </div>

            {selected.description ? (
              <div className="fa-detail-section">
                <p className="fa-section-label">Description</p>
                <p className="fa-detail-text">{selected.description}</p>
              </div>
            ) : null}

            {selected.reporter ? (
              <div className="fa-detail-section">
                <p className="fa-section-label">Reported by</p>
                <div className="fa-reporter-row">
                  <span className="fa-reporter-avatar"><User size={18} /></span>
                  <span className="fa-reporter-name">{selected.reporter.fullName || selected.reporterName || "Anonymous"}</span>
                  {selected.reporter.phone ? (
                    <a className="fa-call-btn" href={`tel:${selected.reporter.phone}`}>
                      <Phone size={16} />
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}

            {selected.fieldNotes ? (
              <div className="fa-detail-section">
                <p className="fa-section-label">Field Notes</p>
                <p className="fa-detail-text">{selected.fieldNotes}</p>
              </div>
            ) : null}

            {selected.fieldOutcome ? (
              <div className="fa-detail-section">
                <p className="fa-section-label">Outcome</p>
                <p className="fa-detail-text">{selected.fieldOutcome}</p>
              </div>
            ) : null}

            {submitOk ? <p className="fa-success">{submitOk}</p> : null}
            {submitError ? <p className="fa-error">{submitError}</p> : null}

            {!isDone ? (
              <div className="fa-detail-actions">
                <button className="fa-outline-btn" onClick={() => openMaps(selected)}>
                  <Navigation size={16} /> Navigate
                </button>
                <button className="fa-primary-btn" onClick={() => { setUpdateView(true); setUpdateStatus(""); setUpdateNotes(""); setUpdateOutcome(""); }}>
                  Update Status
                </button>
              </div>
            ) : (
              <div className="fa-done-banner">
                <CheckCircle2 size={18} /> Case closed
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (bottomNav === "profile") {
    return (
      <div className="fa-shell">
        <header className="fa-header">
          <img src="/assets/spca-logo.png" alt="SPCA" className="fa-header-logo" />
          <span className="fa-header-title">Profile</span>
        </header>

        <div className="fa-scroll-area fa-profile">
          <div className="fa-avatar-block">
            <span className="fa-avatar-lg">{user?.fullName?.slice(0, 1) || "A"}</span>
            <strong>{user?.fullName || "Field Agent"}</strong>
            <span className="fa-role-chip">Field Agent</span>
            {user?.id ? <small className="fa-agent-id">ID: FA-{user.id.slice(-6).toUpperCase()}</small> : null}
          </div>

          <div className="fa-profile-stats">
            <div className="fa-stat-block">
              <strong>{activeReports.length + newReports.length}</strong>
              <span>Active</span>
            </div>
            <div className="fa-stat-block">
              <strong>{completedCount}</strong>
              <span>Completed</span>
            </div>
            <div className="fa-stat-block">
              <strong>{reports.length}</strong>
              <span>Total</span>
            </div>
          </div>

          <div className="fa-profile-list">
            <div className="fa-profile-row">
              <span><User size={16} /> {user?.email}</span>
            </div>
          </div>

          <button className="fa-logout-btn" onClick={onLogout}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>

        <BottomNav active={bottomNav} onChange={setBottomNav} />
      </div>
    );
  }

  return (
    <div className="fa-shell">
      <header className="fa-header">
        <div className="fa-header-left">
          <img src="/assets/spca-logo.png" alt="SPCA" className="fa-header-logo" />
          <div>
            <span className="fa-greeting">Good {greeting()},</span>
            <strong className="fa-agent-name">{firstName(user?.fullName)}</strong>
          </div>
        </div>
        <button className="fa-refresh-btn" onClick={loadReports} title="Refresh">
          <RefreshCw size={18} className={loading ? "fa-spin" : ""} />
        </button>
      </header>

      <div className="fa-scroll-area">
        <div className="fa-stats-row">
          <button className={`fa-stat-card${tab === "new" ? " active" : ""}`} onClick={() => setTab("new")}>
            <strong>{newReports.length}</strong>
            <span>New</span>
          </button>
          <button className={`fa-stat-card${tab === "inprog" ? " active" : ""}`} onClick={() => setTab("inprog")}>
            <strong>{activeReports.length}</strong>
            <span>In Progress</span>
          </button>
          <button className={`fa-stat-card${tab === "done" ? " active" : ""}`} onClick={() => setTab("done")}>
            <strong>{completedReports.length}</strong>
            <span>Completed</span>
          </button>
        </div>

        <div className="fa-section-header">
          <span>Reports</span>
          <div className="fa-tab-pills">
            {[
              { key: "new", label: `New (${newReports.length})` },
              { key: "inprog", label: `In Progress (${activeReports.length})` },
              { key: "done", label: `Completed (${completedReports.length})` },
            ].map((t) => (
              <button
                key={t.key}
                className={`fa-pill${tab === t.key ? " active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="fa-error fa-error-card">
            <AlertCircle size={16} /> {error}
          </div>
        ) : loading ? (
          <div className="fa-loading">Loading cases...</div>
        ) : tabReports.length === 0 ? (
          <div className="fa-empty">
            <CheckCircle2 size={28} />
            <p>No {tab === "new" ? "new" : tab === "inprog" ? "in-progress" : "completed"} cases.</p>
          </div>
        ) : (
          <div className="fa-report-list">
            {tabReports.map((r) => {
              const img = r.imageUrl || r.images?.[0]?.dataUri;
              return (
                <button key={r.id} className="fa-report-card" onClick={() => { setSelected(r); setSubmitOk(""); setSubmitError(""); }}>
                  {img ? (
                    <img src={img} alt="" className="fa-report-thumb" />
                  ) : (
                    <span className="fa-report-thumb-placeholder">
                      {r.animalType?.[0] || "?"}
                    </span>
                  )}
                  <div className="fa-report-info">
                    <span className="fa-report-type">{r.animalType}</span>
                    <span className="fa-report-loc"><MapPin size={12} /> {r.location}</span>
                    <span className="fa-report-time"><Clock size={12} /> {timeAgo(r.createdAt)}</span>
                  </div>
                  <div className="fa-report-right">
                    {fieldStatusBadge(r.fieldStatus)}
                    <ChevronRight size={16} className="fa-chevron" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav active={bottomNav} onChange={setBottomNav} />
    </div>
  );
}

function BottomNav({ active, onChange }) {
  return (
    <nav className="fa-bottom-nav">
      <button className={`fa-nav-btn${active === "home" ? " active" : ""}`} onClick={() => onChange("home")}>
        <Home size={22} />
        <span>Home</span>
      </button>
      <button className={`fa-nav-btn${active === "reports" ? " active" : ""}`} onClick={() => onChange("home")}>
        <FileText size={22} />
        <span>Reports</span>
      </button>
      <button className={`fa-nav-btn${active === "profile" ? " active" : ""}`} onClick={() => onChange("profile")}>
        <User size={22} />
        <span>Profile</span>
      </button>
    </nav>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function firstName(fullName) {
  if (!fullName) return "Agent";
  return fullName.split(" ")[0];
}
