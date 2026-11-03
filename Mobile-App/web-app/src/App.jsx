import {
  Bell,
  BarChart3,
  CalendarDays,
  Camera,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Eye,
  FileText,
  Flag,
  Heart,
  Home,
  Hourglass,
  LayoutDashboard,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageSquare,
  PawPrint,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  User,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import AdoptionApplicationsPage from "./pages/AdoptionApplicationsPage.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";
import PetsManagementPage from "./pages/PetsManagementPage.jsx";
import StaffManagementPage from "./pages/StaffManagementPage.jsx";
import SurrenderRequestsPage from "./pages/SurrenderRequestsPage.jsx";
import { normalizeMediaItems, resolveMediaUrl } from "./utils/media.js";
import ReportsManagementPage from "./pages/ReportsManagementPage.jsx";

const logoUrl = "/assets/spca-logo.png";
const adoptionArtUrl = "/assets/adoption-animals.png";
const loginVideos = [
  "/assets/login-videos/14621052_1920_1080_24fps.mp4",
  "/assets/login-videos/7474425-hd_1920_1080_25fps.mp4",
  "/assets/login-videos/7516668-hd_1920_1080_30fps.mp4",
];

const API_URL = import.meta.env.DEV
  ? import.meta.env.VITE_API_URL || "http://localhost:3000"
  : localStorage.getItem("spcaAdminApiUrl") ||
    import.meta.env.VITE_API_URL ||
    "https://team08-api.onrender.com";
const SESSION_STORAGE_KEY = "spcaDashboardSession";

function readStoredSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || "null");

    if (session?.token && session?.user) {
      return session;
    }
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }

  return { mode: "", token: "", user: null };
}

function viewFromLocation() {
  const view = window.location.hash.slice(1).split("/")[0];
  return navigation.some((item) => item.id === view) ? view : "dashboard";
}

const applicationStatusOptions = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "DECLINED"];
const reportStatusOptions = ["OPEN", "IN_PROGRESS", "RESOLVED"];

const emptyDashboard = {
  metrics: {
    totalPets: 0,
    adoptionRequests: 0,
    registeredUsers: 0,
    successfulAdoptions: 0,
    donationsTotal: 0,
    activeReports: 0,
    pendingPets: 0,
    organizations: 0,
    appointments: 0,
  },
  adoptionOverview: [],
  petsByStatus: [],
  recentApplications: [],
  recentActivity: [],
  generatedAt: null,
};

const navigation = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "pets", label: "Animals", icon: PawPrint },
  { id: "adoptions", label: "Adoption Requests", icon: ShieldCheck },
  { id: "users", label: "Users", icon: User },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "staff", label: "Staff", icon: Users },
  { id: "surrenders", label: "Surrenders", icon: ClipboardList },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "appointments", label: "Appointments", icon: CalendarDays },
  { id: "donations", label: "Donations", icon: CircleDollarSign },
  { id: "settings", label: "Settings", icon: Settings },
];

const userNavigation = [
  { id: "home", label: "Home", icon: Home },
  { id: "adopt", label: "Adopt", icon: Heart },
  { id: "applications", label: "My Adoptions", icon: ClipboardList },
  { id: "report", label: "Report Stray", icon: Flag },
  { id: "reports", label: "My Reports", icon: FileText },
  { id: "profile", label: "Profile", icon: User },
];

const emptyAdoptionForm = {
  address: "",
  applicantName: "",
  email: "",
  experience: "",
  hasOtherPets: false,
  hasYard: false,
  housingType: "",
  otherPetsDetails: "",
  phone: "",
  reason: "",
  schedule: "",
};

const emptyReportForm = {
  age: "",
  animalType: "Dog",
  breed: "",
  color: "",
  condition: "",
  description: "",
  gender: "",
  latitude: "",
  location: "",
  longitude: "",
  photos: [],
};

function formatNumber(value) {
  return new Intl.NumberFormat().format(value ?? 0);
}

function formatCurrency(value) {
  return `R${new Intl.NumberFormat("en-ZA", {
    maximumFractionDigits: 0,
  }).format(value ?? 0)}`;
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatGeneratedAt(value) {
  if (!value) {
    return "Sign in to load live SPCA data.";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Live database stats are loaded.";
  }

  return `Live database stats updated ${date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  })}.`;
}

function normalizeStatus(status) {
  return String(status || "SUBMITTED")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status) {
  if (status === "APPROVED") return "approved";
  if (status === "RESOLVED") return "approved";
  if (status === "DECLINED") return "declined";
  if (status === "UNDER_REVIEW") return "review";
  if (status === "IN_PROGRESS") return "review";
  if (status === "PENDING") return "pending";
  if (status === "OPEN") return "submitted";
  return "submitted";
}

function pageTitle(view) {
  if (view === "pets") return "Animals";
  if (view === "adoptions") return "Adoption Requests";
  if (view === "reports") return "Reports";

  const match = navigation.find((item) => item.id === view);
  return match?.label || "Dashboard";
}

function pageDescription(view, dashboardLoading, generatedAt) {
  if (view === "dashboard") {
    return dashboardLoading ? "Loading live database stats..." : formatGeneratedAt(generatedAt);
  }

  if (view === "analytics") {
    return "Track outcomes, demand, workflow health, and service delivery.";
  }

  if (view === "adoptions") {
    return "Review applications, update statuses, and inspect applicant details.";
  }

  if (view === "pets") {
    return "Manage animal profiles, statuses, and linked photo galleries.";
  }

  if (view === "reports") {
    return "Manage stray animal reports and move each case through the rescue workflow.";
  }

  return "";
}

function activityIcon(kind) {
  if (kind === "adoption") return { icon: Users, tone: "violet" };
  if (kind === "report") return { icon: Flag, tone: "coral" };
  if (kind === "user") return { icon: User, tone: "blue" };
  return { icon: PawPrint, tone: "green" };
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson(path, token, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...authHeaders(token),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

function getAnimalImages(animal) {
  if (!animal) {
    return [];
  }

  if (animal.images?.length) {
    return normalizeMediaItems(animal.images);
  }

  if (animal.imageDataUri) {
    return [{ dataUri: resolveMediaUrl(animal.imageDataUri), id: `${animal.id || "animal"}-primary` }];
  }

  return [];
}

function getPrimaryAnimalImage(animal) {
  return getAnimalImages(animal)[0]?.dataUri || animal?.imageDataUri || "";
}

function fileToDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not prepare that photo."));
    reader.onload = () =>
      resolve({
        dataUri: String(reader.result || ""),
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
      });
    reader.readAsDataURL(file);
  });
}

function Sidebar({ activeView, mobileOpen, onClose, onLogout, onNavigate }) {
  return (
    <>
      <button
        aria-label="Close navigation"
        className={`sidebar-scrim ${mobileOpen ? "visible" : ""}`}
        onClick={onClose}
        type="button"
      />
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="brand">
          <img src={logoUrl} alt="SPCA logo" />
          <div>
            <strong>SPCA</strong>
            <span>Admin Platform</span>
          </div>
          <button className="icon-button sidebar-close" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <nav className="nav-list" aria-label="Admin navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={`nav-item ${activeView === item.id ? "active" : ""}`}
                key={item.label}
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                type="button"
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        

        <div className="admin-card">
          <img src={logoUrl} alt="" />
          <div>
            <strong>Admin User</strong>
            <span>Super Admin</span>
          </div>
         
        </div>
        <button className="sidebar-logout" onClick={onLogout} type="button">
          <LogOut size={19} />
          Logout
        </button>
      </aside>
    </>
  );
}

function getRandomLoginVideoIndex(currentIndex = -1) {
  if (loginVideos.length <= 1) {
    return 0;
  }

  let nextIndex = Math.floor(Math.random() * loginVideos.length);

  while (nextIndex === currentIndex) {
    nextIndex = Math.floor(Math.random() * loginVideos.length);
  }

  return nextIndex;
}

function LoginVideoBackground() {
  const [videoIndex, setVideoIndex] = useState(() => getRandomLoginVideoIndex());

  function handleVideoChange() {
    setVideoIndex((currentIndex) => getRandomLoginVideoIndex(currentIndex));
  }

  return (
    <div className="admin-login-video-wrap" aria-hidden="true">
      <video
        key={loginVideos[videoIndex]}
        autoPlay
        className="admin-login-video"
        loop={false}
        muted
        onEnded={handleVideoChange}
        onError={handleVideoChange}
        onLoadedMetadata={(event) => {
          event.currentTarget.playbackRate = 0.78;
        }}
        playsInline
        preload="auto"
        src={loginVideos[videoIndex]}
      />
      <div className="admin-login-video-blur" />
      <div className="admin-login-video-overlay" />
    </div>
  );
}

function AccessScreen({ error, loading, onLogin, onRegister }) {
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const registering = authMode === "register";

  function handleSubmit(event) {
    event.preventDefault();

    if (registering) {
      onRegister({ confirmPassword, email, fullName, password });
      return;
    }

    onLogin({ email, password });
  }

  return (
    <section className="admin-login-screen">
      <LoginVideoBackground />
      <main className="admin-login-content">
        <header className="admin-login-header">
          <img src={logoUrl} alt="SPCA logo" />
          <h1>{registering ? "Create account" : "Welcome back"}</h1>
          <p>{registering ? "Be the change animals need." : "Sign in to continue."}</p>
        </header>

        <form className="admin-login-form" onSubmit={handleSubmit}>
          {registering ? (
            <label>
              <span>Full Name</span>
              <input
                autoComplete="name"
                autoFocus
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Enter your full name"
                required
                value={fullName}
              />
            </label>
          ) : null}

          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              autoFocus={!registering}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              required
              type="email"
              value={email}
            />
          </label>

          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
              type="password"
              value={password}
            />
          </label>

          {registering ? (
            <label>
              <span>Confirm Password</span>
              <input
                autoComplete="new-password"
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm your password"
                required
                type="password"
                value={confirmPassword}
              />
            </label>
          ) : null}

          {error ? <span className="admin-login-error">{error}</span> : null}

          <button className="admin-login-button" disabled={loading} type="submit">
            {loading ? (
              <span className="admin-login-spinner" aria-label="Signing in" />
            ) : (
              <>
                <LogIn size={18} />
                {registering ? "Register" : "Sign in"}
              </>
            )}
          </button>

          <div className="auth-switch-row">
            <span>{registering ? "Already have an account?" : "New here?"}</span>
            <button
              onClick={() => setAuthMode((current) => (current === "login" ? "register" : "login"))}
              type="button"
            >
              {registering ? "Sign in" : "Create account"}
            </button>
          </div>
        </form>
      </main>
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, note, tone }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}>
        <Icon size={27} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{note}</p>
      </div>
    </article>
  );
}

function LineChart({ data }) {
  if (!data.length) {
    return <div className="empty-panel">No adoption applications in the database yet.</div>;
  }

  const width = 720;
  const height = 260;
  const left = 46;
  const right = 18;
  const top = 20;
  const bottom = 38;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const values = data.map((item) => item.value);
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => {
    const x = left + (plotWidth / Math.max(1, values.length - 1)) * index;
    const y = top + plotHeight - (value / max) * plotHeight;
    return [x, y];
  });
  const path = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const areaPath = `${path} L${left + plotWidth},${top + plotHeight} L${left},${top + plotHeight} Z`;
  const highIndex = values.indexOf(Math.max(...values));
  const highlight = points[highIndex] || points[0];
  const highlightItem = data[highIndex] || data[0];
  const labelIndexes = [0, 6, 13, 20, 27, data.length - 1].filter(
    (index, position, all) => index >= 0 && index < data.length && all.indexOf(index) === position
  );

  return (
    <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img">
      <defs>
        <linearGradient id="lineGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#0F6EA8" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0F6EA8" stopOpacity="0" />
        </linearGradient>
      </defs>

      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const value = Math.round(max * ratio);
        const y = top + plotHeight - ratio * plotHeight;
        return (
          <g key={ratio}>
            <line className="chart-grid-line" x1={left} x2={left + plotWidth} y1={y} y2={y} />
            <text className="chart-label" x="8" y={y + 4}>
              {value}
            </text>
          </g>
        );
      })}

      {labelIndexes.map((index) => {
        const x = left + (plotWidth / Math.max(1, data.length - 1)) * index;
        return (
          <text className="chart-label" key={index} x={x - 18} y={height - 8}>
            {data[index].label}
          </text>
        );
      })}

      <path className="chart-area" d={areaPath} />
      <path className="chart-line" d={path} />
      <circle className="chart-dot" cx={highlight[0]} cy={highlight[1]} r="7" />
      <g transform={`translate(${Math.max(10, highlight[0] - 70)}, ${Math.max(8, highlight[1] - 78)})`}>
        <rect className="chart-tooltip-card" height="56" rx="13" width="142" x="0" y="0" />
        <text className="tooltip-muted" x="18" y="22">
          {highlightItem.label}
        </text>
        <circle cx="20" cy="39" fill="#0F6EA8" r="4" />
        <text className="tooltip-main" x="32" y="43">
          Applications: {highlightItem.value}
        </text>
      </g>
    </svg>
  );
}

function DonutChart({ data }) {
  const palette = ["#0F6EA8", "#2F7D4F", "#7BA8C8", "#C9D7E3", "#B42318"];
  const segments = data.map((segment, index) => ({
    ...segment,
    color: palette[index % palette.length],
  }));
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  let offset = 25;

  return (
    <div className="status-content">
      <svg className="donut-chart" viewBox="0 0 220 220" role="img">
        <circle cx="110" cy="110" fill="none" r="74" stroke="#edf2f7" strokeWidth="34" />
        {total
          ? segments.map((segment) => {
              const dash = (segment.value / total) * 465;
              const currentOffset = offset;
              offset -= dash;
              return (
                <circle
                  cx="110"
                  cy="110"
                  fill="none"
                  key={segment.status}
                  r="74"
                  stroke={segment.color}
                  strokeDasharray={`${dash} ${465 - dash}`}
                  strokeDashoffset={currentOffset}
                  strokeWidth="34"
                  transform="rotate(-90 110 110)"
                />
              );
            })
          : null}
        <circle cx="110" cy="110" fill="#fff" r="48" />
        <text className="donut-total" textAnchor="middle" x="110" y="106">
          {formatNumber(total)}
        </text>
        <text className="donut-label" textAnchor="middle" x="110" y="128">
          Total
        </text>
      </svg>

      <div className="status-legend">
        {total ? (
          segments.map((segment) => {
            const percent = Math.round((segment.value / total) * 1000) / 10;
            return (
              <div className="legend-item" key={segment.status}>
                <span className="legend-dot" style={{ backgroundColor: segment.color }} />
                <div>
                  <strong>{segment.label}</strong>
                  <span>
                    {formatNumber(segment.value)} ({percent}%)
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-panel">No pet statuses in the database yet.</div>
        )}
      </div>
    </div>
  );
}

function ActivityList({ items }) {
  if (!items.length) {
    return <div className="empty-panel">No recent database activity yet.</div>;
  }

  return (
    <div className="activity-list">
      {items.slice(0, 5).map((item) => {
        const tone = activityIcon(item.kind);
        const Icon = tone.icon;
        return (
          <div className="activity-item" key={item.id}>
            <span className={`activity-icon ${tone.tone}`}>
              <Icon size={22} />
            </span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </div>
            <time>{item.timeLabel}</time>
          </div>
        );
      })}
    </div>
  );
}

function RequestsTable({ applications, onView, query }) {
  const visibleApplications = applications
    .filter((application) => {
      const animal = application.animal || {};
      return [animal.name, animal.type, application.applicantName, application.email, application.status]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase());
    })
    .slice(0, 6);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Pet</th>
            <th>Requester</th>
            <th>Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {visibleApplications.length ? (
            visibleApplications.map((application) => {
              const animal = application.animal || {};
              return (
                <tr key={application.id}>
                  <td>
                    <div className="pet-cell">
                      <span className="pet-avatar">
                        <PawPrint size={18} />
                      </span>
                      <div>
                        <strong>{animal.name || "Pet"}</strong>
                        <span>{animal.type || "Animal"}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="requester-cell">
                      <strong>{application.applicantName || "Applicant"}</strong>
                      <span>{application.email || "No email"}</span>
                    </div>
                  </td>
                  <td>{formatDate(application.createdAt)}</td>
                  <td>
                    <span className={`status-pill ${statusClass(application.status)}`}>
                      {normalizeStatus(application.status)}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="mini-action" onClick={() => onView?.("adoption", application)} type="button">
                        <Eye size={16} />
                      </button>
                      <button className="mini-action" onClick={() => onView?.("adoption", application)} type="button">
                        <ChevronRight size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td className="empty-row" colSpan="5">
                No adoption applications found in the database.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function QuickStat({ icon: Icon, label, tone, value }) {
  return (
    <div className={`quick-stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <Icon size={28} />
    </div>
  );
}

function RecordThumb({ animal }) {
  if (animal?.imageDataUri) {
    return <img className="record-thumb" src={animal.imageDataUri} alt="" />;
  }

  return (
    <span className="pet-avatar record-thumb-fallback">
      <PawPrint size={16} />
    </span>
  );
}

function StatusSelect({ disabled, onChange, options, value }) {
  return (
    <select
      className={`status-select ${statusClass(value)}`}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {normalizeStatus(option)}
        </option>
      ))}
    </select>
  );
}

function DetailPanel({ item, onClose, type }) {
  if (!item) {
    return null;
  }

  const isAdoption = type === "adoption";
  const animal = item.animal || {};
  const title = isAdoption ? `${animal.name || "Pet"} application` : `${item.animalType || "Animal"} report`;
  const rows = isAdoption
    ? [
        ["Applicant", item.applicantName || "Unknown"],
        ["Email", item.email || "No email"],
        ["Phone", item.phone || "No phone"],
        ["Address", item.address || "No address"],
        ["Housing", item.housingType || "Unknown"],
        ["Yard", item.hasYard ? "Yes" : "No"],
        ["Other pets", item.hasOtherPets ? item.otherPetsDetails || "Yes" : "No"],
        ["Experience", item.experience || "Not provided"],
        ["Schedule", item.schedule || "Not provided"],
        ["Reason", item.reason || "Not provided"],
      ]
    : [
        ["Reporter", item.reporterName || "Anonymous"],
        ["Animal", item.animalType || "Unknown"],
        ["Condition", item.condition || "Not provided"],
        ["Location", item.location || "No location"],
        ["Coordinates", item.latitude && item.longitude ? `${item.latitude}, ${item.longitude}` : "Not provided"],
        ["Description", item.description || "No description"],
      ];

  return (
    <article className="detail-panel">
      <div className="detail-header">
        <div>
          <span className={`status-pill ${statusClass(item.status)}`}>{normalizeStatus(item.status)}</span>
          <h3>{title}</h3>
          <p>Created {formatDate(item.createdAt)}</p>
        </div>
        <button className="icon-button" onClick={onClose} type="button">
          <X size={18} />
        </button>
      </div>

      <dl className="detail-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function AdoptionsView({ applications, busyId, loading, onStatusChange, onView, query, selectedDetail, onCloseDetail }) {
  const filteredApplications = applications.filter((application) => {
    const animal = application.animal || {};
    return [animal.name, animal.type, animal.breed, application.applicantName, application.email, application.status]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase());
  });

  return (
    <section className="management-view">
      <DetailPanel item={selectedDetail?.type === "adoption" ? selectedDetail.item : null} onClose={onCloseDetail} type="adoption" />

      <article className="panel management-panel">
        <div className="panel-header">
          <h2>All Adoption Requests</h2>
          <span className="panel-count">{loading ? "Loading..." : `${filteredApplications.length} shown`}</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pet</th>
                <th>Applicant</th>
                <th>Contact</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.length ? (
                filteredApplications.map((application) => {
                  const animal = application.animal || {};
                  return (
                    <tr key={application.id}>
                      <td>
                        <div className="pet-cell">
                          <RecordThumb animal={animal} />
                          <div>
                            <strong>{animal.name || "Pet"}</strong>
                            <span>{animal.breed || animal.type || "Animal"}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="requester-cell">
                          <strong>{application.applicantName || "Applicant"}</strong>
                          <span>{application.housingType || "Housing unknown"}</span>
                        </div>
                      </td>
                      <td>
                        <div className="requester-cell">
                          <strong>{application.email || "No email"}</strong>
                          <span>{application.phone || "No phone"}</span>
                        </div>
                      </td>
                      <td>{formatDate(application.createdAt)}</td>
                      <td>
                        <StatusSelect
                          disabled={busyId === application.id}
                          onChange={(status) => onStatusChange(application.id, status)}
                          options={applicationStatusOptions}
                          value={application.status}
                        />
                      </td>
                      <td>
                        <button className="mini-action" onClick={() => onView("adoption", application)} type="button">
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="empty-row" colSpan="6">
                    No adoption applications found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

function ReportsView({ busyId, loading, onCloseDetail, onStatusChange, onView, query, reports, selectedDetail }) {
  const filteredReports = reports.filter((report) =>
    [report.reporterName, report.animalType, report.condition, report.location, report.description, report.status]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  return (
    <section className="management-view">
      <DetailPanel item={selectedDetail?.type === "report" ? selectedDetail.item : null} onClose={onCloseDetail} type="report" />

      <article className="panel management-panel">
        <div className="panel-header">
          <h2>All Reports</h2>
          <span className="panel-count">{loading ? "Loading..." : `${filteredReports.length} shown`}</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Report</th>
                <th>Reporter</th>
                <th>Location</th>
                <th>Created</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.length ? (
                filteredReports.map((report) => (
                  <tr key={report.id}>
                    <td>
                      <div className="pet-cell">
                        {report.imageUrl ? (
                          <img className="record-thumb" src={report.imageUrl} alt="" />
                        ) : (
                          <span className="pet-avatar record-thumb-fallback">
                            <Flag size={16} />
                          </span>
                        )}
                        <div>
                          <strong>{report.animalType || "Animal"}</strong>
                          <span>{report.condition || "Condition unknown"}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="requester-cell">
                        <strong>{report.reporterName || "Anonymous"}</strong>
                        <span>{report.reporterId ? "Signed in" : "Anonymous"}</span>
                      </div>
                    </td>
                    <td>{report.location || "No location"}</td>
                    <td>{formatDate(report.createdAt)}</td>
                    <td>
                      <StatusSelect
                        disabled={busyId === report.id}
                        onChange={(status) => onStatusChange(report.id, status)}
                        options={reportStatusOptions}
                        value={report.status}
                      />
                    </td>
                    <td>
                      <button className="mini-action" onClick={() => onView("report", report)} type="button">
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="empty-row" colSpan="6">
                    No reports found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

function PlaceholderView({ title }) {
  return (
    <section className="management-view">
      <article className="panel placeholder-panel">
        <span className="placeholder-icon">
          <Plus size={20} />
        </span>
        <h2>{title}</h2>
      </article>
    </section>
  );
}

function PortalNav({ activeView, onNavigate, onLogout, user }) {
  return (
    <header className="user-portal-header">
      <div className="user-portal-brand">
        <img src={logoUrl} alt="SPCA logo" />
        <div>
          <strong>SPCA</strong>
          <span>Animal Welfare Hub</span>
        </div>
      </div>

      <nav className="user-portal-nav" aria-label="User navigation">
        {userNavigation.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={activeView === item.id ? "active" : ""}
              key={item.id}
              onClick={() => onNavigate(item.id)}
              type="button"
            >
              <Icon size={17} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="user-portal-account">
        <span>{user?.fullName || "User"}</span>
        <button className="secondary-button" onClick={onLogout} type="button">
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </header>
  );
}

function UserStat({ icon: Icon, label, value }) {
  return (
    <article className="user-stat-card">
      <span>
        <Icon size={19} />
      </span>
      <strong>{value}</strong>
      <small>{label}</small>
    </article>
  );
}

function AnimalCard({ animal, active, onSelect }) {
  const image = getPrimaryAnimalImage(animal);

  return (
    <button className={`user-animal-card ${active ? "active" : ""}`} onClick={() => onSelect(animal.id)} type="button">
      {image ? (
        <img src={image} alt="" />
      ) : (
        <span className="user-empty-media">
          <PawPrint size={28} />
        </span>
      )}
      <div>
        <strong>{animal.name}</strong>
        <span>{animal.breed || animal.type}</span>
      </div>
      <em className={`status-pill ${statusClass(animal.status)}`}>{normalizeStatus(animal.status)}</em>
    </button>
  );
}

function UserHomeView({ animals, onNavigate, onSelectAnimal, user }) {
  const firstName = user?.fullName?.split(" ")[0] || "there";
  const featuredAnimals = animals.slice(0, 6);

  return (
    <div className="user-view-stack">
      <section className="user-hero-panel">
        <div>
          <span className="eyebrow">Hello {firstName}</span>
          <h1>Animal Welfare Hub</h1>
          <p>Adopt, report a stray animal, and track updates from the shelter in one place.</p>
          <div className="user-hero-actions">
            <button className="primary-button" onClick={() => onNavigate("adopt")} type="button">
              <Heart size={17} />
              Browse Pets
            </button>
            <button className="secondary-button" onClick={() => onNavigate("report")} type="button">
              <Flag size={17} />
              Report Stray
            </button>
          </div>
        </div>
        <img src={adoptionArtUrl} alt="" />
      </section>

      <section className="user-priority-grid">
        <button onClick={() => onNavigate("report")} type="button">
          <PawPrint size={22} />
          <strong>Report stray</strong>
          <span>Help stray animals get seen faster.</span>
        </button>
        <button onClick={() => onNavigate("adopt")} type="button">
          <Heart size={22} />
          <strong>Adopt</strong>
          <span>Meet animals waiting for homes.</span>
        </button>
        <button onClick={() => onNavigate("profile")} type="button">
          <User size={22} />
          <strong>Profile</strong>
          <span>Track your reports and applications.</span>
        </button>
      </section>

      <section className="user-section">
        <div className="user-section-header">
          <div>
            <h2>Available for Adoption</h2>
            <p>Meet a few animals waiting for homes.</p>
          </div>
          <button className="secondary-button" onClick={() => onNavigate("adopt")} type="button">
            View All
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="user-animal-grid">
          {featuredAnimals.map((animal) => (
            <AnimalCard
              active={false}
              animal={animal}
              key={animal.id}
              onSelect={(id) => {
                onSelectAnimal(id);
                onNavigate("adopt");
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function AdoptionForm({ animal, busy, form, onChange, onSubmit, user }) {
  useEffect(() => {
    onChange({
      ...form,
      applicantName: form.applicantName || user?.fullName || "",
      email: form.email || user?.email || "",
    });
  }, [animal?.id]);

  return (
    <form className="user-form" onSubmit={onSubmit}>
      <div className="user-form-grid">
        <label>
          <span>Full Name</span>
          <input value={form.applicantName} onChange={(event) => onChange({ ...form, applicantName: event.target.value })} required />
        </label>
        <label>
          <span>Email</span>
          <input type="email" value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} required />
        </label>
        <label>
          <span>Phone</span>
          <input value={form.phone} onChange={(event) => onChange({ ...form, phone: event.target.value })} required />
        </label>
        <label>
          <span>Housing Type</span>
          <input placeholder="House, flat, townhouse" value={form.housingType} onChange={(event) => onChange({ ...form, housingType: event.target.value })} required />
        </label>
      </div>
      <label>
        <span>Address</span>
        <input value={form.address} onChange={(event) => onChange({ ...form, address: event.target.value })} required />
      </label>
      <label>
        <span>Why do you want to adopt {animal?.name || "this pet"}?</span>
        <textarea value={form.reason} onChange={(event) => onChange({ ...form, reason: event.target.value })} required rows={4} />
      </label>
      <div className="user-form-grid">
        <label>
          <span>Pet care experience</span>
          <textarea value={form.experience} onChange={(event) => onChange({ ...form, experience: event.target.value })} rows={3} />
        </label>
        <label>
          <span>Daily schedule</span>
          <textarea value={form.schedule} onChange={(event) => onChange({ ...form, schedule: event.target.value })} rows={3} />
        </label>
      </div>
      <label>
        <span>Other pets details</span>
        <input value={form.otherPetsDetails} onChange={(event) => onChange({ ...form, otherPetsDetails: event.target.value })} />
      </label>
      <div className="user-checkbox-row">
        <label>
          <input checked={form.hasYard} onChange={(event) => onChange({ ...form, hasYard: event.target.checked })} type="checkbox" />
          Has a yard
        </label>
        <label>
          <input checked={form.hasOtherPets} onChange={(event) => onChange({ ...form, hasOtherPets: event.target.checked })} type="checkbox" />
          Has other pets
        </label>
      </div>
      <button className="primary-button" disabled={busy || !animal} type="submit">
        <Heart size={17} />
        {busy ? "Submitting..." : "Submit Application"}
      </button>
    </form>
  );
}

function UserAdoptView({ adoptionForm, animals, busy, onAdoptionFormChange, onApply, onSelectAnimal, selectedAnimal, user }) {
  const [typeFilter, setTypeFilter] = useState("ALL");
  const visibleAnimals = animals.filter((animal) => typeFilter === "ALL" || animal.type === typeFilter);
  const images = getAnimalImages(selectedAnimal);
  const activeImage = images[0]?.dataUri || selectedAnimal?.imageDataUri;

  return (
    <div className="user-adopt-layout">
      <section className="user-section">
        <div className="user-section-header">
          <div>
            <h1>Adopt</h1>
            <p>Browse shelter animals and apply from the profile.</p>
          </div>
          <select className="user-select" onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
            <option value="ALL">All Types</option>
            <option value="Dog">Dogs</option>
            <option value="Cat">Cats</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="user-animal-grid">
          {visibleAnimals.map((animal) => (
            <AnimalCard
              active={selectedAnimal?.id === animal.id}
              animal={animal}
              key={animal.id}
              onSelect={onSelectAnimal}
            />
          ))}
        </div>
      </section>

      <aside className="user-detail-panel">
        {selectedAnimal ? (
          <>
            {activeImage ? <img className="user-detail-image" src={activeImage} alt="" /> : null}
            <div className="user-detail-copy">
              <span className={`status-pill ${statusClass(selectedAnimal.status)}`}>{normalizeStatus(selectedAnimal.status)}</span>
              <h2>{selectedAnimal.name}</h2>
              <p>{selectedAnimal.type} - {selectedAnimal.breed}</p>
              <div className="user-detail-grid">
                <span>Age<strong>{selectedAnimal.age}</strong></span>
                <span>Gender<strong>{selectedAnimal.sex}</strong></span>
                <span>Size<strong>{selectedAnimal.size}</strong></span>
                <span>Energy<strong>{selectedAnimal.energy}</strong></span>
              </div>
              <p>{selectedAnimal.story}</p>
              <div className="personality-row">
                {(selectedAnimal.personality || []).slice(0, 6).map((trait) => (
                  <span key={trait}>{trait}</span>
                ))}
              </div>
            </div>
            <AdoptionForm
              animal={selectedAnimal}
              busy={busy}
              form={adoptionForm}
              onChange={onAdoptionFormChange}
              onSubmit={onApply}
              user={user}
            />
          </>
        ) : (
          <div className="user-empty-state">No animals loaded yet.</div>
        )}
      </aside>
    </div>
  );
}

function UserApplicationsView({ applications, onNavigate }) {
  const activeApplications = applications.filter((application) => application.status !== "DECLINED");
  const approvedApplications = applications.filter((application) => application.status === "APPROVED");
  const declinedApplications = applications.filter((application) => application.status === "DECLINED");

  return (
    <div className="user-view-stack">
      <section className="user-stats-grid">
        <UserStat icon={ClockIcon} label="Active" value={activeApplications.length} />
        <UserStat icon={CheckCircle2} label="Approved" value={approvedApplications.length} />
        <UserStat icon={ClipboardList} label="Previous" value={declinedApplications.length} />
      </section>
      <section className="user-section">
        <div className="user-section-header">
          <div>
            <h1>My Adoptions</h1>
            <p>Track the status of applications you submit.</p>
          </div>
          <button className="primary-button" onClick={() => onNavigate("adopt")} type="button">
            <Plus size={17} />
            Browse Pets
          </button>
        </div>
        <div className="user-record-list">
          {applications.length ? (
            applications.map((application) => {
              const image = getPrimaryAnimalImage(application.animal);
              return (
                <article className="user-record-card" key={application.id}>
                  {image ? <img src={image} alt="" /> : <span className="user-empty-media"><PawPrint size={24} /></span>}
                  <div>
                    <span className={`status-pill ${statusClass(application.status)}`}>{normalizeStatus(application.status)}</span>
                    <h3>{application.animal?.name || "Pet"} application</h3>
                    <p>{application.animal?.breed || application.animal?.type || "Animal"} - Applied {formatDate(application.createdAt)}</p>
                    <small>{application.status === "APPROVED" ? "The shelter can help arrange next steps." : "The shelter team will review and contact you."}</small>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="user-empty-state">
              <Heart size={32} />
              <h3>No applications yet</h3>
              <p>Applications you submit will appear here.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function UserReportView({ busy, form, onChange, onPhotoChange, onRemovePhoto, onSubmit }) {
  return (
    <section className="user-section">
      <div className="user-section-header">
        <div>
          <h1>Report Stray Animal</h1>
          <p>Share the animal, location, condition, and photos if you have them.</p>
        </div>
      </div>
      <form className="user-form" onSubmit={onSubmit}>
        <div className="user-form-grid">
          <label>
            <span>Animal Type</span>
            <select value={form.animalType} onChange={(event) => onChange({ ...form, animalType: event.target.value })}>
              <option>Dog</option>
              <option>Cat</option>
              <option>Other</option>
            </select>
          </label>
          <label>
            <span>Condition</span>
            <input placeholder="Injured, scared, thin..." value={form.condition} onChange={(event) => onChange({ ...form, condition: event.target.value })} />
          </label>
          <label>
            <span>Breed</span>
            <input value={form.breed} onChange={(event) => onChange({ ...form, breed: event.target.value })} />
          </label>
          <label>
            <span>Color</span>
            <input value={form.color} onChange={(event) => onChange({ ...form, color: event.target.value })} />
          </label>
          <label>
            <span>Age</span>
            <input placeholder="Puppy, adult, senior" value={form.age} onChange={(event) => onChange({ ...form, age: event.target.value })} />
          </label>
          <label>
            <span>Gender</span>
            <input value={form.gender} onChange={(event) => onChange({ ...form, gender: event.target.value })} />
          </label>
        </div>
        <label>
          <span>Location</span>
          <input placeholder="Street, suburb, landmark" value={form.location} onChange={(event) => onChange({ ...form, location: event.target.value })} required />
        </label>
        <div className="user-form-grid">
          <label>
            <span>Latitude</span>
            <input value={form.latitude} onChange={(event) => onChange({ ...form, latitude: event.target.value })} />
          </label>
          <label>
            <span>Longitude</span>
            <input value={form.longitude} onChange={(event) => onChange({ ...form, longitude: event.target.value })} />
          </label>
        </div>
        <label>
          <span>Additional Details</span>
          <textarea value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} required rows={5} />
        </label>
        <label>
          <span>Photos</span>
          <input accept="image/*" multiple onChange={onPhotoChange} type="file" />
        </label>
        {form.photos.length ? (
          <div className="user-photo-strip">
            {form.photos.map((photo) => (
              <button key={photo.dataUri} onClick={() => onRemovePhoto(photo.dataUri)} type="button">
                <img src={photo.dataUri} alt="" />
                <span>Remove</span>
              </button>
            ))}
          </div>
        ) : null}
        <button className="primary-button" disabled={busy} type="submit">
          <Flag size={17} />
          {busy ? "Submitting..." : "Submit Report"}
        </button>
      </form>
    </section>
  );
}

function UserReportsView({ onNavigate, reports }) {
  return (
    <section className="user-section">
      <div className="user-section-header">
        <div>
          <h1>My Reports</h1>
          <p>Reports linked to your account appear here.</p>
        </div>
        <button className="primary-button" onClick={() => onNavigate("report")} type="button">
          <Plus size={17} />
          Create Report
        </button>
      </div>
      <div className="user-record-list">
        {reports.length ? (
          reports.map((report) => {
            const image = report.images?.[0]?.dataUri || report.imageUrl;
            return (
              <article className="user-record-card" key={report.id}>
                {image ? <img src={image} alt="" /> : <span className="user-empty-media"><Flag size={24} /></span>}
                <div>
                  <span className={`status-pill ${statusClass(report.status)}`}>{normalizeStatus(report.status)}</span>
                  <h3>{report.animalType || "Animal"} report</h3>
                  <p>{report.location || "No location"} - Reported {formatDate(report.createdAt)}</p>
                  <small>{report.status === "RESOLVED" ? "This report has been resolved." : "Your report has been received and is being handled."}</small>
                </div>
              </article>
            );
          })
        ) : (
          <div className="user-empty-state">
            <Flag size={32} />
            <h3>No reports yet</h3>
            <p>New reports you submit while signed in will appear here.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function UserProfileView({ applications, onNavigate, onLogout, reports, user }) {
  return (
    <div className="user-profile-grid">
      <section className="user-section">
        <div className="user-profile-head">
          <span>{(user.fullName || "U").slice(0, 1)}</span>
          <div>
            <h1>{user.fullName}</h1>
            <p>{user.email}</p>
          </div>
        </div>
        <div className="user-detail-grid">
          <span>Joined<strong>{formatDate(user.createdAt)}</strong></span>
          <span>Applications<strong>{applications.length}</strong></span>
          <span>Reports<strong>{reports.length}</strong></span>
          <span>Role<strong>{normalizeStatus(user.role)}</strong></span>
        </div>
        <button className="secondary-button" onClick={onLogout} type="button">
          <LogOut size={16} />
          Logout
        </button>
      </section>

      <section className="user-section">
        <h2>Quick actions</h2>
        <div className="user-profile-actions">
          <button onClick={() => onNavigate("adopt")} type="button"><Heart size={18} /> Browse pets</button>
          <button onClick={() => onNavigate("report")} type="button"><Flag size={18} /> Report stray</button>
          <button onClick={() => onNavigate("applications")} type="button"><ClipboardList size={18} /> My adoptions</button>
          <button onClick={() => onNavigate("reports")} type="button"><FileText size={18} /> My reports</button>
        </div>
      </section>
    </div>
  );
}

function ClockIcon(props) {
  return <Hourglass {...props} />;
}

function UserPortal({ onLogout, token, user }) {
  const [activeView, setActiveView] = useState("home");
  const [animals, setAnimals] = useState([]);
  const [applications, setApplications] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedAnimalId, setSelectedAnimalId] = useState("");
  const [adoptionForm, setAdoptionForm] = useState(emptyAdoptionForm);
  const [reportForm, setReportForm] = useState(emptyReportForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const selectedAnimal = animals.find((animal) => animal.id === selectedAnimalId) || animals[0] || null;

  async function loadPortalData() {
    setLoading(true);
    setError("");

    try {
      const [animalData, applicationData, reportData] = await Promise.all([
        fetchJson("/api/animals/shelter", token),
        fetchJson("/api/adoptions/applications", token),
        fetchJson("/api/reports/stray", token),
      ]);
      setAnimals(animalData.animals || []);
      setApplications(applicationData.applications || []);
      setReports(reportData.reports || []);
      if (!selectedAnimalId && animalData.animals?.[0]?.id) {
        setSelectedAnimalId(animalData.animals[0].id);
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPortalData();
  }, [token]);

  useEffect(() => {
    setAdoptionForm((current) => ({
      ...current,
      applicantName: user?.fullName || "",
      email: user?.email || "",
    }));
  }, [user?.email, user?.fullName]);

  async function handleApply(event) {
    event.preventDefault();

    if (!selectedAnimal) {
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        address: adoptionForm.address.trim(),
        animalId: selectedAnimal.id,
        applicantName: adoptionForm.applicantName.trim(),
        email: adoptionForm.email.trim(),
        experience: adoptionForm.experience.trim() || undefined,
        hasOtherPets: adoptionForm.hasOtherPets,
        hasYard: adoptionForm.hasYard,
        housingType: adoptionForm.housingType.trim(),
        otherPetsDetails: adoptionForm.otherPetsDetails.trim() || undefined,
        phone: adoptionForm.phone.trim(),
        reason: adoptionForm.reason.trim(),
        schedule: adoptionForm.schedule.trim() || undefined,
        householdAgreement: true,
      };

      await fetchJson("/api/adoptions/applications", token, {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setNotice(`Application for ${selectedAnimal.name} submitted.`);
      setAdoptionForm({
        ...emptyAdoptionForm,
        applicantName: user.fullName || "",
        email: user.email || "",
      });
      const applicationData = await fetchJson("/api/adoptions/applications", token);
      setApplications(applicationData.applications || []);
      setActiveView("applications");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReportPhotos(event) {
    const files = Array.from(event.target.files || []).slice(0, 6 - reportForm.photos.length);

    if (!files.length) {
      return;
    }

    try {
      const photos = await Promise.all(files.map(fileToDataUri));
      setReportForm((current) => ({ ...current, photos: [...current.photos, ...photos].slice(0, 6) }));
    } catch (photoError) {
      setError(photoError.message);
    } finally {
      event.target.value = "";
    }
  }

  function handleRemoveReportPhoto(dataUri) {
    setReportForm((current) => ({
      ...current,
      photos: current.photos.filter((photo) => photo.dataUri !== dataUri),
    }));
  }

  async function handleSubmitReport(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    const description = [
      `Breed: ${reportForm.breed.trim() || "Unknown"}`,
      `Color: ${reportForm.color.trim() || "Not provided"}`,
      `Age: ${reportForm.age.trim() || "Not provided"}`,
      `Gender: ${reportForm.gender.trim() || "Not provided"}`,
      `Additional details: ${reportForm.description.trim()}`,
    ].join("\n");

    try {
      await fetchJson("/api/reports/stray", token, {
        body: JSON.stringify({
          animalType: reportForm.animalType,
          condition: reportForm.condition.trim() || undefined,
          description,
          images: reportForm.photos,
          latitude: reportForm.latitude ? Number(reportForm.latitude) : undefined,
          location: reportForm.location.trim(),
          longitude: reportForm.longitude ? Number(reportForm.longitude) : undefined,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setNotice("Stray animal report submitted.");
      setReportForm(emptyReportForm);
      const reportData = await fetchJson("/api/reports/stray", token);
      setReports(reportData.reports || []);
      setActiveView("reports");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="user-portal-shell">
      <PortalNav activeView={activeView} onLogout={onLogout} onNavigate={setActiveView} user={user} />
      <main className="user-portal-main">
        {error ? <div className="inline-error">{error}</div> : null}
        {notice ? <div className="inline-success">{notice}</div> : null}
        {loading ? <div className="user-empty-state">Loading your SPCA web app...</div> : null}

        {!loading && activeView === "home" ? (
          <UserHomeView animals={animals} onNavigate={setActiveView} onSelectAnimal={setSelectedAnimalId} user={user} />
        ) : null}
        {!loading && activeView === "adopt" ? (
          <UserAdoptView
            adoptionForm={adoptionForm}
            animals={animals}
            busy={busy}
            onAdoptionFormChange={setAdoptionForm}
            onApply={handleApply}
            onSelectAnimal={setSelectedAnimalId}
            selectedAnimal={selectedAnimal}
            user={user}
          />
        ) : null}
        {!loading && activeView === "applications" ? (
          <UserApplicationsView applications={applications} onNavigate={setActiveView} />
        ) : null}
        {!loading && activeView === "report" ? (
          <UserReportView
            busy={busy}
            form={reportForm}
            onChange={setReportForm}
            onPhotoChange={handleReportPhotos}
            onRemovePhoto={handleRemoveReportPhoto}
            onSubmit={handleSubmitReport}
          />
        ) : null}
        {!loading && activeView === "reports" ? <UserReportsView onNavigate={setActiveView} reports={reports} /> : null}
        {!loading && activeView === "profile" ? (
          <UserProfileView applications={applications} onLogout={onLogout} onNavigate={setActiveView} reports={reports} user={user} />
        ) : null}
      </main>
    </div>
  );
}

export default function App() {
  const storedSession = useMemo(() => readStoredSession(), []);
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsRange, setAnalyticsRange] = useState(30);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [token, setToken] = useState(storedSession.token);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeView, setActiveView] = useState(viewFromLocation);
  const [animals, setAnimals] = useState([]);
  const [applications, setApplications] = useState([]);
  const [reports, setReports] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [surrenders, setSurrenders] = useState([]);
  const [cacheReady, setCacheReady] = useState({
    adoptions: false,
    pets: false,
    reports: false,
    staff: false,
    surrenders: false,
  });
  const prefetchTokenRef = useRef("");
  const [managementLoading, setManagementLoading] = useState(false);
  const [actionBusyId, setActionBusyId] = useState("");
  const [actionError, setActionError] = useState("");
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [focusedAnimalId, setFocusedAnimalId] = useState(() => {
    const [view, id] = window.location.hash.slice(1).split("/");
    return view === "pets" ? decodeURIComponent(id || "") : "";
  });
  const [sessionUser, setSessionUser] = useState(storedSession.user);
  const [sessionMode, setSessionMode] = useState(storedSession.mode);

  const signedIn = Boolean(token);
  const metrics = dashboard.metrics;

  const metricCards = useMemo(
    () => [
      {
        icon: PawPrint,
        label: "Total Animals",
        tone: "green",
        value: formatNumber(metrics.totalPets),
      },
      {
        icon: Users,
        label: "Adoption Applications",
        tone: "violet",
        value: formatNumber(metrics.adoptionRequests),
      },
      {
        icon: Flag,
        label: "Active Stray Reports",
        tone: "blue",
        value: formatNumber(metrics.activeReports),
      },
      {
        icon: ClipboardList,
        label: "Active Surrenders",
        tone: "amber",
        value: formatNumber(metrics.activeSurrenders),
      },
    ],
    [metrics]
  );

  async function loadDashboard(nextToken = token) {
    if (!nextToken) {
      setDashboard(emptyDashboard);
      return;
    }

    setDashboardLoading(true);
    setAuthError("");

    try {
      const data = await fetchJson("/api/admin/dashboard", nextToken);
      setDashboard({
        ...emptyDashboard,
        ...data,
        metrics: {
          ...emptyDashboard.metrics,
          ...(data.metrics || {}),
        },
      });
    } catch (error) {
      setToken("");
      setSessionUser(null);
      setSessionMode("");
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setDashboard(emptyDashboard);
      setAuthError(`${error.message}. Sign in with an admin account.`);
    } finally {
      setDashboardLoading(false);
    }
  }

  async function loadAnalytics(nextToken = token, days = analyticsRange) {
    if (!nextToken) {
      setAnalytics(null);
      return;
    }

    setAnalyticsLoading(true);
    setAnalyticsError("");

    try {
      const data = await fetchJson(`/api/admin/analytics?days=${days}`, nextToken);
      setAnalytics(data);
    } catch (error) {
      setAnalyticsError(error.message);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  async function loadAnimals(nextToken = token, { silent = false } = {}) {
    if (!nextToken) {
      setAnimals([]);
      return;
    }

    if (!silent) {
      setManagementLoading(true);
      setActionError("");
    }

    try {
      const data = await fetchJson("/api/admin/animals", nextToken);
      setAnimals(data.animals || []);
      setCacheReady((current) => ({ ...current, pets: true }));
    } catch (error) {
      if (!silent) setActionError(error.message);
    } finally {
      if (!silent) setManagementLoading(false);
    }
  }

  async function loadApplications(nextToken = token, { silent = false } = {}) {
    if (!nextToken) {
      setApplications([]);
      return;
    }

    if (!silent) {
      setManagementLoading(true);
      setActionError("");
    }

    try {
      const data = await fetchJson("/api/adoptions/applications", nextToken);
      setApplications(data.applications || []);
      setCacheReady((current) => ({ ...current, adoptions: true }));
    } catch (error) {
      if (!silent) setActionError(error.message);
    } finally {
      if (!silent) setManagementLoading(false);
    }
  }

  async function loadReports(nextToken = token, { silent = false } = {}) {
    if (!nextToken) {
      setReports([]);
      return;
    }

    if (!silent) {
      setManagementLoading(true);
      setActionError("");
    }

    try {
      const data = await fetchJson("/api/reports/stray", nextToken);
      setReports(data.reports || []);
      setCacheReady((current) => ({ ...current, reports: true }));
    } catch (error) {
      if (!silent) setActionError(error.message);
    } finally {
      if (!silent) setManagementLoading(false);
    }
  }

  async function loadWorkers(nextToken = token, { silent = false } = {}) {
    if (!nextToken) {
      setWorkers([]);
      return;
    }

    if (!silent) {
      setManagementLoading(true);
      setActionError("");
    }
    try {
      const data = await fetchJson("/api/admin/workers", nextToken);
      setWorkers(data.workers || []);
      setCacheReady((current) => ({ ...current, staff: true }));
    } catch (error) {
      if (!silent) setActionError(error.message);
    } finally {
      if (!silent) setManagementLoading(false);
    }
  }

  async function createWorker(input) {
    setActionBusyId("new-worker");
    setActionError("");
    try {
      const data = await fetchJson("/api/admin/workers", token, {
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setWorkers((current) => [...current, data.worker]);
      return data.worker;
    } catch (error) {
      setActionError(error.message);
      throw error;
    } finally {
      setActionBusyId("");
    }
  }

  async function deleteWorker(worker) {
    setActionBusyId(worker.id);
    setActionError("");
    try {
      await fetchJson(`/api/admin/workers/${worker.id}`, token, { method: "DELETE" });
      setWorkers((current) => current.filter((item) => item.id !== worker.id));
    } catch (error) {
      setActionError(error.message);
    } finally {
      setActionBusyId("");
    }
  }

  async function loadSurrenders(nextToken = token, { silent = false } = {}) {
    if (!nextToken) {
      setSurrenders([]);
      return;
    }

    if (!silent) {
      setManagementLoading(true);
      setActionError("");
    }
    try {
      const data = await fetchJson("/api/surrenders", nextToken);
      setSurrenders(data.surrenders || []);
      setCacheReady((current) => ({ ...current, surrenders: true }));
    } catch (error) {
      if (!silent) setActionError(error.message);
    } finally {
      if (!silent) setManagementLoading(false);
    }
  }

  async function updateSurrenderStatus(id, status) {
    setActionBusyId(id);
    setActionError("");
    try {
      const data = await fetchJson(`/api/surrenders/${id}/status`, token, {
        body: JSON.stringify({ status }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      setSurrenders((current) => current.map((item) => (item.id === id ? data.surrender : item)));
      await loadDashboard(token);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setActionBusyId("");
    }
  }

  async function assignReportAgent(id, assignedAgentId) {
    setActionBusyId(id);
    setActionError("");
    try {
      const data = await fetchJson(`/api/reports/stray/${id}/assignment`, token, {
        body: JSON.stringify({ assignedAgentId }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      setReports((current) => current.map((report) => (report.id === id ? data.report : report)));
    } catch (error) {
      setActionError(error.message);
    } finally {
      setActionBusyId("");
    }
  }

  async function updateApplicationStatus(id, status) {
    setActionBusyId(id);
    setActionError("");

    try {
      const data = await fetchJson(`/api/adoptions/applications/${id}/status`, token, {
        body: JSON.stringify({ status }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      setApplications((current) =>
        current.map((application) => (application.id === id ? data.application : application))
      );
      setDashboard((current) => ({
        ...current,
        recentApplications: current.recentApplications.map((application) =>
          application.id === id ? data.application : application
        ),
      }));
      setSelectedDetail((current) =>
        current?.item?.id === id ? { type: "adoption", item: data.application } : current
      );
      await loadApplications(token);
      await loadDashboard(token);
      return { application: data.application, ok: true };
    } catch (error) {
      setActionError(error.message);
      return { error: error.message, ok: false };
    } finally {
      setActionBusyId("");
    }
  }

  async function assignAdoptionAgent(id, assignedAgentId) {
    setActionBusyId(id);
    setActionError("");
    try {
      const data = await fetchJson(`/api/adoptions/applications/${id}/inspection-assignment`, token, {
        body: JSON.stringify({ assignedAgentId }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      setApplications((current) =>
        current.map((application) => (application.id === id ? data.application : application))
      );
      await loadApplications(token);
      return { application: data.application, ok: true };
    } catch (error) {
      setActionError(error.message);
      return { error: error.message, ok: false };
    } finally {
      setActionBusyId("");
    }
  }

  async function viewAdoptionDocument(applicationId, documentType) {
    const previewWindow = window.open("", "_blank");

    if (previewWindow) {
      previewWindow.opener = null;
      previewWindow.document.title = "Opening adoption document";
      previewWindow.document.body.textContent = "Opening document securely...";
    }

    setActionError("");

    try {
      const data = await fetchJson(
        `/api/adoptions/applications/${encodeURIComponent(applicationId)}/documents/${encodeURIComponent(documentType)}`,
        token
      );
      const document = data.document;

      if (!document?.dataUri) {
        throw new Error("The selected document is unavailable");
      }

      const documentResponse = await fetch(document.dataUri);
      const documentBlob = await documentResponse.blob();
      const documentUrl = URL.createObjectURL(documentBlob);

      if (previewWindow) {
        previewWindow.location.replace(documentUrl);
      } else {
        const downloadLink = window.document.createElement("a");
        downloadLink.href = documentUrl;
        downloadLink.download = document.fileName || "adoption-document";
        downloadLink.click();
      }

      window.setTimeout(() => URL.revokeObjectURL(documentUrl), 60_000);
      return { ok: true };
    } catch (error) {
      previewWindow?.close();
      setActionError(error.message);
      return { error: error.message, ok: false };
    }
  }

  async function updateReportStatus(id, status) {
    setActionBusyId(id);
    setActionError("");

    try {
      const data = await fetchJson(`/api/reports/stray/${id}/status`, token, {
        body: JSON.stringify({ status }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      setReports((current) => current.map((report) => (report.id === id ? data.report : report)));
      setSelectedDetail((current) => (current?.item?.id === id ? { type: "report", item: data.report } : current));
      await loadDashboard(token);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setActionBusyId("");
    }
  }

  async function createAnimal(input) {
    setActionBusyId("new-animal");
    setActionError("");

    try {
      const data = await fetchJson("/api/admin/animals", token, {
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setAnimals((current) => [data.animal, ...current]);
      await loadDashboard(token);
      return data.animal;
    } catch (error) {
      setActionError(error.message);
      throw error;
    } finally {
      setActionBusyId("");
    }
  }

  async function updateAnimal(id, input) {
    setActionBusyId(id);
    setActionError("");

    try {
      const data = await fetchJson(`/api/admin/animals/${id}`, token, {
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      setAnimals((current) => current.map((animal) => (animal.id === id ? data.animal : animal)));
      await loadDashboard(token);
      return data.animal;
    } catch (error) {
      setActionError(error.message);
      throw error;
    } finally {
      setActionBusyId("");
    }
  }

  async function addAnimalImage(id, input) {
    setActionBusyId(`${id}:images`);
    setActionError("");

    try {
      const data = await fetchJson(`/api/admin/animals/${id}/images`, token, {
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setAnimals((current) => current.map((animal) => (animal.id === id ? data.animal : animal)));
      return data.animal;
    } catch (error) {
      setActionError(error.message);
      throw error;
    } finally {
      setActionBusyId("");
    }
  }

  async function deleteAnimalImage(id, imageId) {
    setActionBusyId(`${id}:images`);
    setActionError("");

    try {
      const data = await fetchJson(`/api/admin/animals/${id}/images/${imageId}`, token, {
        method: "DELETE",
      });
      setAnimals((current) => current.map((animal) => (animal.id === id ? data.animal : animal)));
      return data.animal;
    } catch (error) {
      setActionError(error.message);
      throw error;
    } finally {
      setActionBusyId("");
    }
  }

  async function reorderAnimalImages(id, imageIds) {
    setActionBusyId(`${id}:images`);
    setActionError("");

    try {
      const data = await fetchJson(`/api/admin/animals/${id}/images/reorder`, token, {
        body: JSON.stringify({ imageIds }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      setAnimals((current) => current.map((animal) => (animal.id === id ? data.animal : animal)));
      return data.animal;
    } catch (error) {
      setActionError(error.message);
      throw error;
    } finally {
      setActionBusyId("");
    }
  }

  async function refreshActiveView() {
    if (activeView === "analytics") {
      await loadAnalytics(token, analyticsRange);
      return;
    }

    if (activeView === "pets") {
      await loadAnimals(token);
      return;
    }

    if (activeView === "adoptions") {
      await loadApplications(token);
      return;
    }

    if (activeView === "reports") {
      await Promise.all([loadReports(token), loadWorkers(token)]);
      return;
    }

    if (activeView === "staff") {
      await loadWorkers(token);
      return;
    }

    if (activeView === "surrenders") {
      await loadSurrenders(token);
      return;
    }

    await loadDashboard(token);
  }

  function handleOpenManagementDetail(type, item) {
    const view = type === "report" ? "reports" : "adoptions";
    window.history.pushState(
      {},
      "",
      `${window.location.pathname}${window.location.search}#${view}/${encodeURIComponent(item.id)}`
    );
    setActiveView(view);
    setSearchQuery("");
    setSelectedDetail(null);
    setActionError("");
  }

  function handleNavigate(view) {
    window.history.pushState({}, "", `${window.location.pathname}${window.location.search}#${view}`);
    setActiveView(view);
    setSearchQuery("");
    setSelectedDetail(null);
    setActionError("");
    setFocusedAnimalId("");
  }

  function handleViewAnimalProfile(animalId) {
    if (!animalId) {
      return;
    }

    window.history.pushState(
      {},
      "",
      `${window.location.pathname}${window.location.search}#pets/${encodeURIComponent(animalId)}`
    );
    setActiveView("pets");
    setSearchQuery("");
    setSelectedDetail(null);
    setActionError("");
    setFocusedAnimalId(animalId);
  }

  async function handleLogin({ email, password }) {
    setAuthLoading(true);
    setAuthError("");

    try {
      const data = await fetchJson("/api/auth/login", "", {
        body: JSON.stringify({ email: email.trim(), password }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      setToken(data.token);
      setSessionUser(data.user);
      setSessionMode(data.user?.role === "ADMIN" ? "admin" : "user");
      handleNavigate("dashboard");
      setSearchQuery("");
      setSelectedDetail(null);
      setActionError("");
      if (data.user?.role === "ADMIN") {
        await loadDashboard(data.token);
      }
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleRegister({ confirmPassword, email, fullName, password }) {
    setAuthLoading(true);
    setAuthError("");

    if (password !== confirmPassword) {
      setAuthError("Passwords do not match");
      setAuthLoading(false);
      return;
    }

    try {
      const data = await fetchJson("/api/auth/register", "", {
        body: JSON.stringify({
          email: email.trim(),
          fullname: fullName.trim(),
          password,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      setToken(data.token);
      setSessionUser(data.user);
      setSessionMode("user");
      handleNavigate("dashboard");
      setSearchQuery("");
      setSelectedDetail(null);
      setActionError("");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}#dashboard`);
    setToken("");
    setSessionUser(null);
    setSessionMode("");
    setDashboard(emptyDashboard);
    setAnalytics(null);
    setAnalyticsError("");
    setAnimals([]);
    setApplications([]);
    setReports([]);
    setWorkers([]);
    setSurrenders([]);
    setCacheReady({ adoptions: false, pets: false, reports: false, staff: false, surrenders: false });
    prefetchTokenRef.current = "";
    setActiveView("dashboard");
    setSearchQuery("");
    setMobileNavOpen(false);
    setSelectedDetail(null);
    setActionError("");
    setAuthError("");
  }

  useEffect(() => {
    if (sessionMode === "admin") {
      loadDashboard(token);
    }
  }, [sessionMode, token]);

  useEffect(() => {
    if (token && sessionUser) {
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ mode: sessionMode, token, user: sessionUser })
      );
    }
  }, [sessionMode, sessionUser, token]);

  useEffect(() => {
    const handleLocationChange = () => {
      setActiveView(viewFromLocation());
      setSearchQuery("");
      setSelectedDetail(null);
      setActionError("");
    };

    window.addEventListener("hashchange", handleLocationChange);
    window.addEventListener("popstate", handleLocationChange);

    return () => {
      window.removeEventListener("hashchange", handleLocationChange);
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, []);

  useEffect(() => {
    if (!token || sessionMode !== "admin" || prefetchTokenRef.current === token) {
      return;
    }

    prefetchTokenRef.current = token;

    async function prefetchAdminData() {
      await Promise.all([
        loadApplications(token, { silent: true }),
        loadWorkers(token, { silent: true }),
        loadAnimals(token, { silent: true }),
      ]);

      await Promise.all([
        loadReports(token, { silent: true }),
        loadSurrenders(token, { silent: true }),
      ]);
    }

    prefetchAdminData();
  }, [sessionMode, token]);

  useEffect(() => {
    if (!token || sessionMode !== "admin") {
      return;
    }

    if (activeView === "pets") {
      loadAnimals(token, { silent: cacheReady.pets });
    }

    if (activeView === "analytics") {
      loadAnalytics(token, analyticsRange);
    }

    if (activeView === "adoptions") {
      loadApplications(token, { silent: cacheReady.adoptions });
    }

    if (activeView === "reports") {
      loadReports(token, { silent: cacheReady.reports });
      loadWorkers(token, { silent: cacheReady.staff });
    }

    if (activeView === "staff") {
      loadWorkers(token, { silent: cacheReady.staff });
    }

    if (activeView === "surrenders") {
      loadSurrenders(token, { silent: cacheReady.surrenders });
    }
  }, [activeView, analyticsRange, token]);

  if (!signedIn) {
    return (
      <AccessScreen
        error={authError}
        loading={authLoading}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
    );
  }

  async function updateFieldReportStatus(id, fieldStatus, fieldOutcome) {
    setActionBusyId(id);
    setActionError("");

    try {
      const data = await fetchJson(`/api/reports/stray/${id}/field-update`, token, {
        body: JSON.stringify({ fieldStatus, fieldOutcome }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      setReports((current) => current.map((report) => (report.id === id ? data.report : report)));
      setSelectedDetail((current) => (current?.item?.id === id ? { type: "report", item: data.report } : current));
      await loadDashboard(token);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setActionBusyId("");
    }
  }

  if (sessionMode === "user") {
    return <UserPortal onLogout={handleLogout} token={token} user={sessionUser} />;
  }

  return (
    <div className="app-shell" id="dashboard">
      <Sidebar
        activeView={activeView}
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
      />

      <main className="dashboard-main">
        <header className="mobile-bar">
          <button className="icon-button" onClick={() => setMobileNavOpen(true)} type="button">
            <Menu size={21} />
          </button>
          <div className="mobile-brand">
            <img src={logoUrl} alt="" />
            <strong>SPCA</strong>
          </div>
          <button className="icon-button" type="button">
            <Bell size={20} />
          </button>
        </header>

        <section className="page-header">
          <div>
            <h1>{pageTitle(activeView)}</h1>
            <span>{pageDescription(activeView, dashboardLoading, dashboard.generatedAt)}</span>
          </div>

          <div className="header-actions">
            {activeView !== "analytics" ? (
              <label className="search-field">
                <Search size={20} />
                <input
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={
                    activeView === "reports"
                      ? "Search reports..."
                      : activeView === "pets"
                        ? "Search animals..."
                        : "Search requests..."
                  }
                  type="search"
                  value={searchQuery}
                />
              </label>
            ) : null}
            <button className="icon-button notification-button" type="button">
              <Bell size={21} />
              <span>3</span>
            </button>
            <button className="primary-button add-new-button" disabled={dashboardLoading || managementLoading || analyticsLoading} onClick={refreshActiveView} type="button">
              <RefreshCw size={18} />
              Refresh
            </button>
          </div>
        </section>

        {actionError ? <div className="inline-error">{actionError}</div> : null}
        {activeView === "dashboard" ? (
          <DetailPanel item={selectedDetail?.item} onClose={() => setSelectedDetail(null)} type={selectedDetail?.type} />
        ) : null}

        {activeView === "dashboard" ? (
          <>
            <section className="metric-grid">
              {metricCards.map((card) => (
                <MetricCard {...card} key={card.label} />
              ))}
            </section>

            <section className="content-grid">
              <article className="panel chart-panel">
                <div className="panel-header">
                  <h2>Adoptions Overview</h2>
                  <button className="secondary-button" type="button">
                    This Month
                    <ChevronDown size={15} />
                  </button>
                </div>
                <LineChart data={dashboard.adoptionOverview} />
              </article>

              <article className="panel status-panel">
                <div className="panel-header">
                  <h2>Animals by Status</h2>
                </div>
                <DonutChart data={dashboard.petsByStatus} />
              </article>

              <article className="panel activity-panel">
                <div className="panel-header">
                  <h2>Recent Activity</h2>
                </div>
                <ActivityList items={dashboard.recentActivity} />
              </article>

              <article className="panel table-panel">
                <div className="panel-header">
                  <h2>Recent Adoption Requests</h2>
                  <button className="secondary-button" onClick={() => handleNavigate("adoptions")} type="button">
                    View All Requests
                  </button>
                </div>
                <RequestsTable
                  applications={dashboard.recentApplications}
                  onView={handleOpenManagementDetail}
                  query={searchQuery}
                />
              </article>
 
            </section>
          </>
        ) : activeView === "analytics" ? (
          <AnalyticsPage
            data={analytics}
            error={analyticsError}
            loading={analyticsLoading}
            onRangeChange={setAnalyticsRange}
            range={analyticsRange}
          />
        ) : activeView === "pets" ? (
          <PetsManagementPage
            animals={animals}
            busyId={actionBusyId}
            focusedAnimalId={focusedAnimalId}
            loading={managementLoading}
            onAnimalCreate={createAnimal}
            onAnimalFocusHandled={() => setFocusedAnimalId("")}
            onAnimalUpdate={updateAnimal}
            onImageAdd={addAnimalImage}
            onImageDelete={deleteAnimalImage}
            onImagesReorder={reorderAnimalImages}
            onRefresh={() => loadAnimals(token)}
            query={searchQuery}
          />
        ) : activeView === "adoptions" ? (
          <AdoptionApplicationsPage
            applications={applications}
            busyId={actionBusyId}
            fieldAgents={workers.filter((worker) => worker.role === "FIELD_AGENT")}
            loading={managementLoading}
            onAgentAssign={assignAdoptionAgent}
            onDocumentView={viewAdoptionDocument}
            onStatusChange={updateApplicationStatus}
            onRefresh={() => loadApplications(token)}
            onViewAnimalProfile={handleViewAnimalProfile}
            query={searchQuery}
          />
        ) : activeView === "reports" ? (
          <ReportsManagementPage
            busyId={actionBusyId}
            fieldAgents={workers.filter((worker) => worker.role === "FIELD_AGENT")}
            loading={managementLoading}
            onAgentAssign={assignReportAgent}
            onFieldStatusChange={updateFieldReportStatus}
            onRefresh={() => Promise.all([loadReports(token), loadWorkers(token)])}
            onStatusChange={updateReportStatus}
            query={searchQuery}
            reports={reports}
          />
        ) : activeView === "staff" ? (
          <StaffManagementPage
            busy={actionBusyId === "new-worker"}
            busyId={actionBusyId}
            currentUserId={sessionUser?.id}
            onCreate={createWorker}
            onDelete={deleteWorker}
            workers={workers}
          />
        ) : activeView === "surrenders" ? (
          <SurrenderRequestsPage
            busyId={actionBusyId}
            loading={managementLoading}
            onStatusChange={updateSurrenderStatus}
            onRefresh={() => loadSurrenders(token)}
            onViewAnimalProfile={handleViewAnimalProfile}
            query={searchQuery}
            surrenders={surrenders}
          />
        ) : (
          <PlaceholderView title={pageTitle(activeView)} />
        )}
      </main>
    </div>
  );
}
