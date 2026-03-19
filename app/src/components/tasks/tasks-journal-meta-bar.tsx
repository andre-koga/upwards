/**
 * SRP: Today page divider bar — manual location, centered date label, bookmark control.
 */
import { Heart, MapPin, MapPinOff, RotateCw } from "lucide-react";
import type { UseJournalEntryReturn } from "@/components/tasks/hooks/use-journal-entry";

type Journal = UseJournalEntryReturn;

interface TasksJournalMetaBarProps {
  currentDate: Date;
  journal: Journal;
  draftRef: Journal["draftRef"];
  showLocationInput: boolean;
  setShowLocationInput: (v: boolean) => void;
  locationInputVal: string;
  setLocationInputVal: (v: string) => void;
  detectLocation: (force?: boolean) => void;
  isDetectingLocation: boolean;
}

export default function TasksJournalMetaBar({
  currentDate,
  journal,
  draftRef,
  showLocationInput,
  setShowLocationInput,
  locationInputVal,
  setLocationInputVal,
  detectLocation,
  isDetectingLocation,
}: TasksJournalMetaBarProps) {
  return (
    <div className="py-3">
      <div className="relative border-t border-border">
        <div className="absolute inset-x-0 -top-3.5 grid grid-cols-3 items-center gap-1 px-0">
          <div className="flex justify-start">
            {showLocationInput ? (
              <input
                autoFocus
                value={locationInputVal}
                onChange={(e) =>
                  setLocationInputVal(
                    e.target.value.replace(/\b\w/g, (c) => c.toUpperCase())
                  )
                }
                onBlur={() => {
                  const name = locationInputVal.trim();
                  const locationData = name
                    ? {
                        displayName: name,
                        city: name,
                        state: null,
                        country: null,
                        countryCode: null,
                        lat: null,
                        lon: null,
                      }
                    : null;
                  journal.setDraftLocation(locationData);
                  draftRef.current.location = locationData;
                  journal.saveLocation(locationData);
                  setShowLocationInput(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape")
                    e.currentTarget.blur();
                }}
                placeholder="City, State"
                className="w-28 rounded-full border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            ) : (
              <div className="flex items-center rounded-full bg-background pr-1">
                <button
                  onClick={() => {
                    if (!journal.canEditJournal) return;
                    setLocationInputVal(
                      journal.draftLocation?.displayName ?? ""
                    );
                    setShowLocationInput(true);
                  }}
                  disabled={!journal.canEditJournal}
                  className="flex items-center gap-1 rounded-full bg-background py-1 pl-3 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-70"
                  title="Set location"
                >
                  {(journal.canEditJournal && isDetectingLocation) ||
                  journal.draftLocation ? (
                    <>
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="max-w-[80px] truncate">
                        {journal.canEditJournal && isDetectingLocation
                          ? "Detecting"
                          : journal.draftLocation?.displayName}
                      </span>
                    </>
                  ) : (
                    <>
                      <MapPinOff className="h-3 w-3 shrink-0" />
                      <span>None</span>
                    </>
                  )}
                </button>

                {journal.canEditJournal && (
                  <button
                    type="button"
                    onClick={() => detectLocation(true)}
                    disabled={isDetectingLocation}
                    className="mb-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-background text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                    title="Retry location detection"
                  >
                    <RotateCw
                      className={`h-3 w-3 ${isDetectingLocation ? "animate-spin" : ""}`}
                    />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <span className="bg-background px-2 font-crimson text-xl uppercase tracking-widest text-muted-foreground/70">
              {currentDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => {
                const next = !journal.draftBookmarked;
                journal.setDraftBookmarked(next);
                draftRef.current.bookmarked = next;
                journal.saveBookmark(next);
              }}
              className={`flex items-center gap-1.5 rounded-full bg-background px-3 py-1 text-xs text-muted-foreground transition-colors ${
                journal.draftBookmarked ? "" : "hover:text-foreground"
              }`}
              title={
                journal.draftBookmarked
                  ? "Remove bookmark"
                  : "Bookmark this day"
              }
            >
              <Heart
                className={`h-3 w-3 ${
                  journal.draftBookmarked ? "text-red-500" : ""
                }`}
                fill={journal.draftBookmarked ? "currentColor" : "none"}
              />
              {journal.draftBookmarked ? "Saved!" : "Save"}
            </button>
          </div>
        </div>
        <div className="h-4" />
      </div>
    </div>
  );
}
