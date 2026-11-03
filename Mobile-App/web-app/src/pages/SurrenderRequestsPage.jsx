import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  ImageIcon,
  List,
  Mail,
  Maximize2,
  Minimize2,
  PawPrint,
  Phone,
  RefreshCw,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import useCollapsibleDetailCards from "../hooks/useCollapsibleDetailCards.js";
import { normalizeMediaItems } from "../utils/media.js";

const PAGE_SIZE = 10;

const statusFilters = [
  { icon: PawPrint, label: "All Requests", value: "ALL" },
  { icon: Clock3, label: "Submitted", value: "SUBMITTED" },
  { icon: Phone, label: "Contacted", value: "CONTACTED" },
  { icon: CalendarClock, label: "Intake Scheduled", value: "INTAKE_SCHEDULED" },
  { icon: CheckCircle2, label: "Completed", value: "COMPLETED" },
];

function normalizeStatus(status) {
  if (status === "CONTACTED") {
    return "Accepted";
  }

  return String(status || "SUBMITTED")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status) {
  if (status === "COMPLETED") return "approved";
  if (status === "CONTACTED" || status === "INTAKE_SCHEDULED") return "review";
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

function formatSchedule(value) {
  if (!value) {
    return "Not scheduled";
  }

  return formatDateTime(value);
}

function isAnonymousSurrender(request) {
  return Boolean(
    request?.isAnonymous ||
      (!request?.ownerId &&
        String(request?.ownerName || "").trim().toLowerCase() === "anonymous" &&
        !request?.email &&
        !request?.phone &&
        !request?.address)
  );
}

function workflowMessage(request) {
  const anonymous = isAnonymousSurrender(request);

  if (request.status === "SUBMITTED") {
    if (anonymous) {
      return "Review the anonymous surrender. There are no contact details or account to request a schedule from.";
    }

    return "Review the request, then accept it to prompt the owner to choose a drop-off time.";
  }

  if (request.status === "CONTACTED") {
    if (anonymous) {
      return "Accepted as an anonymous surrender. Complete intake when the animal is brought to the shelter.";
    }

    return "Accepted. The owner can now schedule when they will bring the animal in.";
  }

  if (request.status === "INTAKE_SCHEDULED") {
    return "Drop-off is scheduled. Complete intake once the animal arrives at the shelter.";
  }

  if (request.status === "COMPLETED") {
    return request.shelterAnimalId
      ? "Intake complete. This animal has been added to the shelter."
      : "Intake complete.";
  }

  return "Review this request and continue the intake process.";
}

function surrenderCode(request) {
  const suffix = String(request?.id || "")
    .replace(/\D/g, "")
    .slice(-5);

  if (suffix) {
    return `SUR-${suffix.padStart(5, "0")}`;
  }

  return `SUR-${String(request?.id || "case").slice(-5).toUpperCase()}`;
}

function getSurrenderImages(request) {
  return request?.images?.length ? normalizeMediaItems(request.images) : [];
}

function DetailValue({ label, value }) {
  return (
    <div className="drawer-info-item">
      <span>{label}</span>
      <strong>{value || "Not provided"}</strong>
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
      <h2>{loading ? "Loading surrender requests" : "No matching requests"}</h2>
      <p>{loading ? "Fetching intake records." : "Try another filter or search term."}</p>
    </article>
  );
}

export default function SurrenderRequestsPage({
  busyId,
  loading,
  onStatusChange,
  onRefresh,
  onViewAnimalProfile,
  query,
  surrenders,
}) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [detailTab, setDetailTab] = useState("overview");
  const [drawerClosed, setDrawerClosed] = useState(() => !window.location.hash.slice(1).split("/")[1]);
  const fullscreen = true;
  const drawerRef = useRef(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(() => {
    const [view, id] = window.location.hash.slice(1).split("/");
    return view === "surrenders" ? decodeURIComponent(id || "") : "";
  });
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [tableQuery, setTableQuery] = useState("");

  const filteredSurrenders = useMemo(() => {
    const searchText = [query, tableQuery].join(" ").trim().toLowerCase();

    return surrenders.filter((request) => {
      const owner = request.owner || {};
      const haystack = [
        surrenderCode(request),
        request.ownerName,
        request.email,
        request.phone,
        request.address,
        owner.fullName,
        owner.email,
        request.animalName,
        request.animalType,
        request.breed,
        request.age,
        request.sex,
        request.reason,
        request.urgency,
        request.status,
        request.scheduledIntakeAt,
        request.scheduledIntakeNote,
        request.shelterAnimalId,
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = haystack.includes(searchText);
      const matchesStatus = statusFilter === "ALL" || request.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [query, statusFilter, surrenders, tableQuery]);

  const pageCount = Math.max(1, Math.ceil(filteredSurrenders.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagedSurrenders = filteredSurrenders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selectedSurrender = drawerClosed
    ? null
    : filteredSurrenders.find((request) => request.id === selectedId) || filteredSurrenders[0] || null;
  const selectedSurrenderIndex = selectedSurrender
    ? filteredSurrenders.findIndex((request) => request.id === selectedSurrender.id)
    : -1;
  const owner = selectedSurrender?.owner || {};
  const anonymousSurrender = isAnonymousSurrender(selectedSurrender);
  const images = getSurrenderImages(selectedSurrender);
  const activeImage = images[activeImageIndex] || images[0];
  const busy = busyId === selectedSurrender?.id;
  const drawerOpen = Boolean(selectedSurrender);
  useCollapsibleDetailCards(drawerRef, `${selectedSurrender?.id || ""}:${detailTab}`);
  const canGoPrevious = selectedSurrenderIndex > 0;
  const canGoNext = selectedSurrenderIndex >= 0 && selectedSurrenderIndex < filteredSurrenders.length - 1;

  const counts = useMemo(() => {
    return statusFilters.reduce((acc, filter) => {
      acc[filter.value] =
        filter.value === "ALL"
          ? surrenders.length
          : surrenders.filter((request) => request.status === filter.value).length;
      return acc;
    }, {});
  }, [surrenders]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, tableQuery]);

  useEffect(() => {
    if (drawerClosed) {
      return;
    }

    if (!filteredSurrenders.length) {
      setSelectedId("");
      return;
    }

    if (!filteredSurrenders.some((request) => request.id === selectedId)) {
      setSelectedId(filteredSurrenders[0].id);
    }
  }, [drawerClosed, filteredSurrenders, selectedId]);

  useEffect(() => {
    setActiveImageIndex(0);
    setDetailTab("overview");
    setImageModalOpen(false);
  }, [selectedSurrender?.id]);

  function handleSelectSurrender(id) {
    window.history.pushState(
      {},
      "",
      `${window.location.pathname}${window.location.search}#surrenders/${encodeURIComponent(id)}`
    );
    setDrawerClosed(false);
    setSelectedId(id);
  }

  function handleCloseSurrender() {
    window.history.pushState(
      {},
      "",
      `${window.location.pathname}${window.location.search}#surrenders`
    );
    setDrawerClosed(true);
  }

  function handleStepSurrender(direction) {
    const nextSurrender = filteredSurrenders[selectedSurrenderIndex + direction];

    if (!nextSurrender) {
      return;
    }

    handleSelectSurrender(nextSurrender.id);
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
    <section className="admin-dataset-page surrender-review-page">
      <div className={`admin-workspace ${drawerOpen ? "has-drawer" : ""}`}>
        <div className="admin-main-stack">
          <div className="dataset-stats-grid surrender-stats-grid">
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
                placeholder="Search owners, animals, reasons, or request ID..."
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
                    <th>Request</th>
                    <th>Pet</th>
                    <th>Submitted by</th>
                    <th>Reason</th>
                    <th>Urgency</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedSurrenders.length ? (
                    pagedSurrenders.map((request) => {
                      const image = getSurrenderImages(request)[0]?.dataUri;
                      const requestOwner = request.owner || {};
                      const anonymous = isAnonymousSurrender(request);
                      const active = selectedSurrender?.id === request.id;

                      return (
                        <tr className={active ? "active" : ""} key={request.id}>
                          <td>
                            <button
                              className="entity-cell entity-cell-button"
                              onClick={() => handleSelectSurrender(request.id)}
                              type="button"
                            >
                              {image ? (
                                <img src={image} alt="" />
                              ) : (
                                <span className="entity-fallback">
                                  <PawPrint size={17} />
                                </span>
                              )}
                              <span>
                                <strong>{surrenderCode(request)}</strong>
                                <small>{formatDate(request.createdAt)}</small>
                              </span>
                            </button>
                          </td>
                          <td>
                            <strong>{request.animalName || request.animalType || "Animal"}</strong>
                            <small className="table-muted">{request.breed || request.animalType || "Pet"}</small>
                          </td>
                          <td>
                            <span>{anonymous ? "Anonymous" : request.ownerName || requestOwner.fullName || "Owner"}</span>
                            <small className="table-muted">
                              {anonymous ? "No identifying details" : request.phone || request.email || "No contact"}
                            </small>
                          </td>
                          <td>{request.reason || "No reason"}</td>
                          <td>{request.urgency || "Unknown"}</td>
                          <td>
                            <span className={`status-pill ${statusClass(request.status)}`}>
                              {normalizeStatus(request.status)}
                            </span>
                          </td>
                          <td>{formatDate(request.createdAt)}</td>
                          <td>
                            <div className="row-actions">
                              <button className="link-action" onClick={() => handleSelectSurrender(request.id)} type="button">
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
                Showing {filteredSurrenders.length ? (safePage - 1) * PAGE_SIZE + 1 : 0} to{" "}
                {Math.min(safePage * PAGE_SIZE, filteredSurrenders.length)} of {filteredSurrenders.length} requests
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
                aria-label="Close surrender details"
                className="drawer-close-button"
                onClick={handleCloseSurrender}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="drawer-fullscreen-topbar">
              <nav className="drawer-breadcrumb">
                <span>Surrender Requests</span>
                <span className="crumb-sep">/</span>
                <span className="crumb-active">
                  {selectedSurrender.animalName || selectedSurrender.animalType || "Animal"} ({surrenderCode(selectedSurrender)})
                </span>
              </nav>
              <div className="drawer-topnav">
                <button className="drawer-topnav-btn" onClick={handleCloseSurrender} type="button">
                  <List size={15} />
                  View Requests
                </button>
                <span className="drawer-topnav-divider" />
                <button className="drawer-topnav-btn" onClick={() => onRefresh?.()} type="button">
                  <RefreshCw size={15} />
                  Refresh Request
                </button>
                <span className="drawer-topnav-divider" />
                <button
                  className="drawer-topnav-btn"
                  disabled={!canGoPrevious}
                  onClick={() => handleStepSurrender(-1)}
                  type="button"
                >
                  <ChevronLeft size={15} />
                  Previous
                </button>
                <button
                  className="drawer-topnav-btn"
                  disabled={!canGoNext}
                  onClick={() => handleStepSurrender(1)}
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
                    <PawPrint size={38} />
                  </span>
                )}
              </button>
              <div>
                <h2>{selectedSurrender.animalName || `${selectedSurrender.animalType || "Animal"} Request`}</h2>
                <p>
                  {selectedSurrender.breed || selectedSurrender.animalType || "Pet"}{" "}
                  {anonymousSurrender
                    ? "submitted anonymously"
                    : `requested by ${selectedSurrender.ownerName || owner.fullName || "owner"}`}
                </p>
                <span className={`status-pill ${statusClass(selectedSurrender.status)}`}>
                  {normalizeStatus(selectedSurrender.status)}
                </span>
                <strong className="drawer-code">{surrenderCode(selectedSurrender)}</strong>
                <div className="drawer-stat-row">
                  <div className="drawer-stat-chip">
                    <Clock3 size={18} />
                    <div className="drawer-stat-chip-info">
                      <span className="drawer-stat-chip-value">{formatDate(selectedSurrender.createdAt)}</span>
                      <span className="drawer-stat-chip-label">Submitted</span>
                    </div>
                  </div>
                  <div className="drawer-stat-chip">
                    <User size={18} />
                    <div className="drawer-stat-chip-info">
                      <span className="drawer-stat-chip-value">{selectedSurrender.ownerName || owner.fullName || "Owner"}</span>
                      <span className="drawer-stat-chip-label">Submitted by</span>
                    </div>
                  </div>
                  <div className="drawer-stat-chip">
                    <CalendarClock size={18} />
                    <div className="drawer-stat-chip-info">
                      <span className="drawer-stat-chip-value">
                        {selectedSurrender.scheduledIntakeAt
                          ? formatSchedule(selectedSurrender.scheduledIntakeAt)
                          : selectedSurrender.urgency || "Unknown"}
                      </span>
                      <span className="drawer-stat-chip-label">
                        {selectedSurrender.scheduledIntakeAt ? "Drop-off" : "Urgency"}
                      </span>
                    </div>
                  </div>
                  <div className="drawer-stat-chip">
                    <ImageIcon size={18} />
                    <div className="drawer-stat-chip-info">
                      <span className="drawer-stat-chip-value">{images.length}</span>
                      <span className="drawer-stat-chip-label">Photos</span>
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
              {["overview", "pet", "notes"].map((tab) => (
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
                  <section className="drawer-section surrender-workflow-card">
                    <h3>Workflow</h3>
                    <p>{workflowMessage(selectedSurrender)}</p>
                    <div className="drawer-info-grid">
                      <DetailValue label="Scheduled Drop-off" value={formatSchedule(selectedSurrender.scheduledIntakeAt)} />
                      <DetailValue label="Owner Note" value={selectedSurrender.scheduledIntakeNote} />
                      <DetailValue
                        label="Completed"
                        value={selectedSurrender.completedAt ? formatDateTime(selectedSurrender.completedAt) : ""}
                      />
                      <DetailValue label="Shelter Animal" value={selectedSurrender.shelterAnimalId} />
                    </div>
                  </section>

                  <section className="drawer-section">
                    <h3>Submitter Details</h3>
                    <div className="applicant-contact-card">
                      <div className="applicant-avatar">
                        {(anonymousSurrender ? "A" : selectedSurrender.ownerName || owner.fullName || "O").slice(0, 1)}
                      </div>
                      <div>
                        <strong>
                          {anonymousSurrender ? "Anonymous surrender" : selectedSurrender.ownerName || owner.fullName || "Owner"}
                        </strong>
                        <span>
                          {anonymousSurrender
                            ? "No identifying or contact details collected"
                            : `${selectedSurrender.preferredContactMethod || "Phone"} preferred`}
                        </span>
                      </div>
                    </div>
                    <div className="contact-list">
                      <span>
                        <Mail size={15} />
                        {anonymousSurrender ? "Email not collected" : selectedSurrender.email || owner.email || "No email"}
                      </span>
                      <span>
                        <Phone size={15} />
                        {anonymousSurrender ? "Phone not collected" : selectedSurrender.phone || "No phone"}
                      </span>
                      <span>
                        <ShieldCheck size={15} />
                        {anonymousSurrender
                          ? "No linked user account"
                          : owner.id
                            ? "Linked user account"
                            : "Manual contact details"}
                      </span>
                    </div>
                  </section>

                  <section className="drawer-section">
                    <h3>Request Details</h3>
                    <div className="drawer-info-grid">
                      <DetailValue label="Urgency" value={selectedSurrender.urgency} />
                      <DetailValue label="Status" value={normalizeStatus(selectedSurrender.status)} />
                      <DetailValue label="Submitted" value={formatDateTime(selectedSurrender.createdAt)} />
                      <DetailValue label="Last Updated" value={formatDateTime(selectedSurrender.updatedAt)} />
                      <DetailValue label="Address" value={selectedSurrender.address} />
                    </div>
                  </section>
                </div>

                {fullscreen ? (
                  <div className="drawer-sidebar-content">
                    <section className="drawer-section">
                      <h3>Case Status</h3>
                      <span className={`status-pill ${statusClass(selectedSurrender.status)}`}>
                        {normalizeStatus(selectedSurrender.status)}
                      </span>
                    </section>

                    <section className="drawer-section drawer-actions-card">
                      <h3>Actions</h3>
                      <button
                        className="secondary-button"
                        disabled={busy || selectedSurrender.status !== "SUBMITTED"}
                        onClick={() => onStatusChange(selectedSurrender.id, "CONTACTED")}
                        type="button"
                      >
                        <Phone size={16} />
                        {anonymousSurrender ? "Accept Anonymous Surrender" : "Accept & Request Schedule"}
                      </button>
                      <button
                        className="primary-button"
                        disabled
                        type="button"
                      >
                        <CalendarClock size={16} />
                        {selectedSurrender.status === "INTAKE_SCHEDULED"
                          ? "Scheduled"
                          : anonymousSurrender
                            ? "Anonymous Walk-in"
                            : "Owner Schedules"}
                      </button>
                      <button
                        className="success-button"
                        disabled={busy || selectedSurrender.status === "COMPLETED"}
                        onClick={() => onStatusChange(selectedSurrender.id, "COMPLETED")}
                        type="button"
                      >
                        <CheckCircle2 size={16} />
                        Complete Intake
                      </button>
                      {selectedSurrender.shelterAnimalId && onViewAnimalProfile ? (
                        <button
                          className="secondary-button"
                          onClick={() => onViewAnimalProfile(selectedSurrender.shelterAnimalId)}
                          type="button"
                        >
                          <PawPrint size={16} />
                          Open Shelter Animal
                        </button>
                      ) : null}
                    </section>
                  </div>
                ) : null}
              </div>
            ) : null}

            {detailTab === "pet" ? (
              <div className="drawer-stack">
                <section className="drawer-section">
                  <h3>Pet Profile</h3>
                  <div className="drawer-info-grid">
                    <DetailValue label="Name" value={selectedSurrender.animalName} />
                    <DetailValue label="Type" value={selectedSurrender.animalType} />
                    <DetailValue label="Breed" value={selectedSurrender.breed} />
                    <DetailValue label="Age" value={selectedSurrender.age} />
                    <DetailValue label="Sex" value={selectedSurrender.sex} />
                    <DetailValue label="Colour" value={selectedSurrender.color} />
                    <DetailValue label="Vaccinated" value={selectedSurrender.vaccinated ? "Yes" : "No"} />
                    <DetailValue label="Sterilised" value={selectedSurrender.sterilized ? "Yes" : "No"} />
                    <DetailValue label="Microchipped" value={selectedSurrender.microchipped ? "Yes" : "No"} />
                    <DetailValue label="Photos" value={String(images.length)} />
                  </div>
                </section>
              </div>
            ) : null}

            {detailTab === "notes" ? (
              <div className="drawer-stack">
                <AnswerBlock label="Reason for surrender" value={selectedSurrender.reason} />
                <AnswerBlock label="Health notes" value={selectedSurrender.healthNotes} />
                <AnswerBlock label="Behaviour notes" value={selectedSurrender.behaviorNotes} />
              </div>
            ) : null}

            {!(fullscreen && detailTab === "overview") ? (
              <div className="drawer-actions">
                <button
                  className="secondary-button"
                  disabled={busy || selectedSurrender.status !== "SUBMITTED"}
                  onClick={() => onStatusChange(selectedSurrender.id, "CONTACTED")}
                  type="button"
                >
                  <Phone size={16} />
                  Accept
                </button>
                <button
                  className="primary-button"
                  disabled
                  type="button"
                >
                  <CalendarClock size={16} />
                  {selectedSurrender.status === "INTAKE_SCHEDULED" ? "Scheduled" : "Owner Schedules"}
                </button>
                <button
                  className="success-button"
                  disabled={busy || selectedSurrender.status === "COMPLETED"}
                  onClick={() => onStatusChange(selectedSurrender.id, "COMPLETED")}
                  type="button"
                >
                  <CheckCircle2 size={16} />
                  Complete Intake
                </button>
                {selectedSurrender.shelterAnimalId && onViewAnimalProfile ? (
                  <button
                    className="secondary-button"
                    onClick={() => onViewAnimalProfile(selectedSurrender.shelterAnimalId)}
                    type="button"
                  >
                    <PawPrint size={16} />
                    Open Animal
                  </button>
                ) : null}
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
            <img src={activeImage.dataUri} alt="Surrender request preview" />
          </div>
        </div>
      ) : null}
    </section>
  );
}
