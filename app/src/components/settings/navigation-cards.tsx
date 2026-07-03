import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/ui/settings-section";

export function TaskOrderCard() {
  const { t } = useTranslation("settings");
  return (
    <SettingsSection
      title={t("taskOrder.title")}
      icon={ArrowUpDown}
      description={t("taskOrder.description")}
    >
      <Button variant="outline" className="w-full" asChild>
        <Link to="/settings/task-order">
          <ArrowUpDown className="h-4 w-4" />
          {t("taskOrder.reorder")}
        </Link>
      </Button>
    </SettingsSection>
  );
}
