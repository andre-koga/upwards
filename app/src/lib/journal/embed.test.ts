import { describe, expect, it } from "vitest";
import {
  JOURNAL_EMBED_URL_LIMIT,
  journalEmbedInputLooksSet,
  normalizeJournalEmbedInput,
  parseJournalEmbed,
} from "./embed";

describe("normalizeJournalEmbedInput", () => {
  it("extracts the src from a pasted iframe snippet", () => {
    expect(
      normalizeJournalEmbedInput(
        `<iframe style="border-radius:12px" src="https://open.spotify.com/embed/track/4cOdK2wGLETkXbDXpjN8eu?utm_source=generator" width="100%" height="152" frameBorder="0" allow="autoplay"></iframe>`
      )
    ).toBe(
      "https://open.spotify.com/embed/track/4cOdK2wGLETkXbDXpjN8eu?utm_source=generator"
    );
  });

  it("decodes HTML entities in iframe src", () => {
    expect(
      normalizeJournalEmbedInput(
        `<iframe src="https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fartist%2Ftrack&amp;auto_play=false"></iframe>`
      )
    ).toBe(
      "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fartist%2Ftrack&auto_play=false"
    );
  });

  it("trims and caps length", () => {
    expect(
      normalizeJournalEmbedInput("  https://open.spotify.com/track/abc  ")
    ).toBe("https://open.spotify.com/track/abc");
    expect(
      normalizeJournalEmbedInput("x".repeat(JOURNAL_EMBED_URL_LIMIT + 20))
    ).toHaveLength(JOURNAL_EMBED_URL_LIMIT);
  });

  it("returns empty for blank input", () => {
    expect(normalizeJournalEmbedInput("   ")).toBe("");
    expect(journalEmbedInputLooksSet("   ")).toBe(false);
  });
});

describe("parseJournalEmbed", () => {
  it("embeds Spotify tracks, playlists, and intl URLs", () => {
    expect(
      parseJournalEmbed(
        "https://open.spotify.com/track/4cOdK2wGLETkXbDXpjN8eu?si=abc"
      )
    ).toEqual({
      provider: "spotify",
      embedSrc: "https://open.spotify.com/embed/track/4cOdK2wGLETkXbDXpjN8eu",
      layout: { kind: "compact", height: 152 },
    });

    expect(
      parseJournalEmbed(
        "https://open.spotify.com/intl-pt/playlist/37i9dQZF1DXcBWIGoYBM5M"
      )
    ).toEqual({
      provider: "spotify",
      embedSrc:
        "https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M",
      layout: { kind: "tall", height: 352 },
    });

    expect(parseJournalEmbed("spotify:track:4cOdK2wGLETkXbDXpjN8eu")).toEqual({
      provider: "spotify",
      embedSrc: "https://open.spotify.com/embed/track/4cOdK2wGLETkXbDXpjN8eu",
      layout: { kind: "compact", height: 152 },
    });
  });

  it("embeds YouTube watch, short, and share URLs", () => {
    const expected = {
      provider: "youtube",
      embedSrc: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      layout: { kind: "video" },
    };
    expect(
      parseJournalEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    ).toEqual(expected);
    expect(parseJournalEmbed("https://youtu.be/dQw4w9WgXcQ")).toEqual(expected);
    expect(
      parseJournalEmbed("https://www.youtube.com/shorts/dQw4w9WgXcQ")
    ).toEqual(expected);
    expect(
      parseJournalEmbed("https://www.youtube.com/embed/dQw4w9WgXcQ")
    ).toEqual(expected);
  });

  it("embeds Vimeo, SoundCloud, and Apple Music links", () => {
    expect(parseJournalEmbed("https://vimeo.com/123456789")).toEqual({
      provider: "vimeo",
      embedSrc: "https://player.vimeo.com/video/123456789",
      layout: { kind: "video" },
    });

    expect(
      parseJournalEmbed("https://soundcloud.com/artist/some-track")
    ).toEqual({
      provider: "soundcloud",
      embedSrc:
        "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fartist%2Fsome-track&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false",
      layout: { kind: "compact", height: 166 },
    });

    expect(
      parseJournalEmbed("https://music.apple.com/us/song/anti-hero/1649842539")
    ).toEqual({
      provider: "apple-music",
      embedSrc: "https://embed.music.apple.com/us/song/anti-hero/1649842539",
      layout: { kind: "compact", height: 175 },
    });
  });

  it("rejects javascript URLs and unknown hosts", () => {
    expect(parseJournalEmbed("javascript:alert(1)")).toBeNull();
    expect(parseJournalEmbed("https://evil.example/embed/x")).toBeNull();
    expect(
      parseJournalEmbed("https://open.spotify.com/user/someone")
    ).toBeNull();
  });
});
