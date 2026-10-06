import { describe, expect, it } from "vitest";
import { UnsupportedInputFormatError } from "mediabunny";
import { ClipPlanError } from "./clip-plan";
import { toCompressionError } from "./video-compression";
import { VideoCompressionError } from "./video-compression-error";

describe("toCompressionError", () => {
  it("calls a file Mediabunny cannot read 'not a video'", () => {
    // Regression: a text file used to surface as the generic failure.
    const error = toCompressionError(new UnsupportedInputFormatError());
    expect(error).toBeInstanceOf(VideoCompressionError);
    expect(error.code).toBe("no_video");
  });

  it("maps each planning failure to its own message", () => {
    expect(toCompressionError(new ClipPlanError("no_video", "x")).code).toBe(
      "no_video"
    );
    expect(
      toCompressionError(new ClipPlanError("invalid_source", "x")).code
    ).toBe("empty");
    expect(toCompressionError(new ClipPlanError("no_h264", "x")).code).toBe(
      "no_h264"
    );
  });

  it("falls back to a generic failure for anything unexpected", () => {
    expect(toCompressionError(new Error("boom")).code).toBe("failed");
    expect(toCompressionError("nope").code).toBe("failed");
  });
});
