export const MEMO_TITLE_LIMIT = 200;

export function normalizeMemoTitle(title: string): string {
  return title.trim().slice(0, MEMO_TITLE_LIMIT);
}
