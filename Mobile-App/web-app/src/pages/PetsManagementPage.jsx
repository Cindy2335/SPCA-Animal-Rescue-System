import {
  ArrowDownUp,
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Edit3,
  Eye,
  Heart,
  Home,
  Image,
  ImagePlus,
  Layers,
  List,
  Maximize2,
  MessageSquare,
  Minimize2,
  MoreVertical,
  PawPrint,
  Plus,
  RefreshCw,
  Save,
  Tag,
  Trash2,
  X,
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
  { icon: PawPrint, label: "All Animals", value: "ALL" },
  { icon: CheckCircle2, label: "Available", value: "AVAILABLE" },
  { icon: Clock3, label: "Pending Review", value: "PENDING" },
  { icon: Heart, label: "Adopted", value: "ADOPTED" },
];

const typeFilters = ["ALL", "Dog", "Cat", "Other"];

const emptyPetForm = {
  age: "",
  bestFor: "",
  breed: "",
  energy: "",
  imageDataUri: "",
  location: "",
  name: "",
  personality: "",
  sex: "",
  size: "",
  status: "AVAILABLE",
  story: "",
  type: "Dog",
  vaccinated: false,
};

function normalizeStatus(status) {
  return String(status || "AVAILABLE")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status) {
  if (status === "ADOPTED") return "approved";
  if (status === "PENDING") return "pending";
  if (status === "AVAILABLE") return "available";
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

function formatUpdated(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString([], {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}

function parsePersonalityJson(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getPersonality(animal) {
  if (Array.isArray(animal?.personality)) {
    return animal.personality;
  }

  return parsePersonalityJson(animal?.personalityJson);
}

function getAnimalImages(animal) {
  if (!animal) {
    return [];
  }

  if (animal.images?.length) {
    return normalizeMediaItems(animal.images);
  }

  if (animal.imageDataUri) {
    return [{ dataUri: resolveMediaUrl(animal.imageDataUri), id: `${animal.id}-primary` }];
  }

  return [];
}

function animalToForm(animal) {
  return {
    age: animal.age || "",
    bestFor: animal.bestFor || "",
    breed: animal.breed || "",
    energy: animal.energy || "",
    imageDataUri: "",
    location: animal.location || "",
    name: animal.name || "",
    personality: getPersonality(animal).join(", "),
    sex: animal.sex || "",
    size: animal.size || "",
    status: animal.status || "AVAILABLE",
    story: animal.story || "",
    type: animal.type || "Dog",
    vaccinated: Boolean(animal.vaccinated),
  };
}

function formToPayload(form, includeImage) {
  const energyValue = form.energy.trim();
  const bestForValue = form.bestFor.trim();
  const payload = {
    age: form.age.trim(),
    bestFor: includeImage ? bestForValue || "Not specified" : bestForValue,
    breed: form.breed.trim(),
    energy: includeImage ? energyValue || "Not specified" : energyValue,
    name: form.name.trim(),
    location: form.location.trim(),
    personality: form.personality
      .split(",")
      .map((trait) => trait.trim())
      .filter(Boolean),
    sex: form.sex.trim(),
    size: form.size.trim(),
    status: form.status,
    story: form.story.trim(),
    type: form.type,
    vaccinated: form.vaccinated,
  };

  const missingField = Object.entries(payload).find(([field, value]) => {
    if (field === "personality" || field === "vaccinated") return false;
    return typeof value === "string" && !value;
  });

  if (missingField) {
    throw new Error("Fill in the animal profile fields before saving.");
  }

  if (includeImage) {
    const imageDataUri = form.imageDataUri.trim();

    if (!imageDataUri) {
      throw new Error("Add a primary image URL, /assets path, or uploaded image before creating the animal.");
    }

    return { ...payload, imageDataUri, location: form.location.trim() || "SPCA" };
  }

  return payload;
}

function petCode(animal) {
  const digits = String(animal?.id || "").replace(/\D/g, "").slice(-5);

  if (digits) {
    return `ANM-${digits.padStart(5, "0")}`;
  }

  const hash = String(animal?.id || animal?.name || "pet")
    .split("")
    .reduce((sum, letter) => sum + letter.charCodeAt(0), 0);

  return `ANM-${String(hash % 100000).padStart(5, "0")}`;
}

function EmptyState({ loading }) {
  return (
    <article className="panel review-empty-state">
      <span>
        <PawPrint size={24} />
      </span>
      <h2>{loading ? "Loading animal profiles" : "No matching animals"}</h2>
      <p>{loading ? "Fetching animal records." : "Try another filter or search term."}</p>
    </article>
  );
}

function PetField({ children, label }) {
  return (
    <label className="pet-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function DetailValue({ label, value }) {
  return (
    <div className="drawer-info-item">
      <span>{label}</span>
      <strong>{value || "Not provided"}</strong>
    </div>
  );
}

export default function PetsManagementPage({
  animals,
  busyId,
  focusedAnimalId,
  loading,
  onAnimalCreate,
  onAnimalFocusHandled,
  onAnimalUpdate,
  onImageAdd,
  onImageDelete,
  onImagesReorder,
  onRefresh,
  query,
}) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [creating, setCreating] = useState(false);
  const [detailTab, setDetailTab] = useState("profile");
  const [drawerClosed, setDrawerClosed] = useState(true);
  const fullscreen = true;
  const drawerRef = useRef(null);
  const [form, setForm] = useState(emptyPetForm);
  const [formError, setFormError] = useState("");
  const [newImageReference, setNewImageReference] = useState("");
  const [page, setPage] = useState(1);
  const [pendingImageMeta, setPendingImageMeta] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [tableQuery, setTableQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const filteredAnimals = useMemo(() => {
    const searchText = [query, tableQuery].join(" ").trim().toLowerCase();

    return animals.filter((animal) => {
      const haystack = [
        petCode(animal),
        animal.name,
        animal.type,
        animal.breed,
        animal.location,
        animal.sex,
        animal.age,
        animal.status,
        getPersonality(animal).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery = haystack.includes(searchText);
      const matchesStatus = statusFilter === "ALL" || animal.status === statusFilter;
      const matchesType = typeFilter === "ALL" || animal.type === typeFilter;

      return matchesQuery && matchesStatus && matchesType;
    });
  }, [animals, query, statusFilter, tableQuery, typeFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredAnimals.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagedAnimals = filteredAnimals.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selectedAnimal = creating || drawerClosed
    ? null
    : filteredAnimals.find((animal) => animal.id === selectedId) || filteredAnimals[0] || null;
  const selectedAnimalIndex = selectedAnimal
    ? filteredAnimals.findIndex((animal) => animal.id === selectedAnimal.id)
    : -1;
  const images = getAnimalImages(selectedAnimal);
  const activeImage = images[activeImageIndex] || images[0];
  const drawerOpen = creating || Boolean(selectedAnimal);
  useCollapsibleDetailCards(
    drawerRef,
    `${creating ? "new" : selectedAnimal?.id || ""}:${detailTab}`
  );
  const saving = busyId === (creating ? "new-animal" : selectedAnimal?.id);
  const imageBusy = selectedAnimal ? busyId === `${selectedAnimal.id}:images` : false;
  const canGoPrevious = !creating && selectedAnimalIndex > 0;
  const canGoNext = !creating && selectedAnimalIndex >= 0 && selectedAnimalIndex < filteredAnimals.length - 1;

  useEffect(() => {
    if (!focusedAnimalId) {
      return;
    }

    const focusedAnimal = animals.find((animal) => animal.id === focusedAnimalId);

    if (!focusedAnimal) {
      return;
    }

    setCreating(false);
    setDrawerClosed(false);
    setStatusFilter("ALL");
    setTypeFilter("ALL");
    setTableQuery("");
    setSelectedId(focusedAnimal.id);
    setDetailTab("profile");
    onAnimalFocusHandled?.();
  }, [animals, focusedAnimalId]);

  const counts = useMemo(() => {
    return statusFilters.reduce((acc, filter) => {
      acc[filter.value] =
        filter.value === "ALL" ? animals.length : animals.filter((animal) => animal.status === filter.value).length;
      return acc;
    }, {});
  }, [animals]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, tableQuery, typeFilter]);

  useEffect(() => {
    if (creating || drawerClosed) {
      return;
    }

    if (!filteredAnimals.length) {
      setSelectedId("");
      return;
    }

    if (!filteredAnimals.some((animal) => animal.id === selectedId)) {
      setSelectedId(filteredAnimals[0].id);
    }
  }, [creating, drawerClosed, filteredAnimals, selectedId]);

  useEffect(() => {
    setFormError("");
    setNewImageReference("");
    setPendingImageMeta(null);

    if (creating) {
      setForm(emptyPetForm);
      setActiveImageIndex(0);
      setDetailTab("edit");
      return;
    }

    if (selectedAnimal) {
      setForm(animalToForm(selectedAnimal));
      setActiveImageIndex(0);
    }
  }, [creating, selectedAnimal?.id, selectedAnimal?.updatedAt]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleStartCreate() {
    setCreating(true);
    setDrawerClosed(false);
    setSelectedId("");
  }

  function handleSelectAnimal(id) {
    setCreating(false);
    setDrawerClosed(false);
    setSelectedId(id);
    setDetailTab("profile");
  }

  function handleStepAnimal(direction) {
    const nextAnimal = filteredAnimals[selectedAnimalIndex + direction];

    if (!nextAnimal) {
      return;
    }

    handleSelectAnimal(nextAnimal.id);
  }

  function handleCloseDrawer() {
    setCreating(false);
    setDrawerClosed(true);
    setFormError("");
  }

  async function handleSave(event) {
    event.preventDefault();
    setFormError("");

    try {
      const payload = formToPayload(form, creating);
      const savedAnimal = creating ? await onAnimalCreate(payload) : await onAnimalUpdate(selectedAnimal.id, payload);

      if (savedAnimal?.id) {
        setCreating(false);
        setDrawerClosed(false);
        setSelectedId(savedAnimal.id);
        setDetailTab("profile");
      }
    } catch (error) {
      setFormError(error.message);
    }
  }

  function handleDetailTabChange(tab) {
    setDetailTab(tab);

    if (fullscreen) {
      requestAnimationFrame(() => {
        drawerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  async function handleQuickStatus(status) {
    if (!selectedAnimal) {
      return;
    }

    setFormError("");

    try {
      await onAnimalUpdate(selectedAnimal.id, { status });
    } catch (error) {
      setFormError(error.message);
    }
  }

  function handleImageReferenceChange(value) {
    setNewImageReference(value);
    setPendingImageMeta(null);
  }

  function readImageFile(file, callback) {
    const reader = new FileReader();
    reader.onload = () => {
      callback(String(reader.result || ""), {
        fileName: file.name,
        mimeType: file.type || undefined,
      });
    };
    reader.readAsDataURL(file);
  }

  function handleGalleryFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    readImageFile(file, (dataUri, meta) => {
      setNewImageReference(dataUri);
      setPendingImageMeta(meta);
    });
    event.target.value = "";
  }

  function handleCreateFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    readImageFile(file, (dataUri) => {
      updateForm("imageDataUri", dataUri);
    });
    event.target.value = "";
  }

  async function handleAddImage(event) {
    event.preventDefault();

    if (!selectedAnimal) {
      return;
    }

    const dataUri = newImageReference.trim();

    if (!dataUri) {
      setFormError("Choose an image file or paste an image URL first.");
      return;
    }

    setFormError("");

    try {
      await onImageAdd(selectedAnimal.id, {
        dataUri,
        fileName: pendingImageMeta?.fileName,
        mimeType: pendingImageMeta?.mimeType,
      });
      setNewImageReference("");
      setPendingImageMeta(null);
      setActiveImageIndex(images.length);
    } catch (error) {
      setFormError(error.message);
    }
  }

  async function handleMoveImage(direction) {
    if (!selectedAnimal || images.length < 2) {
      return;
    }

    const nextIndex = activeImageIndex + direction;

    if (nextIndex < 0 || nextIndex >= images.length) {
      return;
    }

    const nextIds = images.map((image) => image.id);
    [nextIds[activeImageIndex], nextIds[nextIndex]] = [nextIds[nextIndex], nextIds[activeImageIndex]];
    setFormError("");

    try {
      await onImagesReorder(selectedAnimal.id, nextIds);
      setActiveImageIndex(nextIndex);
    } catch (error) {
      setFormError(error.message);
    }
  }

  async function handleDeleteImage() {
    if (!selectedAnimal || !activeImage?.id || images.length <= 1) {
      return;
    }

    const confirmed = window.confirm(`Remove this photo from ${selectedAnimal.name}'s profile?`);

    if (!confirmed) {
      return;
    }

    setFormError("");

    try {
      await onImageDelete(selectedAnimal.id, activeImage.id);
      setActiveImageIndex(0);
    } catch (error) {
      setFormError(error.message);
    }
  }

  return (
    <section className="admin-dataset-page pets-page">
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
                placeholder="Search animals by name, breed, or ID..."
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
            <label className="dataset-select-field">
              <span>Type</span>
              <select onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
                {typeFilters.map((type) => (
                  <option key={type} value={type}>
                    {type === "ALL" ? "All Types" : type}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="secondary-button"
              onClick={() => {
                setStatusFilter("ALL");
                setTableQuery("");
                setTypeFilter("ALL");
              }}
              type="button"
            >
              Reset
            </button>
            <button className="primary-button dataset-add-button" onClick={handleStartCreate} type="button">
              <Plus size={17} />
              Add New Animal
            </button>
          </div>

          <article className="panel dataset-table-card">
            <div className="dataset-table-wrap">
              <table className="dataset-table">
                <thead>
                  <tr>
                    <th>Animal</th>
                    <th>Type</th>
                    <th>Breed</th>
                    <th>Status</th>
                    <th>Photos</th>
                    <th>Intake Date</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedAnimals.length ? (
                    pagedAnimals.map((animal) => {
                      const animalImages = getAnimalImages(animal);
                      const previewImage = animalImages[0]?.dataUri;
                      const active = selectedAnimal?.id === animal.id && !creating;

                      return (
                        <tr className={active ? "active" : ""} key={animal.id}>
                          <td>
                            <button className="entity-cell entity-cell-button" onClick={() => handleSelectAnimal(animal.id)} type="button">
                              {previewImage ? (
                                <img
                                  src={previewImage}
                                  alt=""
                                  onError={(event) => useImageFallback(event, getAnimalFallbackUrl(animal.type))}
                                />
                              ) : (
                                <span className="entity-fallback">
                                  <PawPrint size={17} />
                                </span>
                              )}
                              <span>
                                <strong>{animal.name || "Animal"}</strong>
                                <small>{petCode(animal)}</small>
                              </span>
                            </button>
                          </td>
                          <td>{animal.type || "Animal"}</td>
                          <td>{animal.breed || "Unknown"}</td>
                          <td>
                            <span className={`status-pill ${statusClass(animal.status)}`}>
                              {normalizeStatus(animal.status)}
                            </span>
                          </td>
                          <td>{animalImages.length}</td>
                          <td>{formatDate(animal.createdAt)}</td>
                          <td>{formatUpdated(animal.updatedAt)}</td>
                          <td>
                            <div className="row-actions">
                              <button className="link-action" onClick={() => handleSelectAnimal(animal.id)} type="button">
                                <Eye size={15} />
                                View
                              </button>
                              <button
                                className="secondary-button compact-button"
                                onClick={() => {
                                  handleSelectAnimal(animal.id);
                                  setDetailTab("edit");
                                }}
                                type="button"
                              >
                                Edit
                              </button>
                              <button aria-label="More actions" className="mini-action" type="button">
                                <MoreVertical size={16} />
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
                Showing {filteredAnimals.length ? (safePage - 1) * PAGE_SIZE + 1 : 0} to{" "}
                {Math.min(safePage * PAGE_SIZE, filteredAnimals.length)} of {filteredAnimals.length} animals
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
                {Array.from({ length: Math.min(3, pageCount) }, (_, index) => index + 1).map((pageNumber) => (
                  <button
                    className={`page-button ${safePage === pageNumber ? "active" : ""}`}
                    key={pageNumber}
                    onClick={() => setPage(pageNumber)}
                    type="button"
                  >
                    {pageNumber}
                  </button>
                ))}
                {pageCount > 3 ? <span className="page-ellipsis">...</span> : null}
                {pageCount > 3 ? (
                  <button
                    className={`page-button ${safePage === pageCount ? "active" : ""}`}
                    onClick={() => setPage(pageCount)}
                    type="button"
                  >
                    {pageCount}
                  </button>
                ) : null}
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
              <button aria-label="Close animal details" className="drawer-close-button" onClick={handleCloseDrawer} type="button">
                <X size={18} />
              </button>
            </div>

            {formError ? <div className="inline-error">{formError}</div> : null}

            <div className="drawer-fullscreen-topbar">
              <nav className="drawer-breadcrumb">
                <span>Animals</span>
                <span className="crumb-sep">/</span>
                <span className="crumb-active">
                  {creating ? "New Animal" : `${selectedAnimal?.name || "Animal"} (${petCode(selectedAnimal)})`}
                </span>
              </nav>
              <div className="drawer-topnav">
                <button
                  className="drawer-topnav-btn"
                  onClick={handleCloseDrawer}
                  type="button"
                >
                  <List size={15} />
                  View Animal List
                </button>
                <span className="drawer-topnav-divider" />
                <button className="drawer-topnav-btn" onClick={() => onRefresh?.()} type="button">
                  <RefreshCw size={15} />
                  Refresh Animal
                </button>
                <span className="drawer-topnav-divider" />
                <button
                  className="drawer-topnav-btn"
                  disabled={!canGoPrevious}
                  onClick={() => handleStepAnimal(-1)}
                  type="button"
                >
                  <ChevronLeft size={15} />
                  Previous
                </button>
                <button
                  className="drawer-topnav-btn"
                  disabled={!canGoNext}
                  onClick={() => handleStepAnimal(1)}
                  type="button"
                >
                  Next
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            <div className="drawer-profile-head">
              <div className="drawer-profile-image">
                {creating ? (
                  form.imageDataUri ? (
                    <img
                      src={form.imageDataUri}
                      alt=""
                      onError={(event) => useImageFallback(event, getAnimalFallbackUrl(form.type))}
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
                      <Camera size={38} />
                    </span>
                  )
                ) : activeImage?.dataUri ? (
                  <img
                    src={activeImage.dataUri}
                    alt=""
                    onError={(event) => useImageFallback(event, getAnimalFallbackUrl(selectedAnimal?.type))}
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
              <div>
                <h2>{creating ? "New Animal" : selectedAnimal?.name || "Animal"}</h2>
                <p>
                  {creating
                    ? "Create an animal profile"
                    : `${selectedAnimal?.type || "Animal"} · ${selectedAnimal?.breed || "Unknown breed"}`}
                </p>
                {!creating ? (
                  <>
                    <span className={`status-pill ${statusClass(selectedAnimal?.status)}`}>
                      {normalizeStatus(selectedAnimal?.status)}
                    </span>
                    <strong className="drawer-code">{petCode(selectedAnimal)}</strong>
                  </>
                ) : null}
                {!creating && selectedAnimal ? (
                  <div className="drawer-stat-row">
                    <div className="drawer-stat-chip">
                      <Calendar size={18} />
                      <div className="drawer-stat-chip-info">
                        <span className="drawer-stat-chip-value">{selectedAnimal.age || "—"}</span>
                        <span className="drawer-stat-chip-label">Age</span>
                      </div>
                    </div>
                    <div className="drawer-stat-chip">
                      <Tag size={18} />
                      <div className="drawer-stat-chip-info">
                        <span className="drawer-stat-chip-value">{selectedAnimal.sex || "—"}</span>
                        <span className="drawer-stat-chip-label">Gender</span>
                      </div>
                    </div>
                    <div className="drawer-stat-chip">
                      <Layers size={18} />
                      <div className="drawer-stat-chip-info">
                        <span className="drawer-stat-chip-value">{selectedAnimal.size || "—"}</span>
                        <span className="drawer-stat-chip-label">Size</span>
                      </div>
                    </div>
                    <div className="drawer-stat-chip">
                      <Home size={18} />
                      <div className="drawer-stat-chip-info">
                        <span className="drawer-stat-chip-value">{selectedAnimal.bestFor || "—"}</span>
                        <span className="drawer-stat-chip-label">Best For</span>
                      </div>
                    </div>
                    <div className="drawer-stat-chip">
                      <Image size={18} />
                      <div className="drawer-stat-chip-info">
                        <span className="drawer-stat-chip-value">{images.length}</span>
                        <span className="drawer-stat-chip-label">Photos</span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {!creating ? (
              <div className="drawer-tabs" role="tablist">
                {["profile", "photos", "edit"].map((tab) => (
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
            ) : null}

            {detailTab === "profile" && selectedAnimal ? (
              <div className="drawer-page-body">
                <div className="drawer-stack">
                  <section className="drawer-section">
                    <div className="drawer-section-header">
                      <h3>Basic Information</h3>
                      {!fullscreen ? (
                        <button className="secondary-button compact-button" onClick={() => setDetailTab("edit")} type="button">
                          <Edit3 size={15} />
                          Edit
                        </button>
                      ) : null}
                    </div>
                    <div className="drawer-info-grid">
                      <DetailValue label="Type" value={selectedAnimal.type} />
                      <DetailValue label="Breed" value={selectedAnimal.breed} />
                      <DetailValue label="Age" value={selectedAnimal.age} />
                      <DetailValue label="Gender" value={selectedAnimal.sex} />
                      <DetailValue label="Size" value={selectedAnimal.size} />
                      <DetailValue label="Energy" value={selectedAnimal.energy} />
                      <DetailValue label="Best For" value={selectedAnimal.bestFor} />
                      <DetailValue label="Location" value={selectedAnimal.location} />
                      <DetailValue label="Personality" value={getPersonality(selectedAnimal).join(", ")} />
                    </div>
                  </section>

                  <section className="drawer-section">
                    <h3>Record Details</h3>
                    <div className="drawer-info-grid">
                      <DetailValue label="Intake Date" value={formatDate(selectedAnimal.createdAt)} />
                      <DetailValue label="Last Updated" value={formatUpdated(selectedAnimal.updatedAt)} />
                      <DetailValue label="Adoption Status" value={normalizeStatus(selectedAnimal.status)} />
                      <DetailValue label="Medical Status" value={selectedAnimal.vaccinated ? "Vaccinated" : "Not vaccinated"} />
                      <DetailValue label="Photos" value={String(images.length)} />
                    </div>
                  </section>

                  {!fullscreen ? (
                    <section className="drawer-section">
                      <h3>Story</h3>
                      <p className="drawer-story">{selectedAnimal.story || "No story has been added yet."}</p>
                    </section>
                  ) : null}
                </div>

                {fullscreen ? (
                  <div className="drawer-sidebar-content">
                    <section className="drawer-section">
                      <h3>
                        <MessageSquare size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                        Story
                      </h3>
                      <p className="drawer-story">{selectedAnimal.story || "No story has been added yet."}</p>
                    </section>

                    <section className="drawer-section drawer-actions-card">
                      <h3>
                        <Zap size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                        Actions
                      </h3>
                      <button className="primary-button" onClick={() => setDetailTab("edit")} type="button">
                        <Edit3 size={16} />
                        Edit Profile
                      </button>
                      <button
                        className="secondary-button"
                        disabled={selectedAnimal.status === "ADOPTED" || saving}
                        onClick={() => handleQuickStatus("ADOPTED")}
                        type="button"
                      >
                        <CheckCircle2 size={16} />
                        Mark as Adopted
                      </button>
                    </section>
                  </div>
                ) : null}

                {!fullscreen ? (
                  <div className="drawer-actions">
                    <button className="primary-button" onClick={() => setDetailTab("edit")} type="button">
                      <Edit3 size={16} />
                      Edit Profile
                    </button>
                    <button
                      className="secondary-button"
                      disabled={selectedAnimal.status === "ADOPTED" || saving}
                      onClick={() => handleQuickStatus("ADOPTED")}
                      type="button"
                    >
                      <CheckCircle2 size={16} />
                      Mark as Adopted
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {detailTab === "photos" && selectedAnimal ? (
              <div className="drawer-stack">
                <section className="drawer-section">
                  <h3>Photo Gallery</h3>
                  <div className="drawer-gallery">
                    {images.map((image, index) => (
                      <button
                        className={index === activeImageIndex ? "active" : ""}
                        key={image.id || index}
                        onClick={() => setActiveImageIndex(index)}
                        type="button"
                      >
                        <img
                          src={image.dataUri}
                          alt=""
                          onError={(event) => useImageFallback(event, getAnimalFallbackUrl(selectedAnimal.type))}
                        />
                        {index === 0 ? <span>Primary</span> : null}
                      </button>
                    ))}
                  </div>
                </section>

                <div className="drawer-actions">
                  <button
                    className="secondary-button"
                    disabled={activeImageIndex <= 0 || imageBusy}
                    onClick={() => handleMoveImage(-1)}
                    type="button"
                  >
                    <ArrowDownUp size={16} />
                    Move Earlier
                  </button>
                  <button
                    className="secondary-button"
                    disabled={activeImageIndex >= images.length - 1 || imageBusy}
                    onClick={() => handleMoveImage(1)}
                    type="button"
                  >
                    <ArrowDownUp size={16} />
                    Move Later
                  </button>
                  <button
                    className="danger-button compact-danger"
                    disabled={images.length <= 1 || imageBusy}
                    onClick={handleDeleteImage}
                    type="button"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>

                <form className="drawer-add-photo-form" onSubmit={handleAddImage}>
                  <label>
                    <span>Add Photo</span>
                    <input
                      onChange={(event) => handleImageReferenceChange(event.target.value)}
                      placeholder="/assets/cat-121b.png or https://..."
                      value={newImageReference.startsWith("data:image/") ? "Uploaded image selected" : newImageReference}
                    />
                  </label>
                  <div className="drawer-actions">
                    <label className="secondary-button pet-file-button">
                      <ImagePlus size={16} />
                      Upload
                      <input accept="image/*" onChange={handleGalleryFileChange} type="file" />
                    </label>
                    <button className="primary-button" disabled={imageBusy} type="submit">
                      <Plus size={16} />
                      Add Photo
                    </button>
                  </div>
                </form>
              </div>
            ) : null}

            {detailTab === "edit" ? (
              <form className="drawer-form" onSubmit={handleSave}>
                <div className="drawer-form-grid">
                  <PetField label="Name">
                    <input onChange={(event) => updateForm("name", event.target.value)} value={form.name} />
                  </PetField>
                  <PetField label="Type">
                    <select onChange={(event) => updateForm("type", event.target.value)} value={form.type}>
                      <option value="Dog">Dog</option>
                      <option value="Cat">Cat</option>
                      <option value="Other">Other</option>
                    </select>
                  </PetField>
                  <PetField label="Status">
                    <select onChange={(event) => updateForm("status", event.target.value)} value={form.status}>
                      <option value="AVAILABLE">Available</option>
                      <option value="PENDING">Pending</option>
                      <option value="ADOPTED">Adopted</option>
                    </select>
                  </PetField>
                  <PetField label="Age">
                    <input onChange={(event) => updateForm("age", event.target.value)} value={form.age} />
                  </PetField>
                  <PetField label="Gender">
                    <input onChange={(event) => updateForm("sex", event.target.value)} value={form.sex} />
                  </PetField>
                  <PetField label="Breed">
                    <input onChange={(event) => updateForm("breed", event.target.value)} value={form.breed} />
                  </PetField>
                  <PetField label="Size">
                    <input onChange={(event) => updateForm("size", event.target.value)} value={form.size} />
                  </PetField>
                  {!creating ? (
                    <>
                      <PetField label="Energy">
                        <input onChange={(event) => updateForm("energy", event.target.value)} value={form.energy} />
                      </PetField>
                      <PetField label="Best For">
                        <input onChange={(event) => updateForm("bestFor", event.target.value)} value={form.bestFor} />
                      </PetField>
                    </>
                  ) : null}
                  <label className="pet-checkbox">
                    <input
                      checked={form.vaccinated}
                      onChange={(event) => updateForm("vaccinated", event.target.checked)}
                      type="checkbox"
                    />
                    <span>Vaccinated</span>
                  </label>
                  {creating ? (
                    <PetField label="Primary Image">
                      <div className="pet-image-input-row">
                        <input
                          onChange={(event) => updateForm("imageDataUri", event.target.value)}
                          placeholder="/assets/cat-121.png or https://..."
                          value={
                            form.imageDataUri.startsWith("data:image/") ? "Uploaded image selected" : form.imageDataUri
                          }
                        />
                        <label className="secondary-button pet-file-button">
                          <ImagePlus size={16} />
                          Upload
                          <input accept="image/*" onChange={handleCreateFileChange} type="file" />
                        </label>
                      </div>
                    </PetField>
                  ) : null}
                </div>

                <PetField label="Personality">
                  <input
                    onChange={(event) => updateForm("personality", event.target.value)}
                    placeholder="Friendly, Gentle, Playful"
                    value={form.personality}
                  />
                </PetField>
                <PetField label="Story">
                  <textarea onChange={(event) => updateForm("story", event.target.value)} rows={5} value={form.story} />
                </PetField>

                <div className="drawer-actions">
                  <button className="primary-button" disabled={saving} type="submit">
                    <Save size={16} />
                    {saving ? "Saving..." : creating ? "Create Animal" : "Save Changes"}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      if (creating) {
                        setCreating(false);
                        setDrawerClosed(true);
                      } else {
                        setDetailTab("profile");
                      }
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
          </aside>
        ) : null}
      </div>
    </section>
  );
}
