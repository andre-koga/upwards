import { Fragment, useEffect, useState } from "react";
import { Loader2, Search, Trash2 } from "lucide-react";
import { FormDialog, FormDialogActions, FormStack } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { JournalLocationRoute, LocationData } from "@/lib/db/types";
import { normalizeJournalLocationRoute, searchLocations } from "@/lib/journal";
import JournalLocationMapPicker from "./journal-location-map-picker";

interface JournalLocationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: JournalLocationRoute;
  canEdit: boolean;
  onSave: (route: JournalLocationRoute) => void;
}

const MAX_DAILY_LOCATIONS = 5;

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
  useEffect(() => {
    if (!open) return;
    setDraftRoute(normalizeJournalLocationRoute(route));
    setEditingIndex(null);
    setEditSearch(EMPTY_SEARCH);
    setAddSearch(EMPTY_SEARCH);
    setDeleteConfirmIndex(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only resync when opening
  }, [open]);

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
            error: "Could not search locations right now.",
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
  }, [open, canEdit, editingIndex, editSearch.query]);

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
            error: "Could not search locations right now.",
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
  }, [open, canEdit, addSearch.query]);

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
    setDraftRoute((prev) =>
      normalizeJournalLocationRoute({
        ...prev,
        locations: prev.locations.map((loc, idx) =>
          idx === targetIndex ? cleanedLocation : loc
        ),
      })
    );
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
    if (draftRoute.locations.length >= MAX_DAILY_LOCATIONS) return;
    const cleanedLocation = {
      ...location,
      displayName: location.displayName.trim(),
    };
    if (!cleanedLocation.displayName) return;
    setDraftRoute((prev) =>
      normalizeJournalLocationRoute({
        locations: [...prev.locations, cleanedLocation],
      })
    );
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
    const cleanedLocations = draftRoute.locations
      .map((loc) => ({
        ...loc,
        displayName: loc.displayName.trim(),
      }))
      .filter((loc) => loc.displayName.length > 0);
    onSave(
      normalizeJournalLocationRoute({
        locations: cleanedLocations,
      })
    );
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
        "this location"
      : "this location";

  const renderResults = (
    state: SearchState,
    onPick: (loc: LocationData) => void
  ) => {
    if (state.query.trim().length < 2) return null;
    return (
      <div className="max-h-36 space-y-1 overflow-y-auto">
        {state.results.length > 0 ? (
          state.results.map((result) => (
            <button
              key={`${result.displayName}-${result.lat}-${result.lon}`}
              type="button"
              onClick={() => onPick(result)}
              className="flex w-full flex-col rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
            >
              <span className="truncate font-medium">{result.displayName}</span>
              <span className="truncate text-xs text-muted-foreground">
                {[result.state, result.country].filter(Boolean).join(", ")}
              </span>
            </button>
          ))
        ) : state.searching ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            Searching...
          </p>
        ) : (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            No matches found.
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
        title="Locations visited"
        description={`Review and edit places tracked for this day (up to ${MAX_DAILY_LOCATIONS}).`}
        contentClassName="sm:max-w-md"
      >
        <FormStack className="space-y-2">
          <JournalLocationMapPicker
            locations={draftRoute.locations}
            readOnly
            className="h-44"
            ariaLabel="Map of locations visited"
          />

          {draftRoute.locations.length > 0 ? (
            <div className="space-y-2">
              {draftRoute.locations.map((loc, index) => (
                <Fragment
                  key={`${index}-${loc.displayName}-${loc.lat ?? ""}-${loc.lon ?? ""}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleEdit(index)}
                    disabled={!canEdit}
                    aria-pressed={editingIndex === index}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-2 py-1 text-left transition-colors hover:bg-accent/40 disabled:cursor-default disabled:hover:bg-transparent ${
                      editingIndex === index
                        ? "border-primary bg-accent/30"
                        : "border-border"
                    }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {loc.displayName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[loc.state, loc.country].filter(Boolean).join(", ") ||
                          "Manual stop"}
                      </span>
                    </span>
                  </button>

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
                            placeholder="Search to replace this location..."
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
                          className="h-9 w-9 shrink-0 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteConfirmIndex(index)}
                          title="Delete location"
                          aria-label="Delete location"
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
          ) : null}

          {canAddLocation && editingIndex == null ? (
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={addSearch.query}
                  onChange={(event) => handleAddQueryChange(event.target.value)}
                  placeholder="Search to add a location..."
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

          {draftRoute.locations.length === 0 && !canAddLocation ? (
            <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              No locations tracked yet.
            </p>
          ) : null}
        </FormStack>

        <FormDialogActions
          onConfirm={handleSave}
          confirmLabel={canEdit ? "Save locations" : "Close"}
          containerClassName="pt-0"
          secondaryAction={
            canEdit
              ? {
                  label: "Cancel",
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
        title="Delete location"
        description={
          <>
            Are you sure you want to delete &quot;{deleteConfirmName}&quot; from
            this day&apos;s route?
          </>
        }
        contentClassName="sm:max-w-md"
      >
        <FormDialogActions
          onConfirm={handleDeleteConfirm}
          confirmLabel="Delete"
          confirmClassName="bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90 focus-visible:ring-destructive"
          secondaryAction={{
            label: "Cancel",
            onClick: () => setDeleteConfirmIndex(null),
          }}
        />
      </FormDialog>
    </>
  );
}
