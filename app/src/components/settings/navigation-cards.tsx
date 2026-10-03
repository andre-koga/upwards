import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowUpDown,
  ExternalLink,
  FileText,
  Github,
  Info,
} from "lucide-react";

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

export function AboutCard() {
  const { t } = useTranslation("settings");
  return (
    <SettingsSection title={t("about.title")} icon={Info}>
      <Button variant="outline" className="w-full justify-start" asChild>
        <Link to="/logs">
          <FileText className="h-4 w-4" />
          {t("about.errorLogs")}
        </Link>
      </Button>
      <Button variant="outline" className="w-full justify-between" asChild>
        <a
          href="https://github.com/andre-koga/upwards"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="flex items-center gap-2">
            <Github className="h-4 w-4" />
            {t("about.github")}
          </span>
          <ExternalLink
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </a>
      </Button>
    </SettingsSection>
  );
}
