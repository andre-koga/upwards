import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  UnsupportedInputFormatError,
  canEncodeAudio,
  canEncodeVideo,
} from "mediabunny";
import {
  CLIP_FRAME_RATE,
  CLIP_KEYFRAME_SECONDS,
  ClipPlanError,
  planClip,
  planClipSize,
  type ClipPlan,
} from "./clip-plan";
import { VideoCompressionError } from "./video-compression-error";

export interface ClipEncodeResult {
  file: File;
  plan: ClipPlan;
  /** Wall-clock time the encode took, for the device spike. */
  elapsedMs: number;
}

export interface ClipEncodeOptions {
  /** 0..1 as the clip is converted. */
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

/** The browser exposes WebCodecs; without it no clip can be produced. */
export function isClipEncodingSupported(): boolean {
  return (
    typeof VideoEncoder !== "undefined" &&
    typeof VideoDecoder !== "undefined" &&
    typeof AudioEncoder !== "undefined"
  );
}

export const toCompressionError = (error: unknown): VideoCompressionError => {
  if (error instanceof ClipPlanError) {
    const code =
      error.code === "invalid_source"
        ? "empty"
        : error.code === "no_h264"
          ? "no_h264"
          : "no_video";
    return new VideoCompressionError(code, error.message);
  }
  // Mediabunny throws this when the file is not a video container at all.
  if (error instanceof UnsupportedInputFormatError) {
    return new VideoCompressionError("no_video", "That is not a video file.");
  }
  return new VideoCompressionError("failed", "Failed to process video.");
};

/**
 * Convert a picked video into the canonical daily clip: H.264 + AAC in an MP4,
 * 30 fps, at most 10 seconds, longest edge 1920, orientation preserved.
 *
 * Runs on the browser's own encoders (WebCodecs), so it is not tied to real
 * time and gives the same container on every browser.
 */
export async function compressVideo(
  file: File,
  options: ClipEncodeOptions = {}
): Promise<File> {
  return (await encodeClip(file, options)).file;
}

/** Same as {@link compressVideo}, plus what was decided and how long it took. */
export async function encodeClip(
  file: File,
  options: ClipEncodeOptions = {}
): Promise<ClipEncodeResult> {
  if (!isClipEncodingSupported()) {
    throw new VideoCompressionError(
      "unsupported",
      "This browser can't make daily clips."
    );
  }

  const started = performance.now();
  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  });

  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) {
      throw new ClipPlanError("no_video", "The file has no video track.");
    }
    const audioTrack = await input.getPrimaryAudioTrack();
    const durationSeconds = await input.computeDuration();

    const size = planClipSize(
      videoTrack.displayWidth,
      videoTrack.displayHeight
    );
    const [h264, aac] = await Promise.all([
      canEncodeVideo("avc", { width: size.width, height: size.height }),
      canEncodeAudio("aac"),
    ]);

    const plan = planClip(
      {
        width: videoTrack.displayWidth,
        height: videoTrack.displayHeight,
        durationSeconds,
        hasAudio: audioTrack !== null,
      },
      { h264, aac }
    );

    const target = new BufferTarget();
    const output = new Output({
      // Metadata first, so a clip starts playing before it has fully loaded.
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target,
    });

    const conversion = await Conversion.init({
      input,
      output,
      trim: { start: 0, end: plan.trimEnd },
      video: {
        codec: "avc",
        width: plan.width,
        height: plan.height,
        fit: "contain",
        frameRate: CLIP_FRAME_RATE,
        keyFrameInterval: CLIP_KEYFRAME_SECONDS,
        quality: QUALITY_HIGH,
      },
      audio: plan.keepAudio ? { codec: "aac" } : { discard: true },
      showWarnings: false,
    });

    if (!conversion.isValid) {
      throw new VideoCompressionError(
        "convert",
        "That video can't be converted."
      );
    }

    if (options.onProgress) conversion.onProgress = options.onProgress;
    options.signal?.addEventListener("abort", () => void conversion.cancel(), {
      once: true,
    });

    await conversion.execute();

    if (!target.buffer || target.buffer.byteLength === 0) {
      throw new VideoCompressionError("failed", "Compression failed");
    }

    const name = file.name.replace(/\.[^.]+$/, "") || "clip";
    return {
      file: new File([target.buffer], `${name}.mp4`, { type: "video/mp4" }),
      plan,
      elapsedMs: performance.now() - started,
    };
  } catch (error) {
    if (error instanceof VideoCompressionError) throw error;
    throw toCompressionError(error);
  } finally {
    input.dispose();
  }
}
