import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  VideoSampleSink,
} from "mediabunny";
import { CLIP_FRAME_RATE, CLIP_KEYFRAME_SECONDS } from "./clip-plan";
import { VideoCompressionError } from "./video-compression-error";

export interface CompileOptions {
  /** Seconds taken from each clip. Default 1, as in "1 Second Everyday". */
  segmentSeconds?: number;
  /** Where in each clip the segment starts, in seconds. Default 0. */
  startSeconds?: number;
  /** Output size. Every segment is fitted into it, so portrait and landscape can mix. */
  width?: number;
  height?: number;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export interface CompileResult {
  blob: Blob;
  clipsUsed: number;
  clipsSkipped: number;
  seconds: number;
  elapsedMs: number;
}

/**
 * Join a short segment from each clip into one video, entirely on this device.
 * The result is never uploaded, so a compilation costs no storage and can be
 * regenerated whenever the clips change.
 *
 * Video only for now: sound from sixty one-second slices is not meaningful, and
 * the spike in product-scope.md §2.5 is about whether the join survives on a
 * phone. A clip that cannot be read is skipped and counted, not fatal.
 */
export async function compileClips(
  clips: Blob[],
  options: CompileOptions = {}
): Promise<CompileResult> {
  if (clips.length === 0) {
    throw new VideoCompressionError("failed", "There are no clips to join.");
  }
  const segment = options.segmentSeconds ?? 1;
  const start = options.startSeconds ?? 0;
  const width = options.width ?? 1080;
  const height = options.height ?? 1920;
  const frameDuration = 1 / CLIP_FRAME_RATE;
  const startedAt = performance.now();

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new VideoCompressionError("failed", "Drawing is not available.");

  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target,
  });
  const source = new CanvasSource(canvas, {
    codec: "avc",
    quality: QUALITY_HIGH,
    keyFrameInterval: CLIP_KEYFRAME_SECONDS,
  });
  output.addVideoTrack(source, { frameRate: CLIP_FRAME_RATE });
  await output.start();

  let cursor = 0;
  let used = 0;
  let skipped = 0;

  try {
    for (let i = 0; i < clips.length; i += 1) {
      if (options.signal?.aborted) {
        throw new VideoCompressionError("failed", "Cancelled.");
      }
      const input = new Input({
        source: new BlobSource(clips[i]),
        formats: ALL_FORMATS,
      });
      try {
        const track = await input.getPrimaryVideoTrack();
        if (!track || !(await track.canDecode())) {
          skipped += 1;
          continue;
        }
        const sink = new VideoSampleSink(track);
        let wrote = 0;
        let base: number | null = null;
        let covered = 0;
        for await (const sample of sink.samples(start, start + segment)) {
          // Keep each frame's own timing, shifted onto one continuous timeline,
          // so clips that were not recorded at 30 fps do not play in slow motion.
          base ??= sample.timestamp;
          const offset = sample.timestamp - base;
          const duration =
            sample.duration > 0 ? sample.duration : frameDuration;
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, width, height);
          sample.drawWithFit(ctx, { fit: "contain" });
          sample.close();
          await source.add(cursor + offset, duration);
          covered = offset + duration;
          wrote += 1;
        }
        if (wrote === 0) {
          skipped += 1;
        } else {
          cursor += covered;
          used += 1;
        }
      } finally {
        input.dispose();
      }
      options.onProgress?.(i + 1, clips.length);
    }

    if (used === 0) {
      throw new VideoCompressionError(
        "failed",
        "None of the clips could be read."
      );
    }
    source.close();
    await output.finalize();
  } catch (error) {
    await output.cancel().catch(() => undefined);
    if (error instanceof VideoCompressionError) throw error;
    throw new VideoCompressionError("failed", "Failed to join the clips.");
  }

  if (!target.buffer)
    throw new VideoCompressionError("failed", "Joining failed.");
  return {
    blob: new Blob([target.buffer], { type: "video/mp4" }),
    clipsUsed: used,
    clipsSkipped: skipped,
    seconds: cursor,
    elapsedMs: performance.now() - startedAt,
  };
}
