const MAX_DIMENSION = 1920;
const VIDEO_BITRATE = 2_000_000;
const AUDIO_BITRATE = 128_000;
const MAX_DURATION_SECONDS = 10;

export class VideoCompressionError extends Error {}

export async function compressVideo(file: File): Promise<File> {
  const video = document.createElement("video");
  video.src = URL.createObjectURL(file);
  video.muted = true;
  video.playsInline = true;

  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = () => reject(new VideoCompressionError("Invalid video"));
  });

  const duration = Math.min(video.duration, MAX_DURATION_SECONDS);
  const { width, height } = getScaledDimensions(
    video.videoWidth,
    video.videoHeight
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const stream = canvas.captureStream(30);

  // Add audio if available
  try {
    const videoElement = video as HTMLVideoElement & {
      captureStream?: () => MediaStream;
      mozCaptureStream?: () => MediaStream;
    };
    const sourceStream =
      videoElement.captureStream?.() || videoElement.mozCaptureStream?.();
    if (sourceStream) {
      sourceStream.getAudioTracks().forEach((track) => stream.addTrack(track));
    }
  } catch {
    // No audio, continue
  }

  const mimeType = getSupportedMimeType();
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: VIDEO_BITRATE,
    audioBitsPerSecond: AUDIO_BITRATE,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const result = new Promise<File>((resolve, reject) => {
    recorder.onstop = () => {
      if (chunks.length === 0) {
        reject(new VideoCompressionError("Compression failed"));
        return;
      }
      const blob = new Blob(chunks, { type: mimeType });
      const extension = mimeType.includes("webm") ? "webm" : "mp4";
      resolve(
        new File([blob], file.name.replace(/\.[^.]+$/, `.${extension}`), {
          type: mimeType,
        })
      );
    };
    recorder.onerror = () =>
      reject(new VideoCompressionError("Encoding failed"));
  });

  recorder.start();

  const drawFrame = () => {
    ctx.drawImage(video, 0, 0, width, height);
    if (video.currentTime < duration && !video.paused && !video.ended) {
      requestAnimationFrame(drawFrame);
    } else {
      recorder.stop();
      video.pause();
      URL.revokeObjectURL(video.src);
    }
  };

  video.ontimeupdate = () => {
    if (video.currentTime >= duration) {
      video.pause();
    }
  };

  await video.play();
  drawFrame();

  return result;
}

function getScaledDimensions(
  width: number,
  height: number
): { width: number; height: number } {
  if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
    return { width, height };
  }
  const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
  return {
    width: Math.floor(width * scale),
    height: Math.floor(height * scale),
  };
}

function getSupportedMimeType(): string {
  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "video/webm";
}
