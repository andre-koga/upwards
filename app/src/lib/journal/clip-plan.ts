/**
 * The canonical stored format for a daily clip (product-scope.md §2.5):
 * H.264 video + AAC audio in an MP4, fixed frame rate, normalised size,
 * orientation preserved. One format means clips recorded on any browser can be
 * played everywhere and, later, joined into a month compilation.
 */
export const CLIP_MAX_SECONDS = 10;
/** Longest edge, in pixels. Phone clips are 1080p or 4K; 1080 is plenty here. */
export const CLIP_MAX_LONG_EDGE = 1920;
export const CLIP_FRAME_RATE = 30;
/** Keyframe every second keeps seeking quick, which compilation relies on. */
export const CLIP_KEYFRAME_SECONDS = 1;

export interface ClipSourceInfo {
  /** Display size in pixels, after rotation metadata has been applied. */
  width: number;
  height: number;
  durationSeconds: number;
  hasAudio: boolean;
}

export interface ClipCapabilities {
  /** The browser can encode H.264 at the planned size. */
  h264: boolean;
  /** The browser can encode AAC. */
  aac: boolean;
}

export interface ClipPlan {
  width: number;
  height: number;
  /** Seconds kept from the start of the source. */
  trimEnd: number;
  /** True when the source was longer than the cap and is being cut. */
  trimmed: boolean;
  keepAudio: boolean;
  /** Set when audio was wanted but cannot be encoded, so the clip is silent. */
  audioDropped: boolean;
}

export class ClipPlanError extends Error {
  readonly code: "no_video" | "no_h264" | "invalid_source";
  constructor(code: ClipPlanError["code"], message: string) {
    super(message);
    this.name = "ClipPlanError";
    this.code = code;
  }
}

/** H.264 needs even dimensions, so round down to the nearest even number. */
const even = (value: number) => Math.max(2, Math.floor(value / 2) * 2);

/**
 * Scale so the longest edge fits `CLIP_MAX_LONG_EDGE`, never upscaling, keeping
 * the aspect ratio and landing on even numbers.
 */
export function planClipSize(
  width: number,
  height: number
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  const scale =
    longEdge > CLIP_MAX_LONG_EDGE ? CLIP_MAX_LONG_EDGE / longEdge : 1;
  return { width: even(width * scale), height: even(height * scale) };
}

/**
 * Decide what to produce from what the source has and what the browser can
 * encode. Pure, so every fallback is testable without a browser.
 *
 * - No H.264 encoder: fail clearly. A different codec would break the "one
 *   format everywhere" rule, so we refuse rather than store something else.
 * - No AAC encoder: keep the video and drop the sound. The spec says
 *   compilation falls back to silent output rather than failing, and a silent
 *   clip is better than no clip.
 */
export function planClip(
  source: ClipSourceInfo,
  capabilities: ClipCapabilities
): ClipPlan {
  const valid = (n: number) => Number.isFinite(n) && n > 0;
  if (!valid(source.width) || !valid(source.height)) {
    throw new ClipPlanError("no_video", "The file has no video track.");
  }
  if (!valid(source.durationSeconds)) {
    throw new ClipPlanError("invalid_source", "The video has no length.");
  }
  if (!capabilities.h264) {
    throw new ClipPlanError(
      "no_h264",
      "This browser can't encode H.264 video."
    );
  }

  const { width, height } = planClipSize(source.width, source.height);
  const trimmed = source.durationSeconds > CLIP_MAX_SECONDS;
  const wantsAudio = source.hasAudio;

  return {
    width,
    height,
    trimEnd: Math.min(source.durationSeconds, CLIP_MAX_SECONDS),
    trimmed,
    keepAudio: wantsAudio && capabilities.aac,
    audioDropped: wantsAudio && !capabilities.aac,
  };
}
