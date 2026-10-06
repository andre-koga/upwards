import { describe, expect, it } from "vitest";
import {
  formatSpikeReport,
  type SpikeEncodeRow,
  type SpikeReport,
} from "./clip-spike-report";

const row = (patch: Partial<SpikeEncodeRow> = {}): SpikeEncodeRow => ({
  name: "IMG_0001.mov",
  inputBytes: 31_457_280,
  outputBytes: 2_621_440,
  sourceSeconds: 12.4,
  output: "1080x1920",
  trimmed: true,
  audio: "kept",
  elapsedMs: 4200,
  error: null,
  ...patch,
});

const report = (patch: Partial<SpikeReport> = {}): SpikeReport => ({
  date: "2026-10-06",
  device: {
    userAgent: "Mozilla/5.0 (iPhone)",
    platform: "iPhone",
    cores: 6,
    memoryGb: null,
    screen: "390x844",
  },
  capabilities: {
    webCodecs: true,
    h264Portrait: true,
    h264Landscape: true,
    aac: true,
  },
  rows: [row()],
  compile: null,
  compileError: null,
  ...patch,
});

describe("formatSpikeReport", () => {
  it("writes the device and capabilities, with unknowns marked", () => {
    const text = formatSpikeReport(report());
    expect(text).toContain("### Spike result: iPhone (2026-10-06)");
    expect(text).toContain("memory: ? GB");
    expect(text).toContain("AAC encode: yes");
  });

  it("flags a missing capability loudly", () => {
    const text = formatSpikeReport(
      report({
        capabilities: {
          webCodecs: true,
          h264Portrait: true,
          h264Landscape: true,
          aac: false,
        },
      })
    );
    expect(text).toContain("AAC encode: NO");
  });

  it("formats sizes in MB and time in seconds", () => {
    const text = formatSpikeReport(report());
    expect(text).toContain(
      "| IMG_0001.mov | 30.00 | 2.50 | 12.4 | 1080x1920 |"
    );
    expect(text).toContain("| 4.2 | ok |");
  });

  it("reports a failed clip instead of hiding it", () => {
    const text = formatSpikeReport(
      report({
        rows: [
          row({
            error: "That video can't be converted.",
            outputBytes: null,
            elapsedMs: null,
            output: null,
            trimmed: null,
            audio: null,
          }),
        ],
      })
    );
    expect(text).toContain("FAILED: That video can't be converted.");
  });

  it("shows when the sound was dropped", () => {
    expect(
      formatSpikeReport(report({ rows: [row({ audio: "dropped" })] }))
    ).toContain("| dropped |");
  });

  it("summarises a month compile, including memory when the browser exposes it", () => {
    const text = formatSpikeReport(
      report({
        compile: {
          clips: 31,
          used: 31,
          skipped: 0,
          seconds: 31,
          elapsedMs: 18_000,
          outputBytes: 12_582_912,
          peakHeapMb: 310,
        },
      })
    );
    expect(text).toContain("31/31 clips joined into 31.0 s");
    expect(text).toContain("12.00 MB");
    expect(text).toContain("peak JS heap 310 MB");
  });

  it("says n/a for memory on browsers that hide it (Safari, Firefox)", () => {
    const text = formatSpikeReport(
      report({
        compile: {
          clips: 5,
          used: 5,
          skipped: 0,
          seconds: 5,
          elapsedMs: 1000,
          outputBytes: 1_048_576,
          peakHeapMb: null,
        },
      })
    );
    expect(text).toContain("peak JS heap n/a");
  });

  it("records a failed compile as a result, not a blank", () => {
    expect(
      formatSpikeReport(report({ compileError: "Out of memory" }))
    ).toContain("Month compile: FAILED: Out of memory");
    expect(formatSpikeReport(report())).toContain("Month compile: not run.");
  });

  it("handles a run with no clips", () => {
    expect(formatSpikeReport(report({ rows: [] }))).toContain(
      "No clips were encoded."
    );
  });
});
