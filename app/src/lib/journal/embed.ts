/** Max stored length for a journal embed URL or extracted iframe src. */
export const JOURNAL_EMBED_URL_LIMIT = 500;

export type JournalEmbedProvider =
  | "spotify"
  | "youtube"
  | "soundcloud"
  | "vimeo"
  | "apple-music";

export type JournalEmbedLayout =
  | { kind: "compact"; height: number }
  | { kind: "video" }
  | { kind: "tall"; height: number };

export interface JournalEmbed {
  provider: JournalEmbedProvider;
  embedSrc: string;
  layout: JournalEmbedLayout;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const SPOTIFY_ID = /^[A-Za-z0-9]{10,32}$/;
const VIMEO_ID = /^\d{6,12}$/;
const SPOTIFY_TYPES = [
  "track",
  "album",
  "playlist",
  "episode",
  "show",
  "artist",
] as const;
const IFRAME_SRC_RE = /<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i;
const SPOTIFY_URI_RE =
  /^spotify:(track|album|playlist|episode|show|artist):([A-Za-z0-9]+)$/i;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function hostnameOf(url: URL): string {
  return url.hostname
    .replace(/^www\./, "")
    .replace(/^m\./, "")
    .toLowerCase();
}

function parseHttpsUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.protocol === "http:") url.protocol = "https:";
    return url;
  } catch {
    return null;
  }
}

function isSpotifyType(value: string): value is (typeof SPOTIFY_TYPES)[number] {
  return (SPOTIFY_TYPES as readonly string[]).includes(value);
}

function spotifyEmbed(
  type: (typeof SPOTIFY_TYPES)[number],
  id: string
): JournalEmbed | null {
  if (!SPOTIFY_ID.test(id)) return null;
  const compact = type === "track" || type === "episode";
  return {
    provider: "spotify",
    embedSrc: `https://open.spotify.com/embed/${type}/${id}`,
    layout: compact
      ? { kind: "compact", height: 152 }
      : { kind: "tall", height: 352 },
  };
}

function parseSpotify(url: URL): JournalEmbed | null {
  const host = hostnameOf(url);
  if (host !== "open.spotify.com" && host !== "play.spotify.com") return null;
  const match = url.pathname.match(
    /^(?:\/embed)?(?:\/intl-[a-z]{2})?\/(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/i
  );
  if (!match) return null;
  const type = match[1]!.toLowerCase();
  if (!isSpotifyType(type)) return null;
  return spotifyEmbed(type, match[2]!);
}

function parseSpotifyUri(raw: string): JournalEmbed | null {
  const match = raw.trim().match(SPOTIFY_URI_RE);
  if (!match) return null;
  const type = match[1]!.toLowerCase();
  if (!isSpotifyType(type)) return null;
  return spotifyEmbed(type, match[2]!);
}

function parseYoutube(url: URL): JournalEmbed | null {
  const host = hostnameOf(url);
  let id: string | undefined;
  if (host === "youtu.be") {
    id = url.pathname.split("/").filter(Boolean)[0];
  } else if (
    host === "youtube.com" ||
    host === "youtube-nocookie.com" ||
    host === "music.youtube.com"
  ) {
    const fromQuery = url.searchParams.get("v");
    if (fromQuery) {
      id = fromQuery;
    } else {
      const parts = url.pathname.split("/").filter(Boolean);
      if (
        parts[0] === "embed" ||
        parts[0] === "shorts" ||
        parts[0] === "live"
      ) {
        id = parts[1];
      }
    }
  } else {
    return null;
  }
  if (!id || !YOUTUBE_ID.test(id)) return null;
  return {
    provider: "youtube",
    embedSrc: `https://www.youtube-nocookie.com/embed/${id}`,
    layout: { kind: "video" },
  };
}

function parseVimeo(url: URL): JournalEmbed | null {
  const host = hostnameOf(url);
  let id: string | undefined;
  if (host === "vimeo.com") {
    id = url.pathname.split("/").filter(Boolean)[0];
  } else if (host === "player.vimeo.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "video") id = parts[1];
  } else {
    return null;
  }
  if (!id || !VIMEO_ID.test(id)) return null;
  return {
    provider: "vimeo",
    embedSrc: `https://player.vimeo.com/video/${id}`,
    layout: { kind: "video" },
  };
}

function parseSoundcloud(url: URL): JournalEmbed | null {
  const host = hostnameOf(url);
  if (host === "w.soundcloud.com") {
    if (url.pathname.replace(/\/+$/, "") !== "/player") return null;
    const target = url.searchParams.get("url");
    if (!target) return null;
    const targetUrl = parseHttpsUrl(target);
    if (!targetUrl || hostnameOf(targetUrl) !== "soundcloud.com") return null;
    return {
      provider: "soundcloud",
      embedSrc: `https://w.soundcloud.com/player/?url=${encodeURIComponent(`https://soundcloud.com${targetUrl.pathname}`)}&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`,
      layout: { kind: "compact", height: 166 },
    };
  }
  if (host !== "soundcloud.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const path = `/${parts.join("/")}`;
  return {
    provider: "soundcloud",
    embedSrc: `https://w.soundcloud.com/player/?url=${encodeURIComponent(`https://soundcloud.com${path}`)}&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`,
    layout: { kind: "compact", height: 166 },
  };
}

function parseAppleMusic(url: URL): JournalEmbed | null {
  const host = hostnameOf(url);
  if (host !== "music.apple.com" && host !== "embed.music.apple.com") {
    return null;
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const kind = parts[1];
  if (kind !== "album" && kind !== "song" && kind !== "playlist") return null;
  const search = url.searchParams.toString();
  const path = `/${parts.join("/")}`;
  const compact = kind === "song";
  return {
    provider: "apple-music",
    embedSrc: `https://embed.music.apple.com${path}${search ? `?${search}` : ""}`,
    layout: compact
      ? { kind: "compact", height: 175 }
      : { kind: "tall", height: 450 },
  };
}

/**
 * Accept a pasted share URL, Spotify URI, or iframe embed snippet and store a
 * trimmed URL (never raw HTML).
 */
export function normalizeJournalEmbedInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const iframeMatch = trimmed.match(IFRAME_SRC_RE);
  const extracted = iframeMatch
    ? decodeHtmlEntities(iframeMatch[1] ?? "")
    : trimmed;
  return extracted.trim().slice(0, JOURNAL_EMBED_URL_LIMIT);
}

/** Convert a stored journal embed value into a safe, allowlisted iframe src. */
export function parseJournalEmbed(
  raw: string | null | undefined
): JournalEmbed | null {
  const normalized = normalizeJournalEmbedInput(raw ?? "");
  if (!normalized) return null;

  const fromUri = parseSpotifyUri(normalized);
  if (fromUri) return fromUri;

  const url = parseHttpsUrl(normalized);
  if (!url) return null;

  return (
    parseSpotify(url) ??
    parseYoutube(url) ??
    parseVimeo(url) ??
    parseSoundcloud(url) ??
    parseAppleMusic(url)
  );
}

export function journalEmbedInputLooksSet(
  raw: string | null | undefined
): boolean {
  return normalizeJournalEmbedInput(raw ?? "").length > 0;
}
