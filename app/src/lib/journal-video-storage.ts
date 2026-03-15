/**
 * SRP: Handles compression, upload, and storage of journal videos to Supabase.
 */
import {
  supabase,
  isSupabaseConfigured,
  getCachedUserId,
} from "@/lib/supabase";

const JOURNAL_VIDEO_BUCKET = "journal-videos";
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB
const MAX_DIMENSION = 1280;
const MIN_VIDEO_BITRATE = 150_000;
const MAX_VIDEO_BITRATE = 5_000_000;
const FALLBACK_AUDIO_BITRATE = 96_000;
const COMPRESSION_HEADROOM = 0.92;
const BITRATE_ATTEMPT_FACTORS = [0.95, 0.75, 0.55];

export class JournalVideoUploadError extends Error {}

export async function uploadJournalVideo(
  file: File,
  entryDate: string
): Promise<string> {
  if (!isSupabaseConfigured || !supabase) {
    throw new JournalVideoUploadError(
      "Cloud sync is not configured. Connect Supabase in Settings to upload videos."
    );
  }

  const userId = getCachedUserId();
  if (!userId) {
    throw new JournalVideoUploadError(
      "You need to be signed in to upload videos."
    );
  }

  const fileToUpload =
    file.size > MAX_VIDEO_BYTES
      ? await compressVideoForUpload(file, MAX_VIDEO_BYTES)
      : file;

  const safeName = fileToUpload.name.replace(/[^\w.-]/g, "_").toLowerCase();
  const timestamp = Date.now();
  const path = `${userId}/${entryDate}/${timestamp}-${safeName}`;

  const { data, error } = await supabase.storage
    .from(JOURNAL_VIDEO_BUCKET)
    .upload(path, fileToUpload, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error || !data) {
    throw new JournalVideoUploadError(
      error?.message ?? "Failed to upload video."
    );
  }

  const { data: publicUrl } = supabase.storage
    .from(JOURNAL_VIDEO_BUCKET)
    .getPublicUrl(data.path);

  if (!publicUrl?.publicUrl) {
    throw new JournalVideoUploadError(
      "Could not generate public URL for uploaded video."
    );
  }

  return publicUrl.publicUrl;
}

async function compressVideoForUpload(
  file: File,
  maxBytes: number
): Promise<File> {
  if (!supportsVideoCompression()) {
    throw new JournalVideoUploadError(
      "Video is too large (max 50MB), and this browser cannot compress videos automatically."
    );
  }

  const duration = await getVideoDuration(file);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new JournalVideoUploadError(
      "Could not read video metadata for compression."
    );
  }

  const outputMimeType = getSupportedRecorderMimeType();
  const targetTotalBitrate = Math.max(
    MIN_VIDEO_BITRATE + FALLBACK_AUDIO_BITRATE,
    Math.floor((maxBytes * 8 * COMPRESSION_HEADROOM) / duration)
  );

  let bestResult: File | null = null;
  for (const factor of BITRATE_ATTEMPT_FACTORS) {
    const targetBitrate = clamp(
      Math.floor(targetTotalBitrate * factor),
      MIN_VIDEO_BITRATE,
      MAX_VIDEO_BITRATE
    );
    const audioBitrate = Math.min(FALLBACK_AUDIO_BITRATE, targetBitrate / 4);
    const videoBitrate = Math.max(
      MIN_VIDEO_BITRATE,
      targetBitrate - audioBitrate
    );

    try {
      const compressed = await transcodeWithMediaRecorder(file, {
        mimeType: outputMimeType,
        videoBitsPerSecond: Math.floor(videoBitrate),
        audioBitsPerSecond: Math.floor(audioBitrate),
      });

      if (!bestResult || compressed.size < bestResult.size) {
        bestResult = compressed;
      }

      if (compressed.size <= maxBytes) {
        return compressed;
      }
    } catch {
      // Continue to lower-quality attempts if an encoder setting fails.
    }
  }

  if (bestResult && bestResult.size <= maxBytes) {
    return bestResult;
  }

  throw new JournalVideoUploadError(
    "Video is too large (max 50MB) and could not be compressed enough automatically."
  );
}

function supportsVideoCompression(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined"
  );
}

function getSupportedRecorderMimeType(): string {
  const preferredMimeTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];

  for (const mimeType of preferredMimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return "";
}

async function getVideoDuration(file: File): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = objectUrl;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.src = "";
    };

    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();
      resolve(duration);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Could not load video metadata."));
    };
  });
}

interface TranscodeOptions {
  mimeType: string;
  videoBitsPerSecond: number;
  audioBitsPerSecond: number;
}

interface VideoCaptureStreamElement extends HTMLVideoElement {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
}

async function transcodeWithMediaRecorder(
  file: File,
  options: TranscodeOptions
): Promise<File> {
  return await new Promise<File>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = objectUrl;
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    let animationFrameId: number | null = null;
    let recorder: MediaRecorder | null = null;
    let stream: MediaStream | null = null;

    const cleanup = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }

      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      video.pause();
      video.src = "";
      URL.revokeObjectURL(objectUrl);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Could not decode video for compression."));
    };

    video.onloadedmetadata = async () => {
      const { width, height } = getScaledDimensions(
        video.videoWidth || 1280,
        video.videoHeight || 720
      );
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");

      if (!context) {
        cleanup();
        reject(new Error("Could not create compression canvas."));
        return;
      }

      stream = canvas.captureStream(30);
      if (!stream) {
        cleanup();
        reject(new Error("Could not create compression stream."));
        return;
      }

      try {
        const sourceVideo = video as VideoCaptureStreamElement;
        const sourceStream =
          sourceVideo.captureStream?.() ?? sourceVideo.mozCaptureStream?.();
        if (sourceStream) {
          sourceStream
            .getAudioTracks()
            .forEach((track: MediaStreamTrack) => stream?.addTrack(track));
        }
      } catch {
        // Audio capture may fail in some browsers; continue with video-only output.
      }

      const recorderOptions: MediaRecorderOptions = {
        videoBitsPerSecond: options.videoBitsPerSecond,
        audioBitsPerSecond: options.audioBitsPerSecond,
      };
      if (options.mimeType) {
        recorderOptions.mimeType = options.mimeType;
      }

      try {
        recorder = new MediaRecorder(stream, recorderOptions);
      } catch {
        cleanup();
        reject(new Error("Could not initialize video compressor."));
        return;
      }

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      recorder.onerror = () => {
        cleanup();
        reject(new Error("Video compression failed."));
      };
      recorder.onstop = () => {
        const extension = options.mimeType.includes("webm") ? "webm" : "mp4";
        const outputName = replaceFileExtension(file.name, extension);
        const output = new File(chunks, outputName, {
          type: options.mimeType || "video/webm",
        });
        cleanup();
        resolve(output);
      };

      const drawFrame = () => {
        context.drawImage(video, 0, 0, width, height);
        if (!video.paused && !video.ended) {
          animationFrameId = requestAnimationFrame(drawFrame);
        }
      };

      video.onended = () => {
        if (recorder && recorder.state !== "inactive") {
          recorder.stop();
        }
      };

      recorder.start(1000);
      drawFrame();

      try {
        await video.play();
      } catch {
        cleanup();
        reject(new Error("Could not start video playback for compression."));
      }
    };
  });
}

function getScaledDimensions(
  width: number,
  height: number
): {
  width: number;
  height: number;
} {
  if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
    return { width, height };
  }

  const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
  return {
    width: Math.max(2, Math.floor(width * scale)),
    height: Math.max(2, Math.floor(height * scale)),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function replaceFileExtension(fileName: string, extension: string): string {
  const lastDot = fileName.lastIndexOf(".");
  const baseName = lastDot === -1 ? fileName : fileName.slice(0, lastDot);
  return `${baseName}.${extension}`;
}
