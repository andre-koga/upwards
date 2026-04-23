import { BrowserRouter, Routes, Route } from "react-router-dom";
import TodayPage from "@/pages/today";
import GroupPage from "@/pages/group";
import StatsPage from "@/pages/stats";
import ActivityStatsPage from "@/pages/activity-stats";
import SettingsPage from "@/pages/settings";
import ArchivedPage from "@/pages/archived";
import TaskOrderPage from "@/pages/task-order";
import SyncStatus from "@/components/settings/sync-status";

export default function App() {
  return (
    <BrowserRouter>
      <div className="hidden md:mx-auto md:block md:max-w-sm md:pt-6">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-50/80 p-4 text-sm leading-relaxed text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-semibold">Mobile experience notice</p>
          <p className="mt-1">
            This app is currently built for a phone-sized viewport. Desktop
            support is still in progress.
          </p>
        </div>
      </div>
      <div className="min-h-screen md:flex md:h-screen md:items-stretch md:justify-center md:gap-10 md:px-6 md:py-6">
        <main className="relative w-full bg-background md:h-full md:max-w-[430px] md:overflow-hidden md:rounded-[2rem] md:border md:border-border md:shadow-2xl md:[transform:translateZ(0)]">
          <SyncStatus />
          <div className="md:h-full md:overflow-y-auto">
            <Routes>
              <Route path="/" element={<TodayPage />} />
              <Route path="/activities/stats" element={<StatsPage />} />
              <Route
                path="/activities/stats/:activityId"
                element={<ActivityStatsPage />}
              />
              <Route path="/activities/:groupId" element={<GroupPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/archived" element={<ArchivedPage />} />
              <Route path="/settings/task-order" element={<TaskOrderPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}
