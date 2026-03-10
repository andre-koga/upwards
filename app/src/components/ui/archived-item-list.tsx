import { Button } from "@/components/ui/button";
import { ArchiveRestore, Trash2 } from "lucide-react";

interface ArchivedItemListProps<T> {
  items: T[];
  emptyMessage: string;
  renderItemContent: (item: T) => React.ReactNode;
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
  getItemId: (item: T) => string;
  unarchiveTitle?: string;
  deleteTitle?: string;
}

export function ArchivedItemList<T>({
  items,
  emptyMessage,
  renderItemContent,
  onUnarchive,
  onDelete,
  getItemId,
  unarchiveTitle = "Unarchive",
  deleteTitle = "Permanently delete",
}: ArchivedItemListProps<T>) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const id = getItemId(item);
        return (
          <div
            key={id}
            className="flex items-center justify-between p-3 border rounded-md"
          >
            <div className="flex-1">{renderItemContent(item)}</div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onUnarchive(id)}
                title={unarchiveTitle}
              >
                <ArchiveRestore className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onDelete(id)}
                title={deleteTitle}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
