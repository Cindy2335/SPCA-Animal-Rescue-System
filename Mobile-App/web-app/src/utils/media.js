const LOCAL_MEDIA_ORIGIN = import.meta.env.VITE_LOCAL_MEDIA_URL || "http://localhost:3000";

export function resolveMediaUrl(reference) {
  const value = typeof reference === "string" ? reference.trim() : "";
  if (!value) return "";

  const isLocalDashboard =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  if (!isLocalDashboard || value.startsWith("data:") || value.startsWith("blob:")) {
    return value;
  }

  try {
    const url = new URL(value, window.location.origin);
    const isAnimalAsset =
      url.pathname.startsWith("/assets/animals/") ||
      url.pathname === "/assets/cat-dog%20illustration.png" ||
      url.pathname === "/assets/cat-dog illustration.png";
    const isAnimalGallery = /^\/api\/animals\/shelter\/[^/]+\/images\/[^/]+$/.test(url.pathname);

    if (isAnimalAsset) {
      return `${LOCAL_MEDIA_ORIGIN}/api/animals/photo?path=${encodeURIComponent(url.pathname)}`;
    }

    if (isAnimalGallery) {
      return `${LOCAL_MEDIA_ORIGIN}${url.pathname}${url.search}`;
    }
  } catch {
    return value;
  }

  return value;
}

export function normalizeMediaItems(items = []) {
  return items
    .map((item, index) => {
      const source = typeof item === "string" ? item : item?.dataUri || item?.imageUrl || item?.url;
      const dataUri = resolveMediaUrl(source);
      if (!dataUri) return null;
      return typeof item === "string"
        ? { dataUri, id: `media-${index}` }
        : { ...item, dataUri };
    })
    .filter(Boolean);
}

export function getAnimalFallbackUrl(type) {
  const normalizedType = String(type || "").toLowerCase();
  if (normalizedType === "cat") {
    return resolveMediaUrl("/assets/animals/cats/105.jpeg");
  }
  if (normalizedType === "dog") {
    return resolveMediaUrl("/assets/animals/dogs/101.jpeg");
  }
  return resolveMediaUrl("/assets/cat-dog%20illustration.png");
}

export function useImageFallback(event, fallbackUrl) {
  const image = event.currentTarget;
  if (!fallbackUrl || image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.src = fallbackUrl;
}
