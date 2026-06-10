import { useEffect, useState, useLayoutEffect } from "react";
import type { AppLog } from "@/lib/db/types";
import { db } from "@/lib/db";
import { formatDateShort, fromDateString } from "@/lib/time-utils";
import { AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";
import { FloatingBackButton } from "@/components/ui/floating-back-button";

function scrollAppToTop() {
  window.scrollTo(0, 0);
  document.querySelector<HTMLElement>("[data-app-scroll]")?.scrollTo(0, 0);
}

interface LogItemProps {
  log: AppLog;
  getIcon: (level: AppLog["level"]) => React.ReactNode;
  getTimestamp: (isoTime: string) => string;
}

function LogItem({ log, getIcon, getTimestamp }: LogItemProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = () => {
    const logText = `${log.context}: ${log.message}`;
    navigator.clipboard.writeText(logText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={handleClick}
      className="flex gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm cursor-pointer hover:bg-muted/50 transition-colors relative"
    >
      <div className="mt-0.5 shrink-0">{getIcon(log.level)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground text-xs">
              {log.context}
            </p>
            <p className="break-words text-xs text-muted-foreground">
              {log.message}
            </p>
          </div>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground/70">
          {getTimestamp(log.created_at)}
        </p>
      </div>
      {copied && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 text-xs font-medium text-white pointer-events-none">
          Copied!
        </div>
      )}
    </div>
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
      await db.appLogs.bulkDelete(oldLogs.map(log => log.id));
    }
  } catch (error) {
    console.error("Failed to delete old logs:", error);
  }
}

export default function ErrorLogsPage() {
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
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "info":
      default:
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  const getTimestamp = (isoTime: string) => {
    try {
      const date = new Date(isoTime);
      const timeStr = date.toLocaleTimeString("en-US", {
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
    <div className="space-y-6 p-4 pb-24">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Error Logs</h1>
        <p className="text-sm text-muted-foreground">
          {logs.length} {logs.length === 1 ? "entry" : "entries"} (last 24 hours)
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Loading logs...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">No logs yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <LogItem key={log.id} log={log} getIcon={getIcon} getTimestamp={getTimestamp} />
          ))}
        </div>
      )}

      <FloatingBackButton to="/" title="Home" />
    </div>
  );
}
