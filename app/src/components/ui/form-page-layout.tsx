import { useNavigate } from "react-router-dom";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { formSubmitButton } from "@/lib/form-styles";

interface FormPageLayoutProps {
  formId: string;
  onSubmit: (e: React.FormEvent) => void;
  backPath?: string;
  backTitle?: string;
  submitLabel: string;
  isSubmitting: boolean;
  submitDisabled?: boolean;
  error?: string | null;
  children: React.ReactNode;
}

export default function FormPageLayout({
  formId,
  onSubmit,
  backPath = "/",
  backTitle = "Back",
  submitLabel,
  isSubmitting,
  submitDisabled = false,
  error,
  children,
}: FormPageLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col">
      <form
        id={formId}
        onSubmit={onSubmit}
        className="flex flex-1 flex-col gap-8 px-4 pb-28 pt-0"
      >
        {children}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      <FloatingBackButton
        onClick={() => navigate(backPath)}
        title={backTitle}
      />

      <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
        <button
          type="submit"
          form={formId}
          disabled={isSubmitting || submitDisabled}
          className={formSubmitButton}
        >
          {isSubmitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
