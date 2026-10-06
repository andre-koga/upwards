import { useEffect, useRef, useState } from "react";
import { canEncodeAudio, canEncodeVideo } from "mediabunny";

import { AppPageShell } from "@/components/layout/app-page-shell";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionLabel } from "@/components/ui/section-label";
import { compileClips } from "@/lib/journal/clip-compile";
import {
  formatSpikeReport,
  type SpikeCapabilities,
  type SpikeCompile,
  type SpikeDevice,
  type SpikeEncodeRow,
} from "@/lib/journal/clip-spike-report";
import {
  encodeClip,
  isClipEncodingSupported,
} from "@/lib/journal/video-compression";

/**
 * Developer tool for the daily-clip spike (product-scope.md §2.5, A10). Open
 * `/clip-spike` on a real phone, pick a few recorded videos, and it reports
 * whether they encode, how long that takes, and whether a month of clips can
 * be joined without crashing the tab. It is not linked from the app.
 */

type Memory = { usedJSHeapSize: number };

const readDevice = (): SpikeDevice => {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform || "",
    cores: navigator.hardwareConcurrency ?? null,
    memoryGb: nav.deviceMemory ?? null,
    screen: `${screen.width}x${screen.height}`,
  };
};

const heapMb = (): number | null => {
  const memory = (performance as Performance & { memory?: Memory }).memory;
  return memory ? memory.usedJSHeapSize / 1_048_576 : null;
};

export default function ClipSpikePage() {
  const [capabilities, setCapabilities] = useState<SpikeCapabilities | null>(
    null
  );
  const [rows, setRows] = useState<SpikeEncodeRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");
  const [compile, setCompile] = useState<SpikeCompile | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [compileCount, setCompileCount] = useState("31");
  const [outputs, setOutputs] = useState<Array<{ name: string; url: string }>>(
    []
  );
  const [compiledUrl, setCompiledUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const encodedRef = useRef<Blob[]>([]);
  const device = useRef(readDevice()).current;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const webCodecs = isClipEncodingSupported();
      const [h264Portrait, h264Landscape, aac] = webCodecs
        ? await Promise.all([
            canEncodeVideo("avc", { width: 1080, height: 1920 }),
            canEncodeVideo("avc", { width: 1920, height: 1080 }),
            canEncodeAudio("aac"),
          ])
        : [false, false, false];
      if (!cancelled)
        setCapabilities({ webCodecs, h264Portrait, h264Landscape, aac });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const encodeFiles = async (files: File[]) => {
    setBusy("Encoding");
    setCompile(null);
    setCompileError(null);
    for (const file of files) {
      setProgress(`${file.name}…`);
      const base = { name: file.name, inputBytes: file.size };
      try {
        const result = await encodeClip(file, {
          onProgress: (p) =>
            setProgress(`${file.name}: ${Math.round(p * 100)}%`),
        });
        encodedRef.current.push(result.file);
        const url = URL.createObjectURL(result.file);
        setOutputs((prev) => [...prev, { name: file.name, url }]);
        setRows((prev) => [
          ...prev,
          {
            ...base,
            outputBytes: result.file.size,
            sourceSeconds: result.plan.trimmed ? null : result.plan.trimEnd,
            output: `${result.plan.width}x${result.plan.height}`,
            trimmed: result.plan.trimmed,
            audio: result.plan.keepAudio
              ? "kept"
              : result.plan.audioDropped
                ? "dropped"
                : "none",
            elapsedMs: result.elapsedMs,
            error: null,
          },
        ]);
      } catch (error) {
        setRows((prev) => [
          ...prev,
          {
            ...base,
            outputBytes: null,
            sourceSeconds: null,
            output: null,
            trimmed: null,
            audio: null,
            elapsedMs: null,
            error: error instanceof Error ? error.message : String(error),
          },
        ]);
      }
    }
    setProgress("");
    setBusy(null);
  };

  const runCompile = async () => {
    const encoded = encodedRef.current;
    const count = Math.max(1, Math.min(400, Number(compileCount) || 31));
    if (encoded.length === 0) return;
    setBusy("Joining");
    setCompile(null);
    setCompileError(null);
    if (compiledUrl) URL.revokeObjectURL(compiledUrl);
    setCompiledUrl(null);

    // Reuse the encoded clips round-robin so a month can be simulated from a
    // handful of recordings.
    const clips = Array.from(
      { length: count },
      (_, i) => encoded[i % encoded.length]
    );
    let peak: number | null = heapMb();
    const poll = window.setInterval(() => {
      const now = heapMb();
      if (now !== null) peak = Math.max(peak ?? 0, now);
    }, 250);
    try {
      const result = await compileClips(clips, {
        onProgress: (done, total) => setProgress(`Joining ${done}/${total}`),
      });
      setCompile({
        clips: count,
        used: result.clipsUsed,
        skipped: result.clipsSkipped,
        seconds: result.seconds,
        elapsedMs: result.elapsedMs,
        outputBytes: result.blob.size,
        peakHeapMb: peak,
      });
      setCompiledUrl(URL.createObjectURL(result.blob));
    } catch (error) {
      setCompileError(error instanceof Error ? error.message : String(error));
    } finally {
      window.clearInterval(poll);
      setProgress("");
      setBusy(null);
    }
  };

  const report = () =>
    formatSpikeReport({
      date: new Date().toISOString().slice(0, 10),
      device,
      capabilities: capabilities ?? {
        webCodecs: false,
        h264Portrait: false,
        h264Landscape: false,
        aac: false,
      },
      rows,
      compile,
      compileError,
    });

  const copy = async () => {
    await navigator.clipboard.writeText(report());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const cap = (label: string, ok: boolean | undefined) => (
    <li>
      {label}:{" "}
      <strong>{ok === undefined ? "checking…" : ok ? "yes" : "NO"}</strong>
    </li>
  );

  return (
    <AppPageShell
      title="Clip encoder spike"
      subtitle="Developer tool for testing daily clips on a real phone"
    >
      <section className="space-y-2">
        <SectionLabel>This device</SectionLabel>
        <p className="break-words font-mono text-xs text-muted-foreground">
          {device.userAgent}
        </p>
        <ul className="font-mono text-xs">
          {cap("WebCodecs", capabilities?.webCodecs)}
          {cap("H.264 encode (portrait)", capabilities?.h264Portrait)}
          {cap("H.264 encode (landscape)", capabilities?.h264Landscape)}
          {cap("AAC encode", capabilities?.aac)}
        </ul>
      </section>

      <section className="space-y-2">
        <SectionLabel>1. Encode recorded videos</SectionLabel>
        <Label htmlFor="spike-files">
          Pick videos from this phone, ideally a long one, a portrait one, and
          one with sound
        </Label>
        <Input
          id="spike-files"
          type="file"
          accept="video/*"
          multiple
          disabled={busy !== null}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length > 0) void encodeFiles(files);
          }}
        />
        {busy ? (
          <p role="status" className="text-sm text-muted-foreground">
            {busy}… {progress}
          </p>
        ) : null}
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li
              key={`${row.name}-${index}`}
              className="rounded-md border border-border p-2 font-mono text-xs"
            >
              <div className="font-semibold">{row.name}</div>
              {row.error ? (
                <div className="text-destructive">FAILED: {row.error}</div>
              ) : (
                <div>
                  {(row.inputBytes / 1_048_576).toFixed(1)} MB →{" "}
                  {((row.outputBytes ?? 0) / 1_048_576).toFixed(2)} MB ·{" "}
                  {row.output} · audio {row.audio}
                  {row.trimmed ? " · trimmed to 10 s" : ""} ·{" "}
                  {((row.elapsedMs ?? 0) / 1000).toFixed(1)} s
                </div>
              )}
            </li>
          ))}
        </ul>
        {outputs.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Play each result. Check the sound is there and the picture is the
              right way up.
            </p>
            {outputs.map((output, index) => (
              <video
                key={`${output.url}-${index}`}
                src={output.url}
                controls
                playsInline
                className="w-full rounded-md"
                aria-label={`Encoded ${output.name}`}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-2">
        <SectionLabel>2. Join a month</SectionLabel>
        <Label htmlFor="spike-count">
          Clips to join, one second from each (reuses what you encoded above)
        </Label>
        <Input
          id="spike-count"
          type="number"
          inputMode="numeric"
          min={1}
          max={400}
          value={compileCount}
          onChange={(event) => setCompileCount(event.target.value)}
        />
        <Button
          type="button"
          onClick={() => void runCompile()}
          disabled={busy !== null || encodedRef.current.length === 0}
        >
          Join clips
        </Button>
        {compileError ? (
          <p role="alert" className="text-sm text-destructive">
            FAILED: {compileError}
          </p>
        ) : null}
        {compile ? (
          <p className="font-mono text-xs">
            {compile.used}/{compile.clips} joined into{" "}
            {compile.seconds.toFixed(1)} s ·{" "}
            {(compile.elapsedMs / 1000).toFixed(1)} s ·{" "}
            {(compile.outputBytes / 1_048_576).toFixed(1)} MB
            {compile.peakHeapMb !== null
              ? ` · peak heap ${compile.peakHeapMb.toFixed(0)} MB`
              : ""}
          </p>
        ) : null}
        {compiledUrl ? (
          <video
            src={compiledUrl}
            controls
            playsInline
            className="w-full rounded-md"
            aria-label="Joined clips"
          />
        ) : null}
      </section>

      <section className="space-y-2">
        <SectionLabel>3. Report</SectionLabel>
        <p className="text-xs text-muted-foreground">
          Copy this and paste it into the spike results in product-scope.md. If
          the tab crashed or reloaded during step 2, note that instead.
        </p>
        <Button type="button" variant="outline" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy report"}
        </Button>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border border-border p-2 font-mono text-[11px]">
          {report()}
        </pre>
      </section>

      <FloatingBackButton to="/settings" title="Settings" />
    </AppPageShell>
  );
}
