import { Link } from "react-router-dom";
import { Archive, ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/ui/settings-section";

export function ArchiveCard() {
  return (
    <SettingsSection
      title="Archive"
      icon={Archive}
      description="View and manage your archived activity groups and activities."
    >
      <Button variant="outline" className="w-full" asChild>
        <Link to="/settings/archived">
          <Archive className="h-4 w-4" />
          View archived items
        </Link>
      </Button>
    </SettingsSection>
  );
}

export function TaskOrderCard() {
  return (
    <SettingsSection
      title="Task order"
      icon={ArrowUpDown}
      description="Choose the display order for scheduled tasks shown on the home page."
    >
      <Button variant="outline" className="w-full" asChild>
        <Link to="/settings/task-order">
          <ArrowUpDown className="h-4 w-4" />
          Reorder daily tasks
        </Link>
      </Button>
    </SettingsSection>
  );
}
