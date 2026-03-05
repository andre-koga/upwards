"use client";

import { usePathname, useRouter } from "next/navigation";
import { BarChart2, Layers } from "lucide-react";

export default function ActivityNavMenu() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="fixed bottom-16 left-0 right-0 z-40 flex justify-center pb-2 pointer-events-none">
      <div className="flex items-center gap-1 p-1 rounded-full bg-background border border-border shadow-lg pointer-events-auto">
        <button
          onClick={() => router.push("/activities")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            pathname === "/activities"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="h-4 w-4" />
          Groups
        </button>
        <button
          onClick={() => router.push("/activities/stats")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            pathname === "/activities/stats"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart2 className="h-4 w-4" />
          Stats
        </button>
      </div>
    </div>
  );
}
