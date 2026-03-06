import { BrowserRouter, Routes, Route } from "react-router-dom";
import BottomNav from "@/components/layout/bottom-nav";
import TodayPage from "@/pages/today";
import ActivitiesPage from "@/pages/activities";
import GroupPage from "@/pages/group";
import NewGroupPage from "@/pages/new-group";
import EditGroupPage from "@/pages/edit-group";
import NewActivityPage from "@/pages/new-activity";
import EditActivityPage from "@/pages/edit-activity";
import StatsPage from "@/pages/stats";
import TimerPage from "@/pages/timer";
import SettingsPage from "@/pages/settings";
import ArchivedPage from "@/pages/archived";

export const LOCAL_USER_ID = "local";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TodayPage />} />
        <Route path="/activities" element={<ActivitiesPage />} />
        <Route path="/activities/new" element={<NewGroupPage />} />
        <Route path="/activities/stats" element={<StatsPage />} />
        <Route path="/activities/:groupId" element={<GroupPage />} />
        <Route path="/activities/:groupId/new" element={<NewActivityPage />} />
        <Route path="/activities/:groupId/edit" element={<EditGroupPage />} />
        <Route
          path="/activities/:groupId/edit/:activityId"
          element={<EditActivityPage />}
        />
        <Route path="/timer" element={<TimerPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/archived" element={<ArchivedPage />} />
      </Routes>
      <BottomNav />
    </BrowserRouter>
  );
}
