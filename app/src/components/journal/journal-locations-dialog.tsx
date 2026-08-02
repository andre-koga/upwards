import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, MapPin, Search, Trash2 } from "lucide-react";
import { FormDialog, FormDialogActions, FormStack } from "@/components/forms";
import { dialogPrimaryDestructiveClassName } from "@/components/forms/styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { JournalLocationRoute, LocationData } from "@/lib/db/types";
import {
  MAX_DAILY_LOCATIONS,
  mergeJournalLocationRoute,
  normalizeJournalLocationRoute,
  searchLocations,
} from "@/lib/journal";
import JournalLocationMapPicker from "./journal-location-map-picker";

interface JournalLocationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: JournalLocationRoute;
  canEdit: boolean;
  onSave: (route: JournalLocationRoute) => void;
}

interface SearchState {
  query: string;
  results: LocationData[];
  searching: boolean;
  error: string | null;
}

const EMPTY_SEARCH: SearchState = {
  query: "",
  results: [],
  searching: false,
  error: null,
};

export default function JournalLocationsDialog({
  open,
  onOpenChange,
  route,
  canEdit,
  onSave,
}: JournalLocationsDialogProps) {
  const { t } = useTranslation("journal");
  const { t: tCommon } = useTranslation("common");
  const [draftRoute, setDraftRoute] = useState<JournalLocationRoute>(() =>
    normalizeJournalLocationRoute(route)
  );
  const [addSearch, setAddSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(
    null
  );

  // Only resync from props when the dialog transitions to open; avoid resetting
  // mid-edit on every parent re-render (route prop is recreated each render).
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setDraftRoute(normalizeJournalLocationRoute(route));
      setAddSearch(EMPTY_SEARCH);
      setDeleteConfirmIndex(null);
    }
  }

  useEffect(() => {
    if (!open || !canEdit) return;
    const trimmed = addSearch.query.trim();
    if (trimmed.length < 2) return;

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setAddSearch((prev) => ({ ...prev, searching: true }));
      searchLocations(trimmed)
        .then((matches) => {
          if (cancelled) return;
          setAddSearch((prev) => ({ ...prev, results: matches, error: null }));
        })
        .catch(() => {
          if (cancelled) return;
          setAddSearch((prev) => ({
            ...prev,
            results: [],
            error: t("locations.searchError"),
          }));
        })
        .finally(() => {
          if (!cancelled) {
            setAddSearch((prev) => ({ ...prev, searching: false }));
          }
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [open, canEdit, addSearch.query, t]);

  const handleAddQueryChange = (value: string) => {
    setAddSearch((prev) => ({
      ...prev,
      query: value,
      results: value.trim().length < 2 ? [] : prev.results,
      searching: value.trim().length < 2 ? false : prev.searching,
    }));
  };

  const applyAddResult = (location: LocationData) => {
    setDraftRoute((prev) => mergeJournalLocationRoute(prev, location));
    setAddSearch(EMPTY_SEARCH);
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirmIndex == null) return;
    const indexToDelete = deleteConfirmIndex;
    setDraftRoute((prev) => {
      const locations = prev.locations.filter(
        (_, index) => index !== indexToDelete
      );
      return normalizeJournalLocationRoute({ locations });
    });
    setDeleteConfirmIndex(null);
  };

  const handleSave = () => {
    if (!canEdit) {
      onOpenChange(false);
      return;
    }
    onSave(normalizeJournalLocationRoute(draftRoute));
    onOpenChange(false);
  };

  const handleLocationsOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && deleteConfirmIndex != null) return;
    onOpenChange(nextOpen);
  };

  const canAddLocation =
    canEdit && draftRoute.locations.length < MAX_DAILY_LOCATIONS;
  const deleteConfirmName =
    deleteConfirmIndex != null
      ? draftRoute.locations[deleteConfirmIndex]?.displayName.trim() ||
        t("locations.thisLocation")
      : t("locations.thisLocation");

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={handleLocationsOpenChange}
        title={t("locations.title")}
        description={t("locations.description", { count: MAX_DAILY_LOCATIONS })}
        contentClassName="sm:max-w-md"
      >
        <FormStack className="space-y-2">
          {draftRoute.locations.length > 0 ? (
            <JournalLocationMapPicker
              locations={draftRoute.locations}
              className="h-44"
              ariaLabel={t("locations.mapAriaLabel")}
            />
          ) : null}

          {draftRoute.locations.length > 0 ? (
            <div className="space-y-2">
              {draftRoute.locations.map((loc, index) => (
                <div
                  key={`${index}-${loc.displayName}-${loc.lat ?? ""}-${loc.lon ?? ""}`}
                  className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {loc.displayName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[loc.state, loc.country].filter(Boolean).join(", ") ||
                        t("locations.manualPlace")}
                    </span>
                  </span>
                  {canEdit ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0 border-destructive text-destructive"
                      onClick={() => setDeleteConfirmIndex(index)}
                      title={t("locations.deleteLocation")}
                      aria-label={t("locations.deleteLocation")}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : canEdit ? (
            <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              {t("locations.emptyHelper")}
            </p>
          ) : (
            <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              {t("locations.noLocationsYet")}
            </p>
          )}

          {canAddLocation ? (
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={addSearch.query}
                  onChange={(event) => handleAddQueryChange(event.target.value)}
                  placeholder={t("locations.searchAddPlaceholder")}
                  className="border-dashed pl-9"
                  disabled={!canEdit}
                />
                {addSearch.searching ? (
                  <Loader2
                    className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
                    aria-hidden
                  />
                ) : null}
              </div>
              {addSearch.query.trim().length >= 2 ? (
                <div className="max-h-36 space-y-1 overflow-y-auto">
                  {addSearch.results.length > 0 ? (
                    addSearch.results.map((result) => (
                      <Button
                        key={`${result.displayName}-${result.lat}-${result.lon}`}
                        type="button"
                        variant="ghost"
                        onClick={() => applyAddResult(result)}
                        className="h-auto w-full flex-col items-stretch justify-center gap-0.5 rounded-md px-2 py-2 text-left font-normal shadow-none"
                      >
                        <span className="truncate font-medium">
                          {result.displayName}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {[result.state, result.country]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </Button>
                    ))
                  ) : addSearch.searching ? (
                    <p className="px-2 py-1 text-xs text-muted-foreground">
                      {t("locations.searching")}
                    </p>
                  ) : (
                    <p className="px-2 py-1 text-xs text-muted-foreground">
                      {t("locations.noMatches")}
                    </p>
                  )}
                </div>
              ) : null}
              {addSearch.error ? (
                <p className="text-xs text-destructive">{addSearch.error}</p>
              ) : null}
            </div>
          ) : null}
        </FormStack>

        <FormDialogActions
          onConfirm={handleSave}
          confirmLabel={canEdit ? t("locations.save") : tCommon("close")}
          containerClassName="pt-0"
          secondaryAction={
            canEdit
              ? {
                  label: tCommon("cancel"),
                  onClick: () => onOpenChange(false),
                }
              : undefined
          }
        />
      </FormDialog>

      <FormDialog
        open={open && deleteConfirmIndex != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteConfirmIndex(null);
        }}
        title={t("locations.deleteConfirmTitle")}
        description={t("locations.deleteConfirmDescription", {
          name: deleteConfirmName,
        })}
        contentClassName="sm:max-w-md"
      >
        <FormDialogActions
          onConfirm={handleDeleteConfirm}
          confirmLabel={tCommon("delete")}
          confirmClassName={dialogPrimaryDestructiveClassName}
          secondaryAction={{
            label: tCommon("cancel"),
            onClick: () => setDeleteConfirmIndex(null),
          }}
        />
      </FormDialog>
    </>
  );
}
