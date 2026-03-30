import { useEffect, useState } from "react";

const SEEK_FRACTIONS = [0.08, 0.18, 0.3, 0.45];

function isLikelyBlackThumbnail(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): boolean {
  const stepX = Math.max(1, Math.floor(width / 24));
  const stepY = Math.max(1, Math.floor(height / 14));
  const sampleWidth = Math.max(1, Math.floor(width / stepX));
  const sampleHeight = Math.max(1, Math.floor(height / stepY));

  try {
    const imageData = ctx.getImageData(0, 0, width, height).data;
    let brightnessTotal = 0;
    let samples = 0;

    for (let y = 0; y < sampleHeight; y += 1) {
      for (let x = 0; x < sampleWidth; x += 1) {
        const pixelX = Math.min(width - 1, x * stepX);
        const pixelY = Math.min(height - 1, y * stepY);
        const index = (pixelY * width + pixelX) * 4;
        const r = imageData[index];
        const g = imageData[index + 1];
        const b = imageData[index + 2];
        brightnessTotal += (r + g + b) / 3;
        samples += 1;
      }
    }

    const avgBrightness = samples > 0 ? brightnessTotal / samples : 0;
    return avgBrightness < 12;
  } catch {
    return false;
  }
}

export interface UseDirectVideoThumbnailParams {
  hasDirectVideo: boolean;
  storedThumbnail: string | null;
  videoUrlForThumb: string;
  onThumbnailGenerated?: (dataUrl: string | null) => void;
}

export interface UseDirectVideoThumbnailResult {
  directVideoThumb: string | null;
  directVideoThumbError: string | null;
  setForceThumbnailRegeneration: (v: boolean) => void;
  setDirectVideoThumb: (v: string | null) => void;
  setDirectVideoThumbError: (v: string | null) => void;
}

export function useDirectVideoThumbnail({
  hasDirectVideo,
  storedThumbnail,
  videoUrlForThumb,
  onThumbnailGenerated,
}: UseDirectVideoThumbnailParams): UseDirectVideoThumbnailResult {
  const [directVideoThumb, setDirectVideoThumb] = useState<string | null>(null);
  const [directVideoThumbError, setDirectVideoThumbError] = useState<
    string | null
  >(null);
  const [forceRegen, setForceThumbnailRegeneration] = useState(false);

  useEffect(() => {
    if (!hasDirectVideo) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- reset when video source is removed */
      setDirectVideoThumb(null);
      setDirectVideoThumbError(null);
      setForceThumbnailRegeneration(false);
      return;
    }

    if (storedThumbnail && !forceRegen) {
      setDirectVideoThumb(storedThumbnail);
      setDirectVideoThumbError(null);
      return;
    }

    let cancelled = false;
    let hasCaptured = false;
    let seekAttempt = 0;
    const video = document.createElement("video");
    video.src = videoUrlForThumb;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;

    const captureFrame = (forceAccept = false) => {
      if (cancelled) return false;
      if (hasCaptured) return true;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return false;
      ctx.drawImage(video, 0, 0, width, height);

      if (!forceAccept && isLikelyBlackThumbnail(ctx, width, height)) {
        return false;
      }

      try {
        const url = canvas.toDataURL("image/jpeg", 0.6);
        hasCaptured = true;
        setDirectVideoThumb(url);
        setDirectVideoThumbError(null);
        onThumbnailGenerated?.(url);
        return true;
      } catch (err) {
        console.error("Failed to create video thumbnail", err);
        setDirectVideoThumbError("Preview unavailable");
        return false;
      }
    };

    const seekToPreviewFrame = () => {
      try {
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        if (duration <= 0 || seekAttempt >= SEEK_FRACTIONS.length) {
          return false;
        }
        const fraction = SEEK_FRACTIONS[seekAttempt];
        seekAttempt += 1;
        const targetTime = Math.min(
          duration * fraction,
          Math.max(duration - 0.05, 0)
        );
        video.currentTime = targetTime;
        return true;
      } catch {
        return false;
      }
    };

    const handleLoadedMetadata = () => {
      if (cancelled) return;
      if (!seekToPreviewFrame()) {
        captureFrame(true);
      }
    };

    const handleSeeked = () => {
      const captured = captureFrame();
      if (!captured && !hasCaptured && !seekToPreviewFrame()) {
        captureFrame(true);
      }
    };

    const handleLoadedData = () => {
      if (!hasCaptured && seekAttempt === 0) {
        captureFrame(true);
      }
    };

    const handleError = () => {
      if (cancelled) return;
      setDirectVideoThumb(null);
      setDirectVideoThumbError("Preview unavailable");
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("error", handleError);

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("error", handleError);
      video.src = "";
    };
  }, [
    hasDirectVideo,
    storedThumbnail,
    videoUrlForThumb,
    onThumbnailGenerated,
    forceRegen,
  ]);

  return {
    directVideoThumb,
    directVideoThumbError,
    setForceThumbnailRegeneration,
    setDirectVideoThumb,
    setDirectVideoThumbError,
  };
}
