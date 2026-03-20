/**
 * SRP: Renders journal title and reflection text in read-only form.
 */

interface JournalTextSectionProps {
  title: string;
  text: string;
}

export default function JournalTextSection({
  title,
  text,
}: JournalTextSectionProps) {
  return (
    <>
      <p
        className={`text-left font-crimson text-3xl font-bold ${
          title ? "" : "text-muted-foreground/30"
        }`}
      >
        {title || "Untitled"}
      </p>

      <p
        className={`w-full whitespace-pre-wrap text-left font-crimson text-base leading-relaxed ${
          text ? "text-muted-foreground" : "italic text-muted-foreground/30"
        }`}
      >
        {text || "No reflection written."}
      </p>
    </>
  );
}
