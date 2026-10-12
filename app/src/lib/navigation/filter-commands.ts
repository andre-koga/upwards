export interface SearchableCommand {
  label: string;
  keywords?: readonly string[];
}

function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Filters and ranks palette commands. Every word typed must appear in the
 * label or a keyword (accents ignored, so "diario" finds "Diário"). Labels that
 * start with the query come first; otherwise the original order is kept.
 */
export function filterCommands<T extends SearchableCommand>(
  commands: readonly T[],
  query: string
): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...commands];

  const scored: { command: T; rank: number; index: number }[] = [];
  commands.forEach((command, index) => {
    const label = fold(command.label);
    const haystack = [label, ...(command.keywords ?? []).map(fold)].join(" ");
    if (!words.every((word) => haystack.includes(word))) return;
    const rank = label.startsWith(words[0]) ? 0 : 1;
    scored.push({ command, rank, index });
  });
  scored.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return scored.map((entry) => entry.command);
}
