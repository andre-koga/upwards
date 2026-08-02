import { Fragment, useEffect, useState } from "react";
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
import { cn } from "@/lib/utils";
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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editSearch, setEditSearch] = useState<SearchState>(EMPTY_SEARCH);
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
      setEditingIndex(null);
      setEditSearch(EMPTY_SEARCH);
      setAddSearch(EMPTY_SEARCH);
      setDeleteConfirmIndex(null);
    }
  }

  useEffect(() => {
    if (!open || editingIndex === null || !canEdit) return;
    const trimmed = editSearch.query.trim();
    if (trimmed.length < 2) return;

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setEditSearch((prev) => ({ ...prev, searching: true }));
      searchLocations(trimmed)
        .then((matches) => {
          if (cancelled) return;
          setEditSearch((prev) => ({ ...prev, results: matches, error: null }));
        })
        .catch(() => {
          if (cancelled) return;
          setEditSearch((prev) => ({
            ...prev,
            results: [],
            error: t("locations.searchError"),
          }));
        })
        .finally(() => {
          if (!cancelled) {
            setEditSearch((prev) => ({ ...prev, searching: false }));
          }
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [open, canEdit, editingIndex, editSearch.query, t]);

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

  const toggleEdit = (index: number) => {
    if (!canEdit) return;
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditSearch(EMPTY_SEARCH);
      return;
    }
    setEditingIndex(index);
    setEditSearch(EMPTY_SEARCH);
  };

  const handleEditQueryChange = (value: string) => {
    setEditSearch((prev) => ({
      ...prev,
      query: value,
      results: value.trim().length < 2 ? [] : prev.results,
      searching: value.trim().length < 2 ? false : prev.searching,
    }));
  };

  const applyEditResult = (location: LocationData) => {
    if (editingIndex === null) return;
    const cleanedLocation = {
      ...location,
      displayName: location.displayName.trim(),
    };
    if (!cleanedLocation.displayName) return;
    const targetIndex = editingIndex;
    setDraftRoute((prev) => {
      const without = {
        locations: prev.locations.filter((_, idx) => idx !== targetIndex),
      };
      return mergeJournalLocationRoute(without, cleanedLocation);
    });
    setEditingIndex(null);
    setEditSearch(EMPTY_SEARCH);
  };

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
    setEditingIndex(null);
    setEditSearch(EMPTY_SEARCH);
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

  const renderResults = (
    state: SearchState,
    onPick: (loc: LocationData) => void
  ) => {
    if (state.query.trim().length < 2) return null;
    return (
      <div className="max-h-36 space-y-1 overflow-y-auto">
        {state.results.length > 0 ? (
          state.results.map((result) => (
            <Button
              key={`${result.displayName}-${result.lat}-${result.lon}`}
              type="button"
              variant="ghost"
              onClick={() => onPick(result)}
              className="h-auto w-full flex-col items-stretch justify-center gap-0.5 rounded-md px-2 py-2 text-left font-normal shadow-none"
            >
              <span className="truncate font-medium">{result.displayName}</span>
              <span className="truncate text-xs text-muted-foreground">
                {[result.state, result.country].filter(Boolean).join(", ")}
              </span>
            </Button>
          ))
        ) : state.searching ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            {t("locations.searching")}
          </p>
        ) : (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            {t("locations.noMatches")}
          </p>
        )}
      </div>
    );
  };

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
                <Fragment
                  key={`${index}-${loc.displayName}-${loc.lat ?? ""}-${loc.lon ?? ""}`}
                >
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => toggleEdit(index)}
                    disabled={!canEdit}
                    aria-pressed={editingIndex === index}
                    className={cn(
                      "h-auto min-h-0 w-full justify-start gap-2.5 rounded-lg py-1.5 pl-2 pr-2 text-left font-normal shadow-none",
                      editingIndex === index
                        ? "border-primary bg-muted"
                        : "border-border"
                    )}
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
                  </Button>

                  {editingIndex === index ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            autoFocus
                            value={editSearch.query}
                            onChange={(event) =>
                              handleEditQueryChange(event.target.value)
                            }
                            placeholder={t(
                              "locations.searchReplacePlaceholder"
                            )}
                            className="pl-9"
                            disabled={!canEdit}
                          />
                          {editSearch.searching ? (
                            <Loader2
                              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
                              aria-hidden
                            />
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0 border-destructive text-destructive"
                          onClick={() => setDeleteConfirmIndex(index)}
                          title={t("locations.deleteLocation")}
                          aria-label={t("locations.deleteLocation")}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                      {renderResults(editSearch, applyEditResult)}
                      {editSearch.error ? (
                        <p className="text-xs text-destructive">
                          {editSearch.error}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </Fragment>
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

          {canAddLocation && editingIndex == null ? (
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
              {renderResults(addSearch, applyAddResult)}
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
