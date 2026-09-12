import { cn } from "@/lib/utils";
import { parseJournalEmbed } from "@/lib/journal/embed";

interface JournalEmbedFrameProps {
  url: string;
  title: string;
  className?: string;
}

export default function JournalEmbedFrame({
  url,
  title,
  className,
}: JournalEmbedFrameProps) {
  const embed = parseJournalEmbed(url);
  if (!embed) return null;

  const sized =
    embed.layout.kind === "video" ? "aspect-video w-full" : "w-full";
  const height =
    embed.layout.kind === "video" ? undefined : embed.layout.height;

  return (
    <iframe
      src={embed.embedSrc}
      title={title}
      className={cn(
        "block overflow-hidden rounded-xl border-0",
        sized,
        className
      )}
      height={height}
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
