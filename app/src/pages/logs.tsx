import { useEffect, useState, useLayoutEffect } from "react";
import type { AppLog } from "@/lib/db/types";
import { db } from "@/lib/db";
import { formatDateShort } from "@/lib/time-utils";
import { getActiveLocaleTag } from "@/lib/i18n";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle,
  Copy,
  Info,
  Smartphone,
} from "lucide-react";
import {
  SettingsActionRow,
  SettingsGroup,
} from "@/components/settings/settings-list";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { AppPageShell } from "@/components/layout/app-page-shell";
import { scrollAppToTop } from "@/lib/scroll-app-to-top";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { collectDeviceReport } from "@/lib/device-report";

interface LogItemProps {
  log: AppLog;
  getIcon: (level: AppLog["level"]) => React.ReactNode;
  getTimestamp: (isoTime: string) => string;
}

/** One log line; pressing it copies the context and message. */
function LogItem({ log, getIcon, getTimestamp }: LogItemProps) {
  const { t } = useTranslation("settings");
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(`${log.context}: ${log.message}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the text stays on screen to select by hand.
    }
  };

  return (
    <Button
      type="button"
      variant="bare"
      onClick={() => void handleClick()}
      className="flex h-auto w-full items-start justify-start gap-3 whitespace-normal rounded-none px-4 py-3 text-left transition-colors hover:bg-foreground/[0.04] focus-visible:ring-inset focus-visible:ring-offset-0 active:bg-foreground/[0.06]"
    >
      <span className="mt-0.5 shrink-0">{getIcon(log.level)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-sm font-medium text-foreground">
            {log.context}
          </span>
          <span
            className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground/75"
            aria-live="polite"
          >
            {copied ? t("logsPage.copied") : getTimestamp(log.created_at)}
          </span>
        </span>
        <span className="mt-0.5 block break-words font-mono text-xs leading-relaxed text-muted-foreground">
          {log.message}
        </span>
      </span>
    </Button>
  );
}

async function deleteOldLogs() {
  try {
    const oneDayAgoMs = Date.now() - 24 * 60 * 60 * 1000;
    const oneDayAgo = new Date(oneDayAgoMs).toISOString();

    const oldLogs = await db.appLogs
      .where("created_at")
      .below(oneDayAgo)
      .toArray();

    if (oldLogs.length > 0) {
      await db.appLogs.bulkDelete(oldLogs.map((log) => log.id));
    }
  } catch (error) {
    console.error("Failed to delete old logs:", error);
  }
}

function DeviceReportSection() {
  const { t } = useTranslation("settings");
  const [report, setReport] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const check = async () => {
    setBusy(true);
    setCopied(false);
    setReport(await collectDeviceReport());
    setBusy(false);
  };

  const copy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
    } catch {
      // Clipboard blocked: the report stays on screen to select by hand.
    }
  };

  return (
    <SettingsGroup
      title={t("deviceReport.title")}
      footer={t("deviceReport.hint")}
    >
      <SettingsActionRow
        icon={Smartphone}
        label={t("deviceReport.check")}
        busy={busy}
        disabled={busy}
        onClick={() => void check()}
      />
      {report ? (
        <>
          <SettingsActionRow
            icon={copied ? Check : Copy}
            label={copied ? t("deviceReport.copied") : t("deviceReport.copy")}
            onClick={() => void copy()}
          />
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-xs tabular-nums text-muted-foreground">
            {report}
          </pre>
        </>
      ) : null}
    </SettingsGroup>
  );
}

export default function ErrorLogsPage() {
  const { t } = useTranslation("settings");
  const { t: tNav } = useTranslation("nav");
  const [logs, setLogs] = useState<AppLog[]>([]);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    scrollAppToTop();
  }, []);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        // Delete logs older than 1 day
        await deleteOldLogs();

        const allLogs = await db.appLogs
          .orderBy("created_at")
          .reverse()
          .toArray();
        setLogs(allLogs);
      } catch (error) {
        console.error("Failed to load logs:", error);
      } finally {
        setLoading(false);
      }
    };

    void loadLogs();
  }, []);

  const getIcon = (level: AppLog["level"]) => {
    switch (level) {
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-green" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-gold-text" />;
      case "info":
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTimestamp = (isoTime: string) => {
    try {
      const date = new Date(isoTime);
      const timeStr = date.toLocaleTimeString(getActiveLocaleTag(), {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      const dateStr = formatDateShort(date);
      return `${dateStr} ${timeStr}`;
    } catch {
      return isoTime;
    }
  };

  return (
    <AppPageShell
      title={t("logsPage.title")}
      subtitle={t("logsPage.subtitle", { count: logs.length })}
      className="space-y-9"
    >
      <SettingsGroup
        title={t("logsPage.groupTitle")}
        footer={logs.length > 0 ? t("logsPage.copyHint") : undefined}
      >
        {loading ? (
          <p className="px-4 py-3.5 text-sm text-muted-foreground">
            {t("logsPage.loading")}
          </p>
        ) : logs.length === 0 ? (
          <p className="px-4 py-3.5 text-sm text-muted-foreground">
            {t("logsPage.empty")}
          </p>
        ) : (
          logs.map((log) => (
            <LogItem
              key={log.id}
              log={log}
              getIcon={getIcon}
              getTimestamp={getTimestamp}
            />
          ))
        )}
      </SettingsGroup>

      <DeviceReportSection />

      <FloatingBackButton to="/settings" title={tNav("settings")} />
    </AppPageShell>
  );
}
