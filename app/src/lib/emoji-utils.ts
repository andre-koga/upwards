/**
 * Extract the first emoji from a string.
 */
export function getFirstEmoji(str: string): string {
  if (!str) return "";
  const emojiRegex = /\p{Extended_Pictographic}/u;
  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
  for (const { segment } of segmenter.segment(str)) {
    if (emojiRegex.test(segment)) return segment;
  }
  return "";
}
