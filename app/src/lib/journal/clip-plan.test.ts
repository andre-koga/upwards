import { describe, expect, it } from "vitest";
import {
  CLIP_MAX_LONG_EDGE,
  CLIP_MAX_SECONDS,
  ClipPlanError,
  planClip,
  planClipSize,
  type ClipCapabilities,
  type ClipSourceInfo,
} from "./clip-plan";

const CAN: ClipCapabilities = { h264: true, aac: true };
const source = (patch: Partial<ClipSourceInfo> = {}): ClipSourceInfo => ({
  width: 1920,
  height: 1080,
  durationSeconds: 8,
  hasAudio: true,
  ...patch,
});

describe("planClipSize", () => {
  it("leaves a clip that already fits alone", () => {
    expect(planClipSize(1280, 720)).toEqual({ width: 1280, height: 720 });
  });

  it("never upscales", () => {
    expect(planClipSize(640, 360)).toEqual({ width: 640, height: 360 });
  });

  it("scales a 4K landscape clip down to the long-edge limit", () => {
    expect(planClipSize(3840, 2160)).toEqual({ width: 1920, height: 1080 });
  });

  it("scales a portrait phone clip by its height, keeping orientation", () => {
    const size = planClipSize(2160, 3840);
    expect(size).toEqual({ width: 1080, height: 1920 });
    expect(size.height).toBeGreaterThan(size.width);
  });

  it("always returns even numbers, which H.264 requires", () => {
    for (const [w, h] of [
      [1921, 1081],
      [3001, 1999],
      [1279, 719],
      [4000, 3001],
    ]) {
      const size = planClipSize(w, h);
      expect(size.width % 2).toBe(0);
      expect(size.height % 2).toBe(0);
      expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(
        CLIP_MAX_LONG_EDGE
      );
    }
  });

  it("keeps the aspect ratio close for odd sources", () => {
    const size = planClipSize(4000, 3001);
    expect(size.width / size.height).toBeCloseTo(4000 / 3001, 2);
  });
});

describe("planClip", () => {
  it("keeps a short clip whole, with sound", () => {
    expect(planClip(source({ durationSeconds: 6 }), CAN)).toMatchObject({
      trimEnd: 6,
      trimmed: false,
      keepAudio: true,
      audioDropped: false,
    });
  });

  it("cuts a long clip to the cap", () => {
    expect(planClip(source({ durationSeconds: 42 }), CAN)).toMatchObject({
      trimEnd: CLIP_MAX_SECONDS,
      trimmed: true,
    });
  });

  it("does not call a clip of exactly the cap trimmed", () => {
    expect(
      planClip(source({ durationSeconds: CLIP_MAX_SECONDS }), CAN).trimmed
    ).toBe(false);
  });

  it("drops the sound, not the clip, when AAC cannot be encoded", () => {
    expect(planClip(source(), { h264: true, aac: false })).toMatchObject({
      keepAudio: false,
      audioDropped: true,
    });
  });

  it("does not report dropped audio for a clip that had none", () => {
    expect(
      planClip(source({ hasAudio: false }), { h264: true, aac: false })
    ).toMatchObject({ keepAudio: false, audioDropped: false });
  });

  it("refuses rather than store a different codec when H.264 is missing", () => {
    expect(() => planClip(source(), { h264: false, aac: true })).toThrow(
      expect.objectContaining({ code: "no_h264" })
    );
  });

  it("rejects a source with no usable video", () => {
    expect(() => planClip(source({ width: 0 }), CAN)).toThrow(ClipPlanError);
    expect(() => planClip(source({ durationSeconds: 0 }), CAN)).toThrow(
      expect.objectContaining({ code: "invalid_source" })
    );
    expect(() => planClip(source({ height: NaN }), CAN)).toThrow(
      expect.objectContaining({ code: "no_video" })
    );
  });
});
