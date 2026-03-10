import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Extract YouTube video ID and return embed URL, or null if invalid.
 */
export function getYoutubeEmbedUrl(url: string): string | null {
    if (!url.trim()) return null;
    const short = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
    if (short) return `https://www.youtube.com/embed/${short[1]}`;
    const long = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (long) return `https://www.youtube.com/embed/${long[1]}`;
    const embed = url.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/);
    if (embed) return `https://www.youtube.com/embed/${embed[1]}`;
    return null;
}

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
