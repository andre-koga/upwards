import { Link } from "react-router-dom";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/ui/settings-section";

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
