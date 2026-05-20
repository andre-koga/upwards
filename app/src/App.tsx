import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import TodayPage from "@/pages/today";
import StatsPage from "@/pages/stats";
import SettingsPage from "@/pages/settings";
import TaskOrderPage from "@/pages/task-order";
import WhatsNewPage from "@/pages/whats-new";
import PromiseDetailPage from "@/pages/promise-detail";
import JoinPromisePage from "@/pages/join-promise";
import NotificationsPage from "@/pages/notifications";
import { NotificationsFloatingButton } from "@/components/promises/notifications-floating-button";
import SyncStatus from "@/components/settings/sync-status";

export default function App() {
  return (
    <BrowserRouter>
      <div className="hidden md:mx-auto md:block md:max-w-sm md:pt-6">
        <div className="rounded-2xl border border-amber-400 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-semibold">Mobile experience notice</p>
          <p className="mt-1">
            This app is currently built for a phone-sized viewport. Desktop
            support is still in progress. Scroll down to see the full
            experience.
          </p>
        </div>
      </div>
      <div className="min-h-screen md:flex md:h-screen md:items-stretch md:justify-center md:gap-10 md:px-6 md:py-6">
        <main className="relative w-full bg-background md:h-full md:max-w-[430px] md:overflow-hidden md:rounded-2xl md:border md:border-border md:shadow-2xl md:[transform:translateZ(0)]">
          <SyncStatus />
          <NotificationsFloatingButton />
          <div data-app-scroll className="md:h-full md:overflow-y-auto">
            <Routes>
              <Route path="/" element={<TodayPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route
                path="/promises"
                element={<Navigate to="/" replace />}
              />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/task-order" element={<TaskOrderPage />} />
              <Route path="/whats-new" element={<WhatsNewPage />} />
              <Route path="/promises/:id" element={<PromiseDetailPage />} />
              <Route path="/promises/join/:token" element={<JoinPromisePage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}
