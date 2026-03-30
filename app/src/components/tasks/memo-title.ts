import { MEMO_TITLE_LIMIT } from "@/lib/constants";

export { MEMO_TITLE_LIMIT };

export function normalizeMemoTitle(title: string): string {
  return title.trim().slice(0, MEMO_TITLE_LIMIT);
}
