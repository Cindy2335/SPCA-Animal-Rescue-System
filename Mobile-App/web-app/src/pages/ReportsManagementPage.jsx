import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Flag,
  ImageIcon,
  List,
  LocateFixed,
  Mail,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Truck,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import useCollapsibleDetailCards from "../hooks/useCollapsibleDetailCards.js";
import { normalizeMediaItems, resolveMediaUrl } from "../utils/media.js";

const PAGE_SIZE = 10;

const statusFilters = [
  { icon: Flag, label: "All Reports", value: "ALL" },
  { icon: AlertTriangle, label: "Open", value: "OPEN" },
  { icon: Clock3, label: "In Progress", value: "IN_PROGRESS" },
  { icon: CheckCircle2, label: "Resolved", value: "RESOLVED" },
];

function normalizeStatus(status) {
  return String(status || "OPEN")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status) {
  if (status === "RESOLVED") return "approved";
  if (status === "IN_PROGRESS") return "review";
  return "submitted";
}

function reportStatusLabel(report) {
  return report?.fieldStatus === "FAILED" ? "Rescue failed" : normalizeStatus(report?.status);
}

function reportStatusClass(report) {
  return report?.fieldStatus === "FAILED" ? "review" : statusClass(report?.status);
}

function fieldStatusLabel(status) {
  if (!status || status === "UNASSIGNED") {
    return "Not assigned";
  }

  return String(status)
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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

function formatDateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatTimelineDate(value) {
  if (!value) return "Pending";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Pending";
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function reportTimeline(report) {
  if (!report) {
    return {
      current: null,
      steps: [],
    };
  }

  const assignedAt = report.assignedAt;
  const acceptedAt =
    report.acceptedAt ||
    ([
      "ACCEPTED",
      "EN_ROUTE",
      "ON_SCENE",
      "RESCUE_IN_PROGRESS",
      "HELPED",
      "UNABLE_TO_LOCATE",
      "FAILED",
    ].includes(report.fieldStatus)
      ? report.assignedAt || report.updatedAt
      : null);
  const rejectedAt = report.rejectedAt || (report.fieldStatus === "REJECTED" ? report.updatedAt : null);
  const dispatchedAt =
    report.dispatchedAt || (report.fieldStatus === "EN_ROUTE" ? report.updatedAt : null);
  const onSceneAt =
    report.onSceneAt || (report.fieldStatus === "ON_SCENE" ? report.updatedAt : null);
  const rescueStartedAt =
    report.rescueStartedAt ||
    (report.fieldStatus === "RESCUE_IN_PROGRESS" ? report.updatedAt : null);
  const finishedAt =
    report.fieldStatus === "FAILED"
      ? report.failedAt || report.updatedAt
      : report.fieldStatus === "UNABLE_TO_LOCATE"
        ? report.unableToLocateAt || report.updatedAt
        : report.resolvedAt;
  const finishedLabel =
    report.fieldStatus === "FAILED"
      ? "Rescue Failed"
      : report.fieldStatus === "UNABLE_TO_LOCATE"
        ? "Unable to Locate"
        : "Completed";

  const rawSteps = [
    {
      body: "Reporter submitted the stray animal report.",
      label: "Report Submitted",
      time: report.createdAt,
    },
    {
      body: "Admin assigned a field agent to the case.",
      label: "Field Agent Assigned",
      time: assignedAt,
    },
    {
      body: "Field agent accepted the assignment.",
      label: "Case Accepted",
      time: acceptedAt,
    },
    ...(rejectedAt
      ? [
          {
            body: "Field agent rejected this assignment. Reassign the case to another worker.",
            label: "Assignment Rejected",
            time: rejectedAt,
          },
        ]
      : []),
    {
      body: "Field agent started travelling to the location.",
      label: "Agent En Route",
      time: dispatchedAt,
    },
    {
      body: "Field agent reached the reported location.",
      label: "Reached Location",
      time: onSceneAt,
    },
    {
      body: "Field agent started helping the animal.",
      label: "Rescue In Progress",
      time: rescueStartedAt,
    },
    {
      body:
        report.fieldStatus === "FAILED"
          ? report.fieldOutcome || report.fieldNotes || "The rescue could not be completed."
          : report.fieldStatus === "UNABLE_TO_LOCATE"
          ? "Field agent checked the area but could not locate the animal."
          : "Field team helped the animal and closed the case.",
      label: finishedLabel,
      time: finishedAt,
    },
  ];
  const steps = rawSteps.map((step) => ({
    ...step,
    state: step.time ? "done" : "pending",
  }));

  return {
    current:
      [...steps].reverse().find((step) => step.state === "done") ||
      steps[0],
    steps,
  };
}

function reportCode(report) {
  const suffix = String(report?.id || "")
    .replace(/\D/g, "")
    .slice(-5);

  if (suffix) {
    return `REP-${suffix.padStart(5, "0")}`;
  }

  return `REP-${String(report?.id || "case").slice(-5).toUpperCase()}`;
}

function getReportImages(report) {
  if (!report) {
    return [];
  }

  if (report.images?.length) {
    return normalizeMediaItems(report.images);
  }

  if (report.imageUrl) {
    return [{ dataUri: resolveMediaUrl(report.imageUrl), id: "primary" }];
  }

  return [];
}

function parseReportDescription(description) {
  const text = String(description || "").trim();

  if (!text) {
    return { details: "", fields: [] };
  }

  const labelMap = {
    "additional details": "Additional details",
    age: "Age",
    breed: "Breed",
    color: "Colour",
    colour: "Colour",
    coordinates: "Coordinates",
    gender: "Gender",
    sex: "Gender",
  };
  const labelPattern = /(Additional details|Breed|Colour|Color|Age|Gender|Sex|Coordinates):/gi;
  const matches = [...text.matchAll(labelPattern)];

  if (!matches.length) {
    return { details: text, fields: [] };
  }

  const parts = matches
    .map((match, index) => {
      const rawLabel = match[1].toLowerCase();
      const valueStart = (match.index || 0) + match[0].length;
      const valueEnd = index + 1 < matches.length ? matches[index + 1].index || text.length : text.length;

      return {
        label: labelMap[rawLabel] || match[1],
        value: text.slice(valueStart, valueEnd).trim(),
      };
    })
    .filter((part) => part.value);

  const detailPart = parts.find((part) => part.label === "Additional details");
  const fields = parts.filter((part) => part.label !== "Additional details");

  return {
    details: detailPart?.value || "",
    fields,
  };
}

function DetailValue({ label, value }) {
  return (
    <div className="drawer-info-item">
      <span>{label}</span>
      <strong>{value || "Not provided"}</strong>
    </div>
  );
}

function CaseStatusTimeline({ report }) {
  const timeline = reportTimeline(report);
  const tone =
    report?.fieldStatus === "UNABLE_TO_LOCATE" ||
    report?.fieldStatus === "FAILED" ||
    report?.fieldStatus === "REJECTED"
      ? "alert"
      : report?.fieldStatus === "HELPED" || report?.status === "RESOLVED"
        ? "success"
        : "active";

  if (!timeline.steps.length) return null;

  return (
    <div className={`case-status-card ${tone}`}>
      <div className="case-status-card-header">
        <span className="case-status-icon">
          <ShieldCheck size={22} />
        </span>
        <div>
          <h4>Case Status</h4>
          <p>{timeline.current?.body}</p>
        </div>
      </div>
      <div className={`case-status-current ${tone}`}>
        <CheckCircle2 size={28} />
        <div>
          <strong>{timeline.current?.label}</strong>
          <span>{timeline.current?.time ? formatTimelineDate(timeline.current.time) : "Pending"}</span>
        </div>
      </div>
      <div className="case-status-steps">
        {timeline.steps.map((step, index) => (
          <div
            className={`case-status-step ${step.state} ${
              /unable|failed|rejected/i.test(step.label) ? "alert-step" : ""
            }`}
            key={step.label}
          >
            <span className="case-status-rail">
              {index ? <i className="case-status-line top" /> : null}
              <b>{step.state === "done" ? <CheckCircle2 size={14} /> : null}</b>
              {index < timeline.steps.length - 1 ? <i className="case-status-line bottom" /> : null}
            </span>
            <strong>{step.label}</strong>
            <em>{step.time ? formatTimelineDate(step.time) : "Pending"}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ loading }) {
  return (
    <article className="panel review-empty-state">
      <span>
        <Flag size={24} />
      </span>
      <h2>{loading ? "Loading reports" : "No matching reports"}</h2>
      <p>{loading ? "Fetching report records." : "Try another filter or search term."}</p>
    </article>
  );
}

export default function ReportsManagementPage({
  busyId,
  fieldAgents = [],
  loading,
  onAgentAssign,
  onFieldStatusChange,
  onRefresh,
  onStatusChange,
  query,
  reports,
}) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [detailTab, setDetailTab] = useState("overview");
  const [drawerClosed, setDrawerClosed] = useState(false);
  const fullscreen = true;
  const drawerRef = useRef(null);
  const [failureDialogReport, setFailureDialogReport] = useState(null);
  const [failureReason, setFailureReason] = useState("");
  const [failureReasonError, setFailureReasonError] = useState("");
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(() => {
    const [view, id] = window.location.hash.slice(1).split("/");
    return view === "reports" ? decodeURIComponent(id || "") : "";
  });
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [tableQuery, setTableQuery] = useState("");

  const filteredReports = useMemo(() => {
    const searchText = [query, tableQuery].join(" ").trim().toLowerCase();

    return reports.filter((report) => {
      const reporter = report.reporter || {};
      const haystack = [
        reportCode(report),
        report.reporterName,
        reporter.fullName,
        reporter.email,
        report.animalType,
        report.condition,
        report.location,
        report.description,
        report.status,
        report.fieldStatus,
        report.assignedAgent?.fullName,
        report.assignedAgent?.email,
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = haystack.includes(searchText);
      const matchesStatus = statusFilter === "ALL" || report.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [query, reports, statusFilter, tableQuery]);

  const pageCount = Math.max(1, Math.ceil(filteredReports.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagedReports = filteredReports.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selectedReport = drawerClosed
    ? null
    : filteredReports.find((report) => report.id === selectedId) || null;
  const selectedReportIndex = selectedReport
    ? filteredReports.findIndex((report) => report.id === selectedReport.id)
    : -1;
  const reporter = selectedReport?.reporter || {};
  const assignedAgent = selectedReport?.assignedAgent || {};
  const images = getReportImages(selectedReport);
  const activeImage = images[activeImageIndex] || images[0];
  const parsedDescription = useMemo(
    () => parseReportDescription(selectedReport?.description),
    [selectedReport?.description]
  );
  const handleMarkFailed = () => {
    if (!selectedReport) return;

    setFailureDialogReport(selectedReport);
    setFailureReason("");
    setFailureReasonError("");
  };

  const closeFailureDialog = () => {
    if (busy) {
      return;
    }

    setFailureDialogReport(null);
    setFailureReason("");
    setFailureReasonError("");
  };

  const submitFailureReason = (event) => {
    event.preventDefault();

    const reason = failureReason.trim();

    if (!reason) {
      setFailureReasonError("Add a short reason before notifying the reporter.");
      return;
    }

    onFieldStatusChange?.(failureDialogReport.id, "FAILED", reason);
    setFailureDialogReport(null);
    setFailureReason("");
    setFailureReasonError("");
  };
  const busy = busyId === selectedReport?.id;
  const drawerOpen = Boolean(selectedReport);
  useCollapsibleDetailCards(drawerRef, `${selectedReport?.id || ""}:${detailTab}`);
  const canGoPrevious = selectedReportIndex > 0;
  const canGoNext = selectedReportIndex >= 0 && selectedReportIndex < filteredReports.length - 1;
  const hasCoordinates =
    typeof selectedReport?.latitude === "number" && typeof selectedReport?.longitude === "number";

  const mapUrl = hasCoordinates
    ? `https://www.google.com/maps?q=${selectedReport.latitude},${selectedReport.longitude}`
    : "";

  const counts = useMemo(() => {
    return statusFilters.reduce((acc, filter) => {
      acc[filter.value] =
        filter.value === "ALL" ? reports.length : reports.filter((report) => report.status === filter.value).length;
      return acc;
    }, {});
  }, [reports]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, tableQuery]);

  useEffect(() => {
    const syncSelectionFromLocation = () => {
      const [view, id] = window.location.hash.slice(1).split("/");
      const nextId = view === "reports" ? decodeURIComponent(id || "") : "";
      setSelectedId(nextId);
      setDrawerClosed(!nextId);
    };

    window.addEventListener("hashchange", syncSelectionFromLocation);
    window.addEventListener("popstate", syncSelectionFromLocation);

    return () => {
      window.removeEventListener("hashchange", syncSelectionFromLocation);
      window.removeEventListener("popstate", syncSelectionFromLocation);
    };
  }, []);

  useEffect(() => {
    setActiveImageIndex(0);
    setDetailTab("overview");
    setImageModalOpen(false);
    setSelectedAgentId(selectedReport?.assignedAgentId || "");
  }, [selectedReport?.assignedAgentId, selectedReport?.id]);

  function handleSelectReport(id) {
    setDrawerClosed(false);
    setSelectedId(id);
    window.history.pushState(
      {},
      "",
      `${window.location.pathname}${window.location.search}#reports/${encodeURIComponent(id)}`
    );
  }

  function handleCloseReport() {
    setDrawerClosed(true);
    setSelectedId("");
    window.history.pushState({}, "", `${window.location.pathname}${window.location.search}#reports`);
  }

  function handleStepReport(direction) {
    const nextReport = filteredReports[selectedReportIndex + direction];

    if (!nextReport) {
      return;
    }

    handleSelectReport(nextReport.id);
  }

  function handleDetailTabChange(tab) {
    setDetailTab(tab);

    if (fullscreen) {
      requestAnimationFrame(() => {
        drawerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  return (
    <section className="admin-dataset-page reports-review-page">
      <div className={`admin-workspace ${drawerOpen ? "has-drawer" : ""}`}>
        <div className="admin-main-stack">
          <div className="dataset-stats-grid">
            {statusFilters.map((filter) => {
              const Icon = filter.icon;
              const active = statusFilter === filter.value;
              return (
                <button
                  className={`dataset-stat-card ${active ? "active" : ""}`}
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  type="button"
                >
                  <span className={`dataset-stat-icon ${statusClass(filter.value)}`}>
                    <Icon size={22} />
                  </span>
                  <div>
                    <small>{filter.label}</small>
                    <strong>{counts[filter.value] || 0}</strong>
                    <em>View all</em>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="dataset-filter-panel">
            <label className="dataset-search-field">
              <span>Search</span>
              <input
                onChange={(event) => setTableQuery(event.target.value)}
                placeholder="Search reports, locations, or case ID..."
                type="search"
                value={tableQuery}
              />
            </label>
            <label className="dataset-select-field">
              <span>Status</span>
              <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                {statusFilters.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.value === "ALL" ? "All Statuses" : filter.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="secondary-button"
              onClick={() => {
                setStatusFilter("ALL");
                setTableQuery("");
              }}
              type="button"
            >
              Reset
            </button>
          </div>

          <article className="panel dataset-table-card">
            <div className="dataset-table-wrap">
              <table className="dataset-table">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Animal</th>
                    <th>Condition</th>
                    <th>Location</th>
                    <th>Reporter</th>
                    <th>Field Agent</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedReports.length ? (
                    pagedReports.map((report) => {
                      const reportImages = getReportImages(report);
                      const image = reportImages[0]?.dataUri;
                      const active = selectedReport?.id === report.id;

                      return (
                        <tr className={active ? "active" : ""} key={report.id}>
                          <td>
                            <button className="entity-cell entity-cell-button" onClick={() => handleSelectReport(report.id)} type="button">
                              {image ? (
                                <img src={image} alt="" />
                              ) : (
                                <span className="entity-fallback">
                                  <Flag size={17} />
                                </span>
                              )}
                              <span>
                                <strong>{reportCode(report)}</strong>
                                <small>{formatDate(report.createdAt)}</small>
                              </span>
                            </button>
                          </td>
                          <td>{report.animalType || "Animal"}</td>
                          <td>{report.condition || "Unknown"}</td>
                          <td>{report.location || "No location"}</td>
                          <td>
                            <span>{report.reporterName || "Anonymous"}</span>
                            <small className="table-muted">{report.reporterId ? "Signed in" : "Anonymous"}</small>
                          </td>
                          <td>
                            <span>{report.assignedAgent?.fullName || "Unassigned"}</span>
                            <small className="table-muted">{fieldStatusLabel(report.fieldStatus)}</small>
                          </td>
                          <td>
                            <span className={`status-pill ${reportStatusClass(report)}`}>
                              {reportStatusLabel(report)}
                            </span>
                          </td>
                          <td>{formatDate(report.createdAt)}</td>
                          <td>
                            <div className="row-actions">
                              <button className="link-action" onClick={() => handleSelectReport(report.id)} type="button">
                                <Eye size={15} />
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="empty-row" colSpan="9">
                        <EmptyState loading={loading} />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="dataset-pagination">
              <span>
                Showing {filteredReports.length ? (safePage - 1) * PAGE_SIZE + 1 : 0} to{" "}
                {Math.min(safePage * PAGE_SIZE, filteredReports.length)} of {filteredReports.length} reports
              </span>
              <div>
                <button
                  className="mini-action"
                  disabled={safePage <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  type="button"
                >
                  &lt;
                </button>
                <button className="page-button active" type="button">
                  {safePage}
                </button>
                <button
                  className="mini-action"
                  disabled={safePage >= pageCount}
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  type="button"
                >
                  &gt;
                </button>
              </div>
            </div>
          </article>
        </div>

        {drawerOpen ? (
          <aside className={`admin-detail-drawer ${fullscreen ? "fullscreen" : ""}`} ref={drawerRef}>
            <div className="drawer-header-actions">
              <button
                aria-label="Close report details"
                className="drawer-close-button"
                onClick={handleCloseReport}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="drawer-fullscreen-topbar">
              <nav className="drawer-breadcrumb">
                <span>Reports</span>
                <span className="crumb-sep">/</span>
                <span className="crumb-active">
                  {selectedReport.animalType || "Animal"} ({reportCode(selectedReport)})
                </span>
              </nav>
              <div className="drawer-topnav">
                <button
                  className="drawer-topnav-btn"
                  onClick={handleCloseReport}
                  type="button"
                >
                  <ArrowLeft size={15} />
                  Back to Reports
                </button>
                <span className="drawer-topnav-divider" />
                <button
                  className="drawer-topnav-btn"
                  onClick={() => onRefresh?.()}
                  type="button"
                >
                  <RefreshCw size={15} />
                  Refresh Report
                </button>
                <span className="drawer-topnav-divider" />
                <button
                  className="drawer-topnav-btn"
                  disabled={!canGoPrevious}
                  onClick={() => handleStepReport(-1)}
                  type="button"
                >
                  <ChevronLeft size={15} />
                  Previous
                </button>
                <button
                  className="drawer-topnav-btn"
                  disabled={!canGoNext}
                  onClick={() => handleStepReport(1)}
                  type="button"
                >
                  Next
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            <div className="drawer-profile-head">
              <button
                className="drawer-profile-image drawer-image-button"
                disabled={!activeImage?.dataUri}
                onClick={() => setImageModalOpen(true)}
                type="button"
              >
                {activeImage?.dataUri ? (
                  <img src={activeImage.dataUri} alt="" />
                ) : (
                  <span>
                    <ImageIcon size={38} />
                  </span>
                )}
              </button>
              <div>
                <h2>{selectedReport.animalType || "Animal"} Report</h2>
                <p>{selectedReport.location || "No location provided"}</p>
                <span className={`status-pill ${reportStatusClass(selectedReport)}`}>
                  {reportStatusLabel(selectedReport)}
                </span>
                <strong className="drawer-code">{reportCode(selectedReport)}</strong>
                <div className="drawer-stat-row">
                  <div className="drawer-stat-chip">
                    <Clock3 size={18} />
                    <div className="drawer-stat-chip-info">
                      <span className="drawer-stat-chip-value">{formatDate(selectedReport.createdAt)}</span>
                      <span className="drawer-stat-chip-label">Created</span>
                    </div>
                  </div>
                  <div className="drawer-stat-chip">
                    <User size={18} />
                    <div className="drawer-stat-chip-info">
                      <span className="drawer-stat-chip-value">{selectedReport.reporterName || reporter.fullName || "Anonymous"}</span>
                      <span className="drawer-stat-chip-label">Reporter</span>
                    </div>
                  </div>
                  <div className="drawer-stat-chip">
                    <AlertTriangle size={18} />
                    <div className="drawer-stat-chip-info">
                      <span className="drawer-stat-chip-value">{selectedReport.condition || "Unknown"}</span>
                      <span className="drawer-stat-chip-label">Condition</span>
                    </div>
                  </div>
                  <div className="drawer-stat-chip">
                    <ImageIcon size={18} />
                    <div className="drawer-stat-chip-info">
                      <span className="drawer-stat-chip-value">{images.length}</span>
                      <span className="drawer-stat-chip-label">Photos</span>
                    </div>
                  </div>
                  <div className="drawer-stat-chip">
                    <User size={18} />
                    <div className="drawer-stat-chip-info">
                      <span className="drawer-stat-chip-value">{assignedAgent.fullName || "Unassigned"}</span>
                      <span className="drawer-stat-chip-label">Field Agent</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {images.length > 1 ? (
              <div className="drawer-gallery compact-gallery">
                {images.map((image, index) => (
                  <button
                    className={index === activeImageIndex ? "active" : ""}
                    key={image.id || index}
                    onClick={() => setActiveImageIndex(index)}
                    type="button"
                  >
                    <img src={image.dataUri} alt="" />
                  </button>
                ))}
              </div>
            ) : null}

            <div className="drawer-tabs" role="tablist">
              {["overview", "evidence", "location"].map((tab) => (
                <button
                  className={detailTab === tab ? "active" : ""}
                  key={tab}
                  onClick={() => handleDetailTabChange(tab)}
                  type="button"
                >
                  {tab === "evidence" ? "Image" : tab[0].toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {detailTab === "overview" ? (
              <div className="drawer-page-body">
                <div className="drawer-stack">
                  <section className="drawer-section report-details-card">
                    <div className="detail-card-heading">
                      <span className="detail-card-icon blue"><FileText size={23} /></span>
                      <div>
                        <h3>Report Details</h3>
                        <p>Key information about this report</p>
                      </div>
                    </div>
                    <div className="drawer-info-grid">
                      <DetailValue label="Animal Type" value={selectedReport.animalType} />
                      <DetailValue label="Condition" value={selectedReport.condition} />
                      <DetailValue label="Status" value={reportStatusLabel(selectedReport)} />
                      <DetailValue label="Created" value={formatDateTime(selectedReport.createdAt)} />
                      <DetailValue label="Last Updated" value={formatDateTime(selectedReport.updatedAt)} />
                      <DetailValue label="Images" value={String(images.length)} />
                      <DetailValue label="Field Status" value={fieldStatusLabel(selectedReport.fieldStatus)} />
                    </div>
                  </section>

                  <section className="drawer-section dispatch-card">
                    <div className="detail-card-heading">
                      <span className="detail-card-icon green"><Truck size={24} /></span>
                      <div>
                        <h3>Field Dispatch</h3>
                        <p>Dispatch and field activity timeline</p>
                      </div>
                    </div>
                    <CaseStatusTimeline report={selectedReport} />
                    <div className="drawer-info-grid">
                      <DetailValue label="Assigned To" value={assignedAgent.fullName || ""} />
                      <DetailValue label="Assigned At" value={selectedReport.assignedAt ? formatDateTime(selectedReport.assignedAt) : ""} />
                      <DetailValue label="Accepted At" value={selectedReport.acceptedAt ? formatDateTime(selectedReport.acceptedAt) : ""} />
                      <DetailValue label="Rejected At" value={selectedReport.rejectedAt ? formatDateTime(selectedReport.rejectedAt) : ""} />
                      <DetailValue label="En Route At" value={selectedReport.dispatchedAt ? formatDateTime(selectedReport.dispatchedAt) : ""} />
                      <DetailValue label="Reached At" value={selectedReport.onSceneAt ? formatDateTime(selectedReport.onSceneAt) : ""} />
                      <DetailValue label="Rescue Started At" value={selectedReport.rescueStartedAt ? formatDateTime(selectedReport.rescueStartedAt) : ""} />
                      <DetailValue label="Unable To Locate At" value={selectedReport.unableToLocateAt ? formatDateTime(selectedReport.unableToLocateAt) : ""} />
                      <DetailValue label="Failed At" value={selectedReport.failedAt ? formatDateTime(selectedReport.failedAt) : ""} />
                      <DetailValue label="Resolved At" value={selectedReport.resolvedAt ? formatDateTime(selectedReport.resolvedAt) : ""} />
                    </div>
                    <div className="dispatch-form">
                      <label className="drawer-select-field">
                        <span>Assign field agent</span>
                        <select
                          onChange={(event) => setSelectedAgentId(event.target.value)}
                          value={selectedAgentId}
                        >
                          <option value="">Choose field agent</option>
                          {fieldAgents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.fullName} ({agent.email})
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="primary-button"
                        disabled={!selectedAgentId || busy || selectedAgentId === selectedReport.assignedAgentId}
                        onClick={() => onAgentAssign?.(selectedReport.id, selectedAgentId)}
                        type="button"
                      >
                        <User size={16} />
                        Assign
                      </button>
                    </div>
                    {!fieldAgents.length ? (
                      <p className="dispatch-note">No field agents yet. Create one from Staff first.</p>
                    ) : null}
                    {selectedReport.fieldNotes || selectedReport.fieldOutcome ? (
                      <div className="dispatch-update-grid">
                        {selectedReport.fieldNotes ? (
                          <div className="report-note-block">
                            <span>Field notes</span>
                            <p>{selectedReport.fieldNotes}</p>
                          </div>
                        ) : null}
                        {selectedReport.fieldOutcome ? (
                          <div className="report-note-block">
                            <span>Outcome</span>
                            <p>{selectedReport.fieldOutcome}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </section>

                  <section className="drawer-section case-progress-summary">
                    <div className="detail-card-heading">
                      <span className="detail-card-icon purple"><ShieldCheck size={24} /></span>
                      <div>
                        <h3>Case Status</h3>
                        <p>Current case progress</p>
                      </div>
                    </div>
                    <div className="case-progress-row">
                      <div className={selectedReport.status === "OPEN" ? "current" : ""}>
                        <strong>Open</strong>
                        <span>{formatDateTime(selectedReport.createdAt)}</span>
                      </div>
                      <ChevronRight size={19} />
                      <div className={selectedReport.status === "IN_PROGRESS" ? "current" : ""}>
                        <strong>In Progress</strong>
                        <span>{formatDateTime(selectedReport.updatedAt)}</span>
                      </div>
                      <ChevronRight size={19} />
                      <div className={selectedReport.status === "RESOLVED" ? "current resolved" : ""}>
                        <strong>Resolved</strong>
                        <span>{formatDateTime(selectedReport.resolvedAt || selectedReport.updatedAt)}</span>
                      </div>
                    </div>
                  </section>

                  <section className="drawer-section reporter-card">
                    <h3>Reporter</h3>
                    <div className="applicant-contact-card">
                      <div className="applicant-avatar">{(selectedReport.reporterName || "A").slice(0, 1)}</div>
                      <div>
                        <strong>{selectedReport.reporterName || reporter.fullName || "Anonymous"}</strong>
                        <span>{selectedReport.reporterId ? "Signed-in report" : "Anonymous report"}</span>
                      </div>
                    </div>
                    <div className="contact-list">
                      <span>
                        <Mail size={15} />
                        {reporter.email || "No account email"}
                      </span>
                      <span>
                        <ShieldCheck size={15} />
                        {reporter.role ? `${reporter.role} account` : "No user account attached"}
                      </span>
                    </div>
                  </section>
                </div>

                {fullscreen ? (
                  <div className="drawer-sidebar-content">
                    <section className="drawer-section">
                      <h3>Case Status</h3>
                      <span className={`status-pill ${reportStatusClass(selectedReport)}`}>
                        {reportStatusLabel(selectedReport)}
                      </span>
                    </section>

                    <section className="drawer-section drawer-actions-card">
                      <h3>Actions</h3>
                      <button
                        className="primary-button"
                        disabled={busy || selectedReport.status === "IN_PROGRESS"}
                        onClick={() => onStatusChange(selectedReport.id, "IN_PROGRESS")}
                        type="button"
                      >
                        <Clock3 size={16} />
                        Start
                      </button>
                      <button
                        className="secondary-button"
                        disabled={busy || selectedReport.status === "OPEN"}
                        onClick={() => onStatusChange(selectedReport.id, "OPEN")}
                        type="button"
                      >
                        <AlertTriangle size={16} />
                        Open
                      </button>
                      <button
                        className="success-button"
                        disabled={busy || selectedReport.status === "RESOLVED"}
                        onClick={() => onStatusChange(selectedReport.id, "RESOLVED")}
                        type="button"
                      >
                        <CheckCircle2 size={16} />
                        Resolve
                      </button>
                      <button
                        className="danger-button"
                        disabled={busy || selectedReport.fieldStatus === "FAILED"}
                        onClick={handleMarkFailed}
                        type="button"
                      >
                        <AlertTriangle size={16} />
                        Mark Failed
                      </button>
                    </section>
                  </div>
                ) : null}
              </div>
            ) : null}

            {detailTab === "evidence" ? (
              <div className="drawer-stack">
                <section className="drawer-section report-description-section">
                  <h3>Description</h3>
                  {parsedDescription.fields.length ? (
                    <div className="report-description-grid">
                      {parsedDescription.fields.map((field) => (
                        <DetailValue key={`${field.label}-${field.value}`} label={field.label} value={field.value} />
                      ))}
                    </div>
                  ) : null}
                  <div className="report-note-block">
                    <span>Additional details</span>
                    <p>
                      {parsedDescription.details ||
                        (!parsedDescription.fields.length ? selectedReport.description : "") ||
                        "No additional details provided."}
                    </p>
                  </div>
                </section>
                <section className="drawer-section">
                  <h3>Image</h3>
                  {activeImage?.dataUri ? (
                    <button className="drawer-evidence-preview" onClick={() => setImageModalOpen(true)} type="button">
                      <img src={activeImage.dataUri} alt="Report image" />
                    </button>
                  ) : (
                    <div className="drawer-empty-media">
                      <ImageIcon size={32} />
                      <span>No image attached</span>
                    </div>
                  )}
                </section>
              </div>
            ) : null}

            {detailTab === "location" ? (
              <div className="drawer-stack">
                <section className="drawer-section">
                  <h3>Dispatch Location</h3>
                  <div className="drawer-info-grid">
                    <DetailValue label="Location" value={selectedReport.location} />
                    <DetailValue
                      label="Coordinates"
                      value={hasCoordinates ? `${selectedReport.latitude}, ${selectedReport.longitude}` : ""}
                    />
                  </div>
                  {hasCoordinates ? (
                    <a className="secondary-button drawer-map-button" href={mapUrl} rel="noreferrer" target="_blank">
                      <LocateFixed size={16} />
                      Open Map
                    </a>
                  ) : null}
                </section>
              </div>
            ) : null}

            {!(fullscreen && detailTab === "overview") ? (
              <div className="drawer-actions">
                <button
                  className="primary-button"
                  disabled={busy || selectedReport.status === "IN_PROGRESS"}
                  onClick={() => onStatusChange(selectedReport.id, "IN_PROGRESS")}
                  type="button"
                >
                  <Clock3 size={16} />
                  Start
                </button>
                <button
                  className="secondary-button"
                  disabled={busy || selectedReport.status === "OPEN"}
                  onClick={() => onStatusChange(selectedReport.id, "OPEN")}
                  type="button"
                >
                  <AlertTriangle size={16} />
                  Open
                </button>
                <button
                  className="success-button"
                  disabled={busy || selectedReport.status === "RESOLVED"}
                  onClick={() => onStatusChange(selectedReport.id, "RESOLVED")}
                  type="button"
                >
                  <CheckCircle2 size={16} />
                  Resolve
                </button>
                <button
                  className="danger-button"
                  disabled={busy || selectedReport.fieldStatus === "FAILED"}
                  onClick={handleMarkFailed}
                  type="button"
                >
                  <AlertTriangle size={16} />
                  Mark Failed
                </button>
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>

      {imageModalOpen && activeImage?.dataUri ? (
        <div className="image-modal-backdrop" onClick={() => setImageModalOpen(false)} role="presentation">
          <div aria-modal="true" className="image-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <button
              aria-label="Close image preview"
              className="icon-button image-modal-close"
              onClick={() => setImageModalOpen(false)}
              type="button"
            >
              <X size={18} />
            </button>
            <img src={activeImage.dataUri} alt="Report evidence preview" />
          </div>
        </div>
      ) : null}

      {failureDialogReport ? (
        <div className="image-modal-backdrop failure-modal-backdrop" onClick={closeFailureDialog} role="presentation">
          <form
            aria-labelledby="failure-modal-title"
            aria-modal="true"
            className="failure-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={submitFailureReason}
            role="dialog"
          >
            <div className="failure-modal-icon">
              <AlertTriangle size={22} />
            </div>
            <div className="failure-modal-copy">
              <span>Reporter update</span>
              <h2 id="failure-modal-title">Mark Rescue Failed</h2>
              <p>
                Explain what stopped the rescue for <strong>{reportCode(failureDialogReport)}</strong>. This reason
                will be sent to the reporter and saved on the case.
              </p>
            </div>

            <label className="failure-reason-field">
              <span>Failure reason</span>
              <textarea
                autoFocus
                maxLength={500}
                onChange={(event) => {
                  setFailureReason(event.target.value);
                  setFailureReasonError("");
                }}
                placeholder="Example: The animal left the area before the field team arrived..."
                rows={5}
                value={failureReason}
              />
            </label>
            {failureReasonError ? <p className="failure-modal-error">{failureReasonError}</p> : null}

            <div className="failure-modal-actions">
              <button className="secondary-button" disabled={busy} onClick={closeFailureDialog} type="button">
                Cancel
              </button>
              <button className="danger-button" disabled={busy} type="submit">
                <AlertTriangle size={16} />
                {busy ? "Saving..." : "Mark Failed"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
