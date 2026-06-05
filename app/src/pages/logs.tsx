import { useEffect, useState } from "react";
import type { AppLog } from "@/lib/db/types";
import { db } from "@/lib/db";
import { formatDateShort, fromDateString } from "@/lib/time-utils";
import { AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";

export default function LogsPage() {
  const [logs, setLogs] = useState<AppLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      try {
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
    <div className="flex flex-col min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold">Logs</h1>
            <p className="text-sm text-muted-foreground">
              {logs.length} {logs.length === 1 ? "entry" : "entries"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-muted-foreground">Loading logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-muted-foreground">No logs yet</p>
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex gap-3 rounded-lg border border-border bg-card p-3 text-sm"
              >
                <div className="mt-0.5 shrink-0">{getIcon(log.level)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">
                        {log.context}
                      </p>
                      <p className="break-words text-xs text-muted-foreground">
                        {log.message}
                      </p>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    {getTimestamp(log.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
