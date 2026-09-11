import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { AppPageShell } from "@/components/layout/app-page-shell";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { MemoryEditDialog } from "@/components/memories/memory-edit-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmFormDialog } from "@/components/forms";
import { db, newId, now } from "@/lib/db";
import type { Memory } from "@/lib/db/types";
import { sortMemories } from "@/lib/memories";
import {
  getMemoryPhotoUrl,
  deleteMemoryPhoto,
} from "@/lib/memory-photo-storage";
import { eraseMemory, saveMemory } from "@/lib/sync/mutate-synced";

function MemoryCard({
  memory,
  onEdit,
  onTrash,
}: {
  memory: Memory;
  onEdit: () => void;
  onTrash: () => void;
}) {
  const { t } = useTranslation("memories");
  return (
    <article className="space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-sm font-medium leading-none">
          {memory.time_label || t("untitled")}
        </p>
        <div className="-mr-1.5 -mt-1.5 flex shrink-0 items-center gap-0">
          <Button
            variant="ghost"
            size="smIcon"
            onClick={onEdit}
            aria-label={t("edit")}
            className="text-muted-foreground"
          >
            <Pencil className="size-3" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="smIcon"
            onClick={onTrash}
            aria-label={t("trashMemory")}
            className="text-muted-foreground"
          >
            <Trash2 className="size-3" aria-hidden />
          </Button>
        </div>
      </div>
      {memory.text_content ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {memory.text_content}
        </p>
      ) : null}
      {memory.photo_paths?.length ? (
        <div className="flex gap-2 overflow-x-auto">
          {memory.photo_paths.map((path, index) => (
            <img
              key={path}
              src={getMemoryPhotoUrl(path) ?? ""}
              alt={t("photoAlt", { index: index + 1 })}
              className="h-20 w-20 shrink-0 rounded-lg object-cover"
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default function MemoriesPage() {
  const { t } = useTranslation("memories");
  const { t: tNav } = useTranslation("nav");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Memory | null | undefined>(undefined);
  const [permanent, setPermanent] = useState<Memory | null>(null);
  useEffect(() => {
    void db.memories.toArray().then(setMemories);
  }, []);
  const filtered = useMemo(
    () =>
      memories.filter((memory) =>
        `${memory.text_content ?? ""} ${memory.time_label ?? ""}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      ),
    [memories, query]
  );
  const active = useMemo(() => sortMemories(filtered), [filtered]);
  const trashed = filtered.filter((memory) => Boolean(memory.deleted_at));
  const refresh = () => void db.memories.toArray().then(setMemories);
  const save = async (
    values: Pick<Memory, "text_content" | "photo_paths" | "time_label">
  ) => {
    if (!editing) return;
    const timestamp = now();
    const memory: Memory = { ...editing, ...values, updated_at: timestamp };
    await saveMemory(memory, editing.updated_at);
    refresh();
  };
  const trash = async (memory: Memory) => {
    await saveMemory(
      { ...memory, deleted_at: now(), updated_at: now() },
      memory.updated_at
    );
    refresh();
  };
  const restore = async (memory: Memory) => {
    await saveMemory(
      { ...memory, deleted_at: null, updated_at: now() },
      memory.updated_at
    );
    refresh();
  };
  const erase = async () => {
    if (!permanent) return;
    await Promise.all(
      (permanent.photo_paths ?? []).map((path) => deleteMemoryPhoto(path))
    );
    await eraseMemory(permanent);
    refresh();
    setPermanent(null);
  };
  const addMemory = () =>
    setEditing({
      id: newId(),
      text_content: null,
      photo_paths: null,
      time_label: null,
      created_at: now(),
      updated_at: now(),
      synced_at: null,
      deleted_at: null,
    });
  return (
    <AppPageShell
      title={t("title")}
      subtitle={t("subtitle")}
      className="space-y-4"
    >
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 rounded-xl pl-9 pr-10"
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
        />
        {query ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full"
            onClick={() => setQuery("")}
            title={t("clearSearch")}
            aria-label={t("clearSearch")}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      {active.length ? (
        <section className="space-y-2">
          {active.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onEdit={() => setEditing(memory)}
              onTrash={() => void trash(memory)}
            />
          ))}
        </section>
      ) : (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      )}
      {trashed.length ? (
        <section className="space-y-2 border-t pt-4">
          <h2 className="text-sm font-semibold">{t("trash.title")}</h2>
          {trashed.map((memory) => (
            <div
              key={memory.id}
              className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm"
            >
              <span className="truncate">
                {memory.time_label ||
                  memory.text_content ||
                  t("trash.fallbackLabel")}
              </span>
              <span className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void restore(memory)}
                >
                  {t("trash.restore")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPermanent(memory)}
                >
                  {t("trash.deletePermanently")}
                </Button>
              </span>
            </div>
          ))}
        </section>
      ) : null}
      <MemoryEditDialog
        open={editing !== undefined}
        memory={editing ?? null}
        onOpenChange={(open) => !open && setEditing(undefined)}
        onSave={save}
      />
      <ConfirmFormDialog
        open={Boolean(permanent)}
        onOpenChange={(open) => !open && setPermanent(null)}
        title={t("trash.confirmTitle")}
        message={t("trash.confirmMessage")}
        confirmLabel={t("trash.deletePermanently")}
        destructive
        onConfirm={() => void erase()}
      />
      <FloatingBackButton to="/" title={tNav("home")} />
      <Button
        type="button"
        variant="default"
        size="floatingNav"
        className="fixed bottom-3 right-4 z-50 shadow-md"
        onClick={addMemory}
        title={t("add")}
        aria-label={t("add")}
      >
        <Plus className="h-5 w-5" aria-hidden />
      </Button>
    </AppPageShell>
  );
}
