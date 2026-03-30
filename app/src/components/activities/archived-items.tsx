import { useState } from "react";
import { useNavigate } from "react-router-dom";

import ArchivedGroupsList from "@/components/activities/archived-groups-list";
import ArchivedActivitiesList from "@/components/activities/archived-activities-list";
import { DeleteConfirmDialog } from "@/components/activities/delete-confirm-dialog";
import { useArchivedItems } from "@/components/activities/hooks/use-archived-items";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { SettingsSection } from "@/components/ui/settings-section";

export default function ArchivedItems() {
  const navigate = useNavigate();
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: "activity" | "group" | null;
    id: string | null;
  }>({ open: false, type: null, id: null });

  const {
    archivedGroups,
    archivedActivities,
    allGroups,
    loading,
    loadArchivedItems,
    handleUnarchiveGroup,
    handleUnarchiveActivity,
  } = useArchivedItems();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading archived items...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SettingsSection title="Archived groups">
        <ArchivedGroupsList
          groups={archivedGroups}
          onUnarchive={handleUnarchiveGroup}
          onDelete={(id) => setDeleteDialog({ open: true, type: "group", id })}
        />
      </SettingsSection>

      <SettingsSection title="Archived activities">
        <ArchivedActivitiesList
          activities={archivedActivities}
          allGroups={allGroups}
          onUnarchive={handleUnarchiveActivity}
          onDelete={(id) =>
            setDeleteDialog({ open: true, type: "activity", id })
          }
        />
      </SettingsSection>

      <FloatingBackButton
        onClick={() => navigate("/settings")}
        title="Back to settings"
      />

      <DeleteConfirmDialog
        open={deleteDialog.open}
        type={deleteDialog.type}
        id={deleteDialog.id}
        onOpenChange={(open) =>
          !open && setDeleteDialog({ open: false, type: null, id: null })
        }
        onDeleted={loadArchivedItems}
      />
    </div>
  );
}
