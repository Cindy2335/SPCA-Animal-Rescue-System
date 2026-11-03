import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  ExternalLink,
  FileText,
  Heart,
  Home,
  List,
  Mail,
  MapPin,
  Minus,
  PawPrint,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  User,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import useCollapsibleDetailCards from "../hooks/useCollapsibleDetailCards.js";
import {
  getAnimalFallbackUrl,
  normalizeMediaItems,
  resolveMediaUrl,
  useImageFallback,
} from "../utils/media.js";

const PAGE_SIZE = 10;

const statusFilters = [
  { icon: ClipboardCheck, label: "All Applications", value: "ALL" },
  { icon: Clock3, label: "Applications", value: "SUBMITTED" },
  { icon: ShieldCheck, label: "Under Review", value: "UNDER_REVIEW" },
  { icon: Home, label: "Inspection Requested", value: "INSPECTION_REQUIRED" },
  { icon: Home, label: "Home Inspection", value: "INSPECTION_ASSIGNED" },
  { icon: ClipboardCheck, label: "Report Returned", value: "INSPECTION_COMPLETED" },
  { icon: CheckCircle2, label: "Approved", value: "APPROVED" },
  { icon: Calendar, label: "Pickup Scheduled", value: "PICKUP_SCHEDULED" },
  { icon: PawPrint, label: "Adopted", value: "ADOPTED" },
  { icon: XCircle, label: "Declined", value: "DECLINED" },
];

const overviewFilters = [
  { icon: ClipboardCheck, label: "All Applications", tone: "ALL", value: "ALL" },
  {
    icon: Clock3,
    label: "Needs Review",
    statuses: ["SUBMITTED", "UNDER_REVIEW"],
    tone: "SUBMITTED",
    value: "NEEDS_REVIEW",
  },
  {
    icon: Home,
    label: "Home Inspections",
    statuses: ["INSPECTION_REQUIRED", "INSPECTION_ASSIGNED", "INSPECTION_COMPLETED"],
    tone: "UNDER_REVIEW",
    value: "HOME_INSPECTIONS",
  },
  {
    icon: PawPrint,
    label: "Approved & Collection",
    statuses: ["APPROVED", "PICKUP_SCHEDULED", "ADOPTED"],
    tone: "APPROVED",
    value: "SUCCESSFUL",
  },
];

function matchesStatusFilter(application, filterValue) {
  if (filterValue === "ALL") {
    return true;
  }

  const overviewFilter = overviewFilters.find((filter) => filter.value === filterValue);

  if (overviewFilter?.statuses) {
    return overviewFilter.statuses.includes(application.status);
  }

  return application.status === filterValue;
}

function normalizeStatus(status) {
  return String(status || "SUBMITTED")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status) {
  if (["APPROVED", "PICKUP_SCHEDULED", "ADOPTED"].includes(status)) return "approved";
  if (status === "DECLINED") return "declined";
  if (status === "UNDER_REVIEW") return "review";
  return "submitted";
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

function parsePersonality(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
}

function getPersonality(animal) {
  if (Array.isArray(animal?.personality)) {
    return animal.personality.slice(0, 6);
  }

  return parsePersonality(animal?.personalityJson);
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

function applicationCode(application) {
  const suffix = String(application?.id || "")
    .replace(/\D/g, "")
    .slice(-5);

  if (suffix) {
    return `APP-${suffix.padStart(5, "0")}`;
  }

  return `APP-${String(application?.id || "request").slice(-5).toUpperCase()}`;
}

function DetailValue({ label, value }) {
  return (
    <div className="drawer-info-item">
      <span>{label}</span>
      <strong>{value || "Not provided"}</strong>
    </div>
  );
}

function formatFileSize(value) {
  const bytes = Number(value || 0);

  if (!bytes) {
    return "Size unavailable";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ApplicationDocumentCard({ document, label, note, onView }) {
  return (
    <article className={`adoption-document-card ${document ? "available" : "missing"}`}>
      <div className="adoption-document-icon">
        <FileText size={20} />
      </div>
      <div className="adoption-document-copy">
        <strong>{label}</strong>
        <span>{document?.fileName || "Not uploaded"}</span>
        <small>
          {document
            ? `${document.mimeType || "Document"} · ${formatFileSize(document.sizeBytes)}`
            : note}
        </small>
      </div>
      <button
        className="secondary-button"
        disabled={!document || !onView}
        onClick={() => onView?.(document)}
        type="button"
      >
        <Eye size={15} />
        {document ? "Preview" : "Missing"}
      </button>
    </article>
  );
}

function AdoptionDocumentPreviewModal({ document, error, loading, onClose, onDownload }) {
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!document && !loading && !error) return null;

  const fileName = document?.fileName || "Application document";
  const mimeType = document?.mimeType || "";
  const previewUrl = document?.previewUrl || "";
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  const pdfPreviewUrl = previewUrl ? `${previewUrl}#toolbar=1&zoom=${zoom}` : "";

  function changeZoom(amount) {
    setZoom((current) => Math.min(250, Math.max(50, current + amount)));
  }

  return (
    <div className="adoption-document-preview-backdrop" onClick={onClose} role="presentation">
      <section
        aria-labelledby="adoption-document-preview-title"
        aria-modal="true"
        className="adoption-document-preview-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="adoption-document-preview-header">
          <div className="adoption-document-preview-title">
            <span className="adoption-document-preview-icon"><FileText size={20} /></span>
            <div>
              <h2 id="adoption-document-preview-title">{fileName}</h2>
              <p>{mimeType || "Document"}{document?.sizeBytes ? ` · ${formatFileSize(document.sizeBytes)}` : ""}</p>
            </div>
          </div>
          <button aria-label="Close document preview" className="icon-button" onClick={onClose} type="button">
            <X size={19} />
          </button>
        </header>

        {previewUrl && !loading && !error ? (
          <div className="adoption-document-zoom-controls" aria-label="Document zoom controls">
            <button aria-label="Zoom out" disabled={zoom <= 50} onClick={() => changeZoom(-25)} type="button">
              <Minus size={18} />
            </button>
            <button aria-label="Reset zoom" onClick={() => setZoom(100)} type="button">{zoom}%</button>
            <button aria-label="Zoom in" disabled={zoom >= 250} onClick={() => changeZoom(25)} type="button">
              <Plus size={18} />
            </button>
          </div>
        ) : null}

        <div className="adoption-document-preview-stage">
          {loading ? (
            <div className="adoption-document-preview-state" role="status">
              <span className="adoption-document-preview-spinner" />
              <strong>Loading document…</strong>
            </div>
          ) : error ? (
            <div className="adoption-document-preview-state is-error" role="alert">
              <FileText size={30} />
              <strong>Document preview unavailable</strong>
              <p>{error}</p>
            </div>
          ) : isImage && previewUrl ? (
            <div
              className="adoption-document-image-canvas"
              style={{ justifyContent: zoom > 100 ? "flex-start" : "center" }}
            >
              <img alt={fileName} src={previewUrl} style={{ width: `${zoom}%` }} />
            </div>
          ) : isPdf && previewUrl ? (
            <iframe key={pdfPreviewUrl} src={pdfPreviewUrl} title={fileName} />
          ) : (
            <div className="adoption-document-preview-state">
              <FileText size={30} />
              <strong>This file cannot be previewed</strong>
            </div>
          )}
        </div>

        <footer className="adoption-document-preview-footer">
          <button className="secondary-button" onClick={onClose} type="button">Close</button>
          <button
            className="primary-button"
            disabled={loading || Boolean(error) || !previewUrl}
            onClick={onDownload}
            type="button"
          >
            <Download size={17} />
            Download
          </button>
        </footer>
      </section>
    </div>
  );
}

function AnswerBlock({ label, value }) {
  return (
    <div className="drawer-story">
      <span>{label}</span>
      <p>{value || "Not provided"}</p>
    </div>
  );
}

function EmptyState({ loading }) {
  return (
    <article className="panel review-empty-state">
      <span>
        <PawPrint size={24} />
      </span>
      <h2>{loading ? "Loading adoption applications" : "No matching applications"}</h2>
      <p>{loading ? "Fetching the latest application records." : "Try another filter or search term."}</p>
    </article>
  );
}

const inspectionRequestedStatuses = [
  "INSPECTION_REQUIRED",
  "INSPECTION_ASSIGNED",
  "INSPECTION_COMPLETED",
  "APPROVED",
  "PICKUP_SCHEDULED",
  "ADOPTED",
];

function AdoptionActionWorkflow({
  animalId,
  application,
  busy,
  fieldAgents,
  onAgentAssign,
  onDocumentView,
  onStatusChange,
  onViewAnimalProfile,
}) {
  const [selectedAgentId, setSelectedAgentId] = useState(application.assignedAgentId || "");
  const [workflowMessage, setWorkflowMessage] = useState(null);
  const status = application.status;

  useEffect(() => {
    setSelectedAgentId(application.assignedAgentId || "");
    setWorkflowMessage(null);
  }, [application.id]);

  useEffect(() => {
    setSelectedAgentId(application.assignedAgentId || "");
  }, [application.assignedAgentId]);

  async function changeStatus(nextStatus, successMessage) {
    setWorkflowMessage(null);
    const result = await onStatusChange?.(application.id, nextStatus);
    setWorkflowMessage(
      result?.ok
        ? { kind: "success", text: successMessage }
        : { kind: "error", text: result?.error || "The application could not be updated." }
    );
  }

  async function assignAgent() {
    setWorkflowMessage(null);
    const result = await onAgentAssign?.(application.id, selectedAgentId);
    setWorkflowMessage(
      result?.ok
        ? { kind: "success", text: "Field agent assigned. The inspection is now awaiting their report." }
        : { kind: "error", text: result?.error || "The field agent could not be assigned." }
    );
  }

  const reviewComplete = status !== "SUBMITTED";
  const inspectionRequested = inspectionRequestedStatuses.includes(status);
  const inspectionAssigned = [
    "INSPECTION_ASSIGNED",
    "INSPECTION_COMPLETED",
    "APPROVED",
    "PICKUP_SCHEDULED",
    "ADOPTED",
  ].includes(status);
  const inspectionComplete = ["INSPECTION_COMPLETED", "APPROVED", "PICKUP_SCHEDULED", "ADOPTED"].includes(status);
  const approved = ["APPROVED", "PICKUP_SCHEDULED", "ADOPTED"].includes(status);

  return (
    <section className="drawer-section drawer-actions-card adoption-action-workflow">
      <h3>
        <Zap size={15} />
        Application Workflow
      </h3>
      <button
        className="secondary-button workflow-profile-button"
        disabled={!animalId}
        onClick={onViewAnimalProfile}
        type="button"
      >
        <ExternalLink size={16} />
        View Animal Profile
      </button>

      {workflowMessage ? (
        <div className={`workflow-message ${workflowMessage.kind}`} role="status">
          {workflowMessage.kind === "success" ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
          <span>{workflowMessage.text}</span>
        </div>
      ) : null}

      <ol className="workflow-steps">
        <li className={reviewComplete ? "complete" : "current"}>
          <span className="workflow-step-number">1</span>
          <div>
            <strong>Review application</strong>
            <small>Confirm the applicant details and answers.</small>
            <button
              className="secondary-button"
              disabled={busy || reviewComplete || status === "DECLINED"}
              onClick={() => changeStatus("UNDER_REVIEW", "Application moved to review. You can now request an inspection.")}
              type="button"
            >
              <ClipboardCheck size={16} />
              {reviewComplete ? "Under Review" : "Mark as Under Review"}
            </button>
          </div>
        </li>

        <li className={inspectionRequested ? "complete" : reviewComplete ? "current" : ""}>
          <span className="workflow-step-number">2</span>
          <div>
            <strong>Request home inspection</strong>
            <small>Create the inspection before assigning an agent.</small>
            <button
              className="secondary-button"
              disabled={busy || status !== "UNDER_REVIEW"}
              onClick={() =>
                changeStatus(
                  "INSPECTION_REQUIRED",
                  "Home inspection requested. Select and assign a field agent in step 3."
                )
              }
              type="button"
            >
              <Home size={16} />
              {inspectionRequested ? "Inspection Requested" : "Request Home Inspection"}
            </button>
          </div>
        </li>

        <li className={inspectionAssigned ? "complete" : status === "INSPECTION_REQUIRED" ? "current" : ""}>
          <span className="workflow-step-number">3</span>
          <div>
            <strong>Assign field agent</strong>
            <small>Select an agent, then confirm the assignment.</small>
            <label className="dataset-select-field">
              <span>Field agent</span>
              <select
                disabled={busy || !["INSPECTION_REQUIRED", "INSPECTION_ASSIGNED"].includes(status)}
                onChange={(event) => setSelectedAgentId(event.target.value)}
                value={selectedAgentId}
              >
                <option value="">Choose field agent</option>
                {fieldAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.fullName}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="primary-button"
              disabled={
                busy ||
                !selectedAgentId ||
                !["INSPECTION_REQUIRED", "INSPECTION_ASSIGNED"].includes(status) ||
                selectedAgentId === application.assignedAgentId
              }
              onClick={assignAgent}
              type="button"
            >
              <User size={16} />
              {application.assignedAgentId ? "Reassign Agent" : "Assign Agent"}
            </button>
          </div>
        </li>

        <li className={approved ? "complete" : inspectionComplete ? "current" : ""}>
          <span className="workflow-step-number">4</span>
          <div>
            <strong>Make final decision</strong>
            <small>Approval unlocks after the agent submits the inspection report.</small>
            <button
              className="primary-button approve-action"
              disabled={busy || status !== "INSPECTION_COMPLETED"}
              onClick={() => changeStatus("APPROVED", "Application approved. Pickup can now be scheduled.")}
              type="button"
            >
              <CheckCircle2 size={16} />
              {approved ? "Application Approved" : "Final Approve"}
            </button>
          </div>
        </li>

        <li className={status === "ADOPTED" ? "complete" : status === "PICKUP_SCHEDULED" ? "current" : ""}>
          <span className="workflow-step-number">5</span>
          <div>
            <strong>Complete collection</strong>
            <small>Available once the adopter schedules pickup.</small>
            <button
              className="primary-button approve-action"
              disabled={busy || status !== "PICKUP_SCHEDULED"}
              onClick={() => changeStatus("ADOPTED", "Collection completed and the animal marked as adopted.")}
              type="button"
            >
              <PawPrint size={16} />
              {status === "ADOPTED" ? "Animal Collected" : "Mark Animal Collected"}
            </button>
          </div>
        </li>
      </ol>

      <button
        className="danger-button compact-danger"
        disabled={busy || ["DECLINED", "ADOPTED"].includes(status)}
        onClick={() => changeStatus("DECLINED", "Application declined.")}
        type="button"
      >
        <XCircle size={16} />
        {status === "DECLINED" ? "Declined" : "Decline Application"}
      </button>
    </section>
  );
}

export default function AdoptionApplicationsPage({
  applications,
  busyId,
  fieldAgents = [],
  loading,
  onAgentAssign,
  onDocumentView,
  onStatusChange,
  onRefresh,
  onViewAnimalProfile,
  query,
}) {
  const [activeAnimalImageIndex, setActiveAnimalImageIndex] = useState(0);
  const [detailTab, setDetailTab] = useState("overview");
  const [drawerClosed, setDrawerClosed] = useState(false);
  const [documentPreview, setDocumentPreview] = useState(null);
  const [documentPreviewError, setDocumentPreviewError] = useState("");
  const [documentPreviewLoading, setDocumentPreviewLoading] = useState(false);
  const documentPreviewRequestRef = useRef(0);
  const documentPreviewUrlRef = useRef("");
  const fullscreen = true;
  const drawerRef = useRef(null);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(() => {
    const [view, id] = window.location.hash.slice(1).split("/");
    return view === "adoptions" ? decodeURIComponent(id || "") : "";
  });
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [tableQuery, setTableQuery] = useState("");

  const filteredApplications = useMemo(() => {
    const searchText = [query, tableQuery].join(" ").trim().toLowerCase();

    return applications.filter((application) => {
      const animal = application.animal || {};
      const applicant = application.applicant || {};
      const haystack = [
        applicationCode(application),
        animal.name,
        animal.type,
        animal.breed,
        animal.location,
        application.applicantName,
        application.email,
        application.phone,
        applicant.fullName,
        applicant.email,
        application.status,
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = haystack.includes(searchText);
      const matchesStatus = matchesStatusFilter(application, statusFilter);

      return matchesQuery && matchesStatus;
    });
  }, [applications, query, statusFilter, tableQuery]);

  const pageCount = Math.max(1, Math.ceil(filteredApplications.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagedApplications = filteredApplications.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selectedApplication = drawerClosed
    ? null
    : filteredApplications.find((application) => application.id === selectedId) || null;
  const selectedApplicationIndex = selectedApplication
    ? filteredApplications.findIndex((application) => application.id === selectedApplication.id)
    : -1;
  const animal = selectedApplication?.animal || {};
  const applicant = selectedApplication?.applicant || {};
  const animalImages = getAnimalImages(animal);
  const activeAnimalImage = animalImages[activeAnimalImageIndex] || animalImages[0];
  const busy = busyId === selectedApplication?.id;
  const drawerOpen = Boolean(selectedApplication);
  useCollapsibleDetailCards(drawerRef, `${selectedApplication?.id || ""}:${detailTab}`);
  const canGoPrevious = selectedApplicationIndex > 0;
  const canGoNext = selectedApplicationIndex >= 0 && selectedApplicationIndex < filteredApplications.length - 1;
  const relatedApplications = selectedApplication
    ? applications.filter(
        (application) =>
          application.id !== selectedApplication.id &&
          application.animalId &&
          selectedApplication.animalId &&
          application.animalId === selectedApplication.animalId
      )
    : [];
  const applicationDocuments = Array.isArray(selectedApplication?.documents)
    ? selectedApplication.documents
    : [];
  const identityDocument = applicationDocuments.find((document) => document.documentType === "IDENTITY");
  const proofOfResidenceDocument = applicationDocuments.find(
    (document) => document.documentType === "PROOF_OF_RESIDENCE"
  );

  const overviewCounts = useMemo(() => {
    return overviewFilters.reduce((acc, filter) => {
      acc[filter.value] = applications.filter((application) =>
        matchesStatusFilter(application, filter.value)
      ).length;
      return acc;
    }, {});
  }, [applications]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, tableQuery]);

  useEffect(() => {
    const syncSelectionFromLocation = () => {
      const [view, id] = window.location.hash.slice(1).split("/");
      const nextId = view === "adoptions" ? decodeURIComponent(id || "") : "";
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
    setActiveAnimalImageIndex(0);
    setDetailTab("overview");
  }, [selectedApplication?.id]);

  useEffect(() => () => {
    if (documentPreviewUrlRef.current) URL.revokeObjectURL(documentPreviewUrlRef.current);
  }, []);

  function handleSelectApplication(id) {
    setDrawerClosed(false);
    setSelectedId(id);
    window.history.pushState(
      {},
      "",
      `${window.location.pathname}${window.location.search}#adoptions/${encodeURIComponent(id)}`
    );
  }

  function handleCloseApplication() {
    setDrawerClosed(true);
    setSelectedId("");
    window.history.pushState({}, "", `${window.location.pathname}${window.location.search}#adoptions`);
  }

  function handleStepApplication(direction) {
    const nextApplication = filteredApplications[selectedApplicationIndex + direction];

    if (!nextApplication) {
      return;
    }

    handleSelectApplication(nextApplication.id);
  }

  function handleViewAnimalProfile() {
    onViewAnimalProfile?.(animal.id || selectedApplication?.animalId);
  }

  function releaseDocumentPreviewUrl() {
    if (!documentPreviewUrlRef.current) return;
    URL.revokeObjectURL(documentPreviewUrlRef.current);
    documentPreviewUrlRef.current = "";
  }

  function closeDocumentPreview() {
    documentPreviewRequestRef.current += 1;
    releaseDocumentPreviewUrl();
    setDocumentPreview(null);
    setDocumentPreviewError("");
    setDocumentPreviewLoading(false);
  }

  async function openDocumentPreview(documentMetadata) {
    const applicationId = selectedApplication?.id;
    if (!applicationId || !documentMetadata?.documentType || !onDocumentView) return;

    const requestId = documentPreviewRequestRef.current + 1;
    documentPreviewRequestRef.current = requestId;
    releaseDocumentPreviewUrl();
    setDocumentPreview({ ...documentMetadata, previewUrl: "" });
    setDocumentPreviewError("");
    setDocumentPreviewLoading(true);

    try {
      const result = await onDocumentView(applicationId, documentMetadata.documentType);
      if (!result?.ok || !result.document?.dataUri) {
        throw new Error(result?.error || "The selected document is unavailable");
      }

      const response = await fetch(result.document.dataUri);
      const blob = await response.blob();
      const previewUrl = URL.createObjectURL(blob);

      if (documentPreviewRequestRef.current !== requestId) {
        URL.revokeObjectURL(previewUrl);
        return;
      }

      documentPreviewUrlRef.current = previewUrl;
      setDocumentPreview({ ...result.document, previewUrl });
    } catch (previewError) {
      if (documentPreviewRequestRef.current === requestId) {
        setDocumentPreviewError(previewError instanceof Error ? previewError.message : "The document could not be opened");
      }
    } finally {
      if (documentPreviewRequestRef.current === requestId) setDocumentPreviewLoading(false);
    }
  }

  function downloadDocumentPreview() {
    if (!documentPreview?.previewUrl) return;
    const link = window.document.createElement("a");
    link.href = documentPreview.previewUrl;
    link.download = documentPreview.fileName || "adoption-document";
    window.document.body.appendChild(link);
    link.click();
    link.remove();
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
    <section className="admin-dataset-page adoption-review-page">
      <div className={`admin-workspace ${drawerOpen ? "has-drawer" : ""}`}>
        <div className="admin-main-stack">
          <div className="dataset-stats-grid adoption-stats-grid">
            {overviewFilters.map((filter) => {
              const Icon = filter.icon;
              const active = statusFilter === filter.value;
              return (
                <button
                  className={`dataset-stat-card ${active ? "active" : ""}`}
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  type="button"
                >
                  <span className={`dataset-stat-icon ${statusClass(filter.tone)}`}>
                    <Icon size={22} />
                  </span>
                  <div>
                    <small>{filter.label}</small>
                    <strong>{overviewCounts[filter.value] || 0}</strong>
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
                placeholder="Search applicants, animals, or request ID..."
                type="search"
                value={tableQuery}
              />
            </label>
            <label className="dataset-select-field">
              <span>Status</span>
              <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                <option value="ALL">All Statuses</option>
                <optgroup label="Overview">
                  {overviewFilters.slice(1).map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {filter.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Individual Status">
                  {statusFilters.slice(1).map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {filter.label}
                    </option>
                  ))}
                </optgroup>
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
                    <th>Request</th>
                    <th>Pet</th>
                    <th>Applicant</th>
                    <th>Contact</th>
                    <th>Housing</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedApplications.length ? (
                    pagedApplications.map((application) => {
                      const rowAnimal = application.animal || {};
                      const rowImage = getAnimalImages(rowAnimal)[0]?.dataUri || rowAnimal.imageDataUri;
                      const active = selectedApplication?.id === application.id;

                      return (
                        <tr className={active ? "active" : ""} key={application.id}>
                          <td>
                            <button
                              className="entity-cell entity-cell-button"
                              onClick={() => handleSelectApplication(application.id)}
                              type="button"
                            >
                              {rowImage ? (
                                <img
                                  src={rowImage}
                                  alt=""
                                  onError={(event) => useImageFallback(event, getAnimalFallbackUrl(rowAnimal.type))}
                                />
                              ) : (
                                <span className="entity-fallback">
                                  <PawPrint size={17} />
                                </span>
                              )}
                              <span>
                                <strong>{applicationCode(application)}</strong>
                                <small>{formatDate(application.createdAt)}</small>
                              </span>
                            </button>
                          </td>
                          <td>
                            <strong>{rowAnimal.name || "Pet"}</strong>
                            <small className="table-muted">{rowAnimal.breed || rowAnimal.type || "Animal"}</small>
                          </td>
                          <td>{application.applicantName || "Applicant"}</td>
                          <td>
                            <span>{application.email || "No email"}</span>
                            <small className="table-muted">{application.phone || "No phone"}</small>
                          </td>
                          <td>{application.housingType || "Unknown"}</td>
                          <td>
                            <span className={`status-pill ${statusClass(application.status)}`}>
                              {normalizeStatus(application.status)}
                            </span>
                          </td>
                          <td>{formatDate(application.createdAt)}</td>
                          <td>
                            <div className="row-actions">
                              <button
                                className="link-action"
                                onClick={() => handleSelectApplication(application.id)}
                                type="button"
                              >
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
                      <td className="empty-row" colSpan="8">
                        <EmptyState loading={loading} />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="dataset-pagination">
              <span>
                Showing {filteredApplications.length ? (safePage - 1) * PAGE_SIZE + 1 : 0} to{" "}
                {Math.min(safePage * PAGE_SIZE, filteredApplications.length)} of {filteredApplications.length} requests
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
                aria-label="Close application details"
                className="drawer-close-button"
                onClick={handleCloseApplication}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="drawer-fullscreen-topbar">
              <nav className="drawer-breadcrumb">
                <span>Adoption Requests</span>
                <span className="crumb-sep">/</span>
                <span className="crumb-active">
                  {selectedApplication.applicantName || "Applicant"} ({applicationCode(selectedApplication)})
                </span>
              </nav>
              <div className="drawer-topnav">
                <button
                  className="drawer-topnav-btn"
                  onClick={handleCloseApplication}
                  type="button"
                >
                  <List size={15} />
                  View Applications
                </button>
                <button className="drawer-topnav-btn" onClick={() => onRefresh?.()} type="button">
                  <RefreshCw size={15} />
                  Refresh Application
                </button>
                <button
                  className="drawer-topnav-btn"
                  disabled={!animal.id && !selectedApplication.animalId}
                  onClick={handleViewAnimalProfile}
                  type="button"
                >
                  <ExternalLink size={15} />
                  View Animal Profile
                </button>
                <span className="drawer-topnav-divider" />
                <button
                  className="drawer-topnav-btn"
                  disabled={!canGoPrevious}
                  onClick={() => handleStepApplication(-1)}
                  type="button"
                >
                  <ChevronLeft size={15} />
                  Previous
                </button>
                <button
                  className="drawer-topnav-btn"
                  disabled={!canGoNext}
                  onClick={() => handleStepApplication(1)}
                  type="button"
                >
                  Next
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            <div className="drawer-profile-head">
              <div className="drawer-profile-image">
                {activeAnimalImage?.dataUri ? (
                  <img
                    src={activeAnimalImage.dataUri}
                    alt=""
                    onError={(event) => useImageFallback(event, getAnimalFallbackUrl(animal.type))}
                    style={{
                      height: "auto",
                      maxHeight: "100%",
                      maxWidth: "100%",
                      objectFit: "contain",
                      width: "auto",
                    }}
                  />
                ) : (
                  <span>
                    <PawPrint size={38} />
                  </span>
                )}
              </div>
              <div className="drawer-profile-copy">
                <h2>{selectedApplication.applicantName || "Applicant"}</h2>
                <p>
                  Wants to adopt {animal.name || "this pet"} · {animal.breed || animal.type || "Animal"}
                </p>
                <span className={`status-pill ${statusClass(selectedApplication.status)}`}>
                  {normalizeStatus(selectedApplication.status)}
                </span>
                <strong className="drawer-code">{applicationCode(selectedApplication)}</strong>
                <div className="drawer-stat-row">
                  {selectedApplication.createdAt ? (
                    <div className="drawer-stat-chip">
                      <Calendar size={18} />
                      <div className="drawer-stat-chip-info">
                        <span className="drawer-stat-chip-value">{formatDate(selectedApplication.createdAt)}</span>
                        <span className="drawer-stat-chip-label">Applied</span>
                      </div>
                    </div>
                  ) : null}
                  {animal.name ? (
                    <div className="drawer-stat-chip">
                      <PawPrint size={18} />
                      <div className="drawer-stat-chip-info">
                        <span className="drawer-stat-chip-value">{animal.name}</span>
                        <span className="drawer-stat-chip-label">Animal</span>
                      </div>
                    </div>
                  ) : null}
                  {selectedApplication.housingType ? (
                    <div className="drawer-stat-chip">
                      <Home size={18} />
                      <div className="drawer-stat-chip-info">
                        <span className="drawer-stat-chip-value">{selectedApplication.housingType}</span>
                        <span className="drawer-stat-chip-label">Housing</span>
                      </div>
                    </div>
                  ) : null}
                  {selectedApplication.phone ? (
                    <div className="drawer-stat-chip">
                      <Phone size={18} />
                      <div className="drawer-stat-chip-info">
                        <span className="drawer-stat-chip-value">{selectedApplication.phone}</span>
                        <span className="drawer-stat-chip-label">Phone</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {animalImages.length > 1 ? (
              <div className="drawer-gallery compact-gallery">
                {animalImages.map((image, index) => (
                  <button
                    className={index === activeAnimalImageIndex ? "active" : ""}
                    key={image.id || index}
                    onClick={() => setActiveAnimalImageIndex(index)}
                    type="button"
                  >
                    <img
                      src={image.dataUri}
                      alt=""
                      onError={(event) => useImageFallback(event, getAnimalFallbackUrl(animal.type))}
                    />
                  </button>
                ))}
              </div>
            ) : null}

            <div className="drawer-tabs" role="tablist">
              {["overview", "animal", "answers"].map((tab) => (
                <button
                  className={detailTab === tab ? "active" : ""}
                  key={tab}
                  onClick={() => handleDetailTabChange(tab)}
                  type="button"
                >
                  {tab[0].toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {detailTab === "overview" ? (
              <div className="drawer-page-body">
                <div className="drawer-stack">
                  <section className="drawer-section">
                    <h3>Applicant Details</h3>
                    <div className="drawer-info-grid">
                      <DetailValue label="Name" value={selectedApplication.applicantName || applicant.fullName} />
                      <DetailValue label="Email" value={selectedApplication.email || applicant.email} />
                      <DetailValue label="Phone" value={selectedApplication.phone} />
                      <DetailValue label="Housing" value={selectedApplication.housingType} />
                      <DetailValue label="Has Yard" value={selectedApplication.hasYard ? "Yes" : "No"} />
                      <DetailValue label="Other Pets" value={selectedApplication.hasOtherPets ? "Yes" : "No"} />
                    </div>
                  </section>

                  <section className="drawer-section">
                    <h3>Application Details</h3>
                    <div className="drawer-info-grid">
                      <DetailValue label="Submitted" value={formatDateTime(selectedApplication.createdAt)} />
                      <DetailValue label="Last Updated" value={formatDateTime(selectedApplication.updatedAt)} />
                      <DetailValue
                        label="Household Agreement"
                        value={selectedApplication.householdAgreement ? "Confirmed" : "Not confirmed"}
                      />
                      <DetailValue label="Animal Status" value={animal.status ? normalizeStatus(animal.status) : ""} />
                    </div>
                  </section>

                  <section className="drawer-section adoption-documents-section">
                    <h3>Required Documents</h3>
                    <div className="adoption-document-grid">
                      <ApplicationDocumentCard
                        document={identityDocument}
                        label="ID or Passport"
                        note="Required for new applications"
                        onView={onDocumentView ? openDocumentPreview : undefined}
                      />
                      <ApplicationDocumentCard
                        document={proofOfResidenceDocument}
                        label="Proof of Residence"
                        note="Required for new applications"
                        onView={onDocumentView ? openDocumentPreview : undefined}
                      />
                    </div>
                  </section>

                  <section className="drawer-section">
                    <h3>Contact</h3>
                    <div className="contact-list">
                      <span>
                        <Mail size={15} />
                        {selectedApplication.email || applicant.email || "No email"}
                      </span>
                      <span>
                        <Phone size={15} />
                        {selectedApplication.phone || "No phone"}
                      </span>
                      <span>
                        <Home size={15} />
                        {selectedApplication.address || "No address"}
                      </span>
                    </div>
                  </section>

                  {fullscreen ? (
                    <div className="adoption-workflow-slot">
                      <AdoptionActionWorkflow
                        animalId={animal.id || selectedApplication.animalId}
                        application={selectedApplication}
                        busy={busy}
                        fieldAgents={fieldAgents}
                        onAgentAssign={onAgentAssign}
                        onStatusChange={onStatusChange}
                        onViewAnimalProfile={handleViewAnimalProfile}
                      />
                    </div>
                  ) : null}

                  {relatedApplications.length ? (
                    <section className="drawer-section">
                      <h3>Other Requests For {animal.name || "This Pet"}</h3>
                      <div className="drawer-mini-list">
                        {relatedApplications.slice(0, 4).map((application) => (
                          <button key={application.id} onClick={() => handleSelectApplication(application.id)} type="button">
                            <span>{application.applicantName || "Applicant"}</span>
                            <em className={`status-pill ${statusClass(application.status)}`}>
                              {normalizeStatus(application.status)}
                            </em>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>

                {fullscreen ? (
                  <div className="drawer-sidebar-content">
                    <section className="drawer-section">
                      <h3>Application Status</h3>
                      <span className={`status-pill ${statusClass(selectedApplication.status)}`}>
                        {normalizeStatus(selectedApplication.status)}
                      </span>
                    </section>

                    <section className="drawer-section drawer-actions-card">
                      <h3>Home Inspection</h3>
                      <div className="drawer-info-grid">
                        <DetailValue label="Assigned Agent" value={selectedApplication.assignedAgent?.fullName} />
                        <DetailValue label="Recommendation" value={selectedApplication.inspectionRecommendation ? normalizeStatus(selectedApplication.inspectionRecommendation) : ""} />
                        <DetailValue label="Property Safe" value={selectedApplication.inspectionPropertySafe == null ? "" : selectedApplication.inspectionPropertySafe ? "Yes" : "No"} />
                        <DetailValue label="Secure Yard / Exits" value={selectedApplication.inspectionSecureYard == null ? "" : selectedApplication.inspectionSecureYard ? "Yes" : "No"} />
                        <DetailValue label="Pets Compatible" value={selectedApplication.inspectionPetsCompatible == null ? "" : selectedApplication.inspectionPetsCompatible ? "Yes" : "No"} />
                        <DetailValue label="Pickup" value={selectedApplication.pickupScheduledAt ? formatDateTime(selectedApplication.pickupScheduledAt) : ""} />
                      </div>
                      {selectedApplication.inspectionNotes ? <AnswerBlock label="Field agent report" value={selectedApplication.inspectionNotes} /> : null}
                    </section>

                  </div>
                ) : null}

              </div>
            ) : null}

            {detailTab === "animal" ? (
              <div className="drawer-stack">
                <section className="drawer-section">
                  <h3>Animal Profile</h3>
                  <div className="drawer-info-grid">
                    <DetailValue label="Name" value={animal.name} />
                    <DetailValue label="Type" value={animal.type} />
                    <DetailValue label="Breed" value={animal.breed} />
                    <DetailValue label="Adoption Status" value={animal.status ? normalizeStatus(animal.status) : ""} />
                    <DetailValue label="Age" value={animal.age} />
                    <DetailValue label="Gender" value={animal.sex} />
                    <DetailValue label="Size" value={animal.size} />
                    <DetailValue label="Energy" value={animal.energy} />
                    <DetailValue label="Vaccinated" value={animal.vaccinated ? "Yes" : "No"} />
                    <DetailValue label="Best For" value={animal.bestFor} />
                    <DetailValue label="Location" value={animal.location} />
                    <DetailValue label="Photos" value={String(animalImages.length)} />
                  </div>
                </section>
                <section className="drawer-section">
                  <h3>Personality</h3>
                  <div className="personality-row">
                    {getPersonality(animal).map((trait) => (
                      <span key={trait}>{trait}</span>
                    ))}
                  </div>
                  <p className="drawer-story">{animal.story || "No animal story was provided."}</p>
                </section>
              </div>
            ) : null}

            {detailTab === "answers" ? (
              <div className="drawer-stack">
                <AnswerBlock label="Why they want to adopt" value={selectedApplication.reason} />
                <AnswerBlock label="Pet care experience" value={selectedApplication.experience} />
                <AnswerBlock label="Daily schedule" value={selectedApplication.schedule} />
                <AnswerBlock label="Other pets details" value={selectedApplication.otherPetsDetails} />
              </div>
            ) : null}

            {!(fullscreen && detailTab === "overview") ? (
              <div className="drawer-actions">
                <AdoptionActionWorkflow
                  animalId={animal.id || selectedApplication.animalId}
                  application={selectedApplication}
                  busy={busy}
                  fieldAgents={fieldAgents}
                  onAgentAssign={onAgentAssign}
                  onStatusChange={onStatusChange}
                  onViewAnimalProfile={handleViewAnimalProfile}
                />
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>
      <AdoptionDocumentPreviewModal
        key={documentPreview?.previewUrl || documentPreview?.documentType || "document-preview"}
        document={documentPreview}
        error={documentPreviewError}
        loading={documentPreviewLoading}
        onClose={closeDocumentPreview}
        onDownload={downloadDocumentPreview}
      />
    </section>
  );
}
