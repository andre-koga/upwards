import { BrowserRouter, Routes, Route } from "react-router-dom";
import TodayPage from "@/pages/today";
import GroupPage from "@/pages/group";
import SessionDetailsPage from "@/pages/session-details";
import StatsPage from "@/pages/stats";
import SettingsPage from "@/pages/settings";
import ArchivedPage from "@/pages/archived";
import TaskOrderPage from "@/pages/task-order";
import SyncStatus from "@/components/settings/sync-status";

export const LOCAL_USER_ID = "local";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TodayPage />} />
        <Route path="/activities/stats" element={<StatsPage />} />
        <Route path="/activities/:groupId" element={<GroupPage />} />
        <Route
          path="/activities/:groupId/sessions/:sessionId"
          element={<SessionDetailsPage />}
        />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/archived" element={<ArchivedPage />} />
        <Route path="/settings/task-order" element={<TaskOrderPage />} />
      </Routes>
      <SyncStatus />
    </BrowserRouter>
  );
}
