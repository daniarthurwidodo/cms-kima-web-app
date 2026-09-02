const PICSUM_BASE = "https://picsum.photos";
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;

export type ImageSize = { width?: number; height?: number };

// ponytail: picsum.photos is keyless + deterministic-by-seed. Upgrade to
// official Unsplash API (with UNSPLASH_ACCESS_KEY) if real topic/query
// support is needed — picsum ignores topic entirely.
export function getSeededImageUrl(seed: string, size: ImageSize = {}): string {
  if (!seed) throw new Error("getSeededImageUrl: seed is required");
  const width = size.width ?? DEFAULT_WIDTH;
  const height = size.height ?? DEFAULT_HEIGHT;
  const safeSeed = encodeURIComponent(seed);
  return `${PICSUM_BASE}/seed/${safeSeed}/${width}/${height}`;
}
