export interface SpikeDevice {
  userAgent: string;
  platform: string;
  cores: number | null;
  memoryGb: number | null;
  screen: string;
}

export interface SpikeCapabilities {
  webCodecs: boolean;
  h264Portrait: boolean;
  h264Landscape: boolean;
  aac: boolean;
}

export interface SpikeEncodeRow {
  name: string;
  inputBytes: number;
  outputBytes: number | null;
  sourceSeconds: number | null;
  output: string | null;
  trimmed: boolean | null;
  audio: "kept" | "dropped" | "none" | null;
  elapsedMs: number | null;
  error: string | null;
}

export interface SpikeCompile {
  clips: number;
  used: number;
  skipped: number;
  seconds: number;
  elapsedMs: number;
  outputBytes: number;
  peakHeapMb: number | null;
}

export interface SpikeReport {
  date: string;
  device: SpikeDevice;
  capabilities: SpikeCapabilities;
  rows: SpikeEncodeRow[];
  compile: SpikeCompile | null;
  compileError: string | null;
}

const mb = (bytes: number) => (bytes / 1_048_576).toFixed(2);
const yes = (value: boolean) => (value ? "yes" : "NO");

/**
 * The text to paste into product-scope.md after running the spike on a phone.
 * Failures are first-class: a row that errored or a compile that threw is the
 * most useful thing the spike can find.
 */
export function formatSpikeReport(report: SpikeReport): string {
  const { device, capabilities: cap } = report;
  const lines: string[] = [
    `### Spike result: ${device.platform || "unknown device"} (${report.date})`,
    "",
    `- User agent: \`${device.userAgent}\``,
    `- Cores: ${device.cores ?? "?"}, memory: ${device.memoryGb ?? "?"} GB, screen: ${device.screen}`,
    `- WebCodecs: ${yes(cap.webCodecs)}; H.264 encode portrait: ${yes(cap.h264Portrait)}, landscape: ${yes(cap.h264Landscape)}; AAC encode: ${yes(cap.aac)}`,
    "",
  ];

  if (report.rows.length === 0) {
    lines.push("No clips were encoded.", "");
  } else {
    lines.push(
      "| Clip | In (MB) | Out (MB) | Length (s) | Output | Trimmed | Audio | Time (s) | Result |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"
    );
    for (const row of report.rows) {
      lines.push(
        `| ${row.name} | ${mb(row.inputBytes)} | ${
          row.outputBytes === null ? "-" : mb(row.outputBytes)
        } | ${row.sourceSeconds === null ? "-" : row.sourceSeconds.toFixed(1)} | ${
          row.output ?? "-"
        } | ${row.trimmed === null ? "-" : row.trimmed ? "yes" : "no"} | ${
          row.audio ?? "-"
        } | ${
          row.elapsedMs === null ? "-" : (row.elapsedMs / 1000).toFixed(1)
        } | ${row.error ? `FAILED: ${row.error}` : "ok"} |`
      );
    }
    lines.push("");
  }

  if (report.compile) {
    const c = report.compile;
    lines.push(
      `- Month compile: ${c.used}/${c.clips} clips joined into ${c.seconds.toFixed(1)} s, ${c.skipped} skipped, ${(c.elapsedMs / 1000).toFixed(1)} s, ${mb(c.outputBytes)} MB, peak JS heap ${c.peakHeapMb === null ? "n/a" : `${c.peakHeapMb.toFixed(0)} MB`}. Tab survived: yes.`
    );
  } else if (report.compileError) {
    lines.push(`- Month compile: FAILED: ${report.compileError}`);
  } else {
    lines.push("- Month compile: not run.");
  }

  lines.push(
    "",
    "Checked by eye (fill in): audio plays, orientation correct, WebM from Chrome decodes."
  );
  return lines.join("\n");
}
