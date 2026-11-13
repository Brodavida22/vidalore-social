const prefetchedUrls = new Set<string>();
const MAX_PREFETCHED_TRACKED = 60;

/**
 * Lightweight video URL prefetching using <link rel="preload" as="video"> / <link rel="prefetch">.
 * Avoids downloading entire files simultaneously while warming DNS, TLS, and initial chunks
 * for upcoming videos (e.g. next Reel or hovered profile Reel).
 */
export function prefetchVideoUrl(url?: string | null): void {
  if (typeof document === "undefined" || !url || !url.startsWith("http")) return;
  if (prefetchedUrls.has(url)) return;

  if (prefetchedUrls.size >= MAX_PREFETCHED_TRACKED) {
    const oldest = prefetchedUrls.values().next().value;
    if (oldest) prefetchedUrls.delete(oldest);
  }
  prefetchedUrls.add(url);

  try {
    const existing = document.head.querySelector(
      `link[data-vidalore-video-prefetch="${CSS.escape(url)}"]`,
    );
    if (existing) return;

    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "video";
    link.href = url;
    link.crossOrigin = "anonymous";
    link.setAttribute("data-vidalore-video-prefetch", url);
    document.head.appendChild(link);
  } catch {
    // Ignore DOM / CSS.escape edge cases
  }
}

export function __clearPrefetchedVideoUrlsForTests(): void {
  prefetchedUrls.clear();
}
