import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { MOBILE_FRAME_ID } from "@/lib/mobile-frame";

/**
 * On a phone the notice is hidden and the frame is just the page.
 * On a wider window both are styled from `index.css` (a real media query,
 * not a Tailwind breakpoint — those are disabled).
 */
export function WideScreenStage({ children }: { children: ReactNode }) {
  const { t } = useTranslation("common");
  return (
    <div className="wide-screen-stage">
      <p className="wide-screen-notice" role="note">
        {t("wideScreen")}
      </p>
      <div id={MOBILE_FRAME_ID} className="mobile-frame">
        {children}
      </div>
    </div>
  );
}
