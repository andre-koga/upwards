"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Pencil,
  BookmarkIcon,
  Image as ImageIcon,
} from "lucide-react";
import { Tables } from "@/lib/supabase/types";

type JournalEntry = Tables<"journal_entries">;

interface JournalViewProps {
  entry: JournalEntry;
  canEdit: boolean;
}

const QUALITY_OPTIONS = [
  { value: 1, label: "Bad", emoji: "😞" },
  { value: 2, label: "Poor", emoji: "😕" },
  { value: 3, label: "Okay", emoji: "😐" },
  { value: 4, label: "Good", emoji: "😊" },
  { value: 5, label: "Great", emoji: "🤩" },
];

export default function JournalView({ entry, canEdit }: JournalViewProps) {
  const router = useRouter();
  const supabase = createClient();
  const [photoSignedUrls, setPhotoSignedUrls] = useState<string[]>([]);
  const [videoSignedUrl, setVideoSignedUrl] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadPhotos = async () => {
      if (!entry.photo_urls?.length) return;
      const urls: string[] = [];
      for (const path of entry.photo_urls) {
        const { data } = await supabase.storage
          .from("journal-photos")
          .createSignedUrl(path, 3600);
        if (data?.signedUrl) urls.push(data.signedUrl);
      }
      setPhotoSignedUrls(urls);
    };
    loadPhotos();
  }, [entry.photo_urls]);

  useEffect(() => {
    if (!entry.video_url) return;
    supabase.storage
      .from("journal-videos")
      .createSignedUrl(entry.video_url, 3600)
      .then(({ data }) => setVideoSignedUrl(data?.signedUrl ?? null));
  }, [entry.video_url]);

  const qualityOption = QUALITY_OPTIONS.find(
    (o) => o.value === entry.day_quality,
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      main: date.toLocaleDateString("en-US", { month: "long", day: "numeric" }),
      weekday: date.toLocaleDateString("en-US", { weekday: "long" }),
      full: date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    };
  };

  const { main, weekday } = formatDate(entry.entry_date!);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/journal")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Journal
        </Button>
        <div className="flex items-center gap-2">
          {entry.is_bookmarked && (
            <BookmarkIcon className="h-4 w-4 fill-current text-primary" />
          )}
          {canEdit && (
            <Button
              variant="default"
              size="sm"
              onClick={() =>
                router.push(`/journal/${entry.entry_date}?edit=true`)
              }
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit Entry
            </Button>
          )}
        </div>
      </div>

      {/* Date + Emoji hero */}
      <div className="flex flex-col items-center gap-3 pt-8">
        <div className="w-36 h-36 rounded-full border-2 border-border flex items-center justify-center text-7xl bg-background shadow-sm">
          {entry.day_emoji || "📅"}
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold">{main}</h1>
          <p className="text-muted-foreground">{weekday}</p>
        </div>
        {qualityOption && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-xl">{qualityOption.emoji}</span>
            <span>{qualityOption.label} day</span>
          </div>
        )}
      </div>

      {/* Title */}
      {entry.title && (
        <div className="text-center">
          <h2 className="text-xl font-semibold">{entry.title}</h2>
        </div>
      )}

      {/* Text content */}
      {entry.text_content && (
        <div className="rounded-xl bg-muted/50 p-5 whitespace-pre-wrap leading-relaxed text-base">
          {entry.text_content}
        </div>
      )}

      {/* Photos */}
      {photoSignedUrls.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Photos ({photoSignedUrls.length})
          </p>
          <div className="grid grid-cols-2 gap-3">
            {photoSignedUrls.map((url, i) => (
              <button
                key={i}
                onClick={() => setLightboxUrl(url)}
                className="aspect-square rounded-lg overflow-hidden border bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <img
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className="w-full h-full object-cover hover:scale-105 transition-transform"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Video */}
      {videoSignedUrl && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Video</p>
          <video
            src={videoSignedUrl}
            controls
            className="w-full rounded-xl border"
            preload="metadata"
          />
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-w-full max-h-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
