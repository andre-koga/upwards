import { useState, useRef, useEffect } from "react";

const TITLE_LIMIT = 30;
const TEXT_LIMIT = 300;

interface JournalTextSectionProps {
  canEdit: boolean;
  title: string;
  text: string;
  onTitleChange: (val: string) => void;
  onTextChange: (val: string) => void;
  onBlur: () => void;
}

export default function JournalTextSection({
  canEdit,
  title,
  text,
  onTitleChange,
  onTextChange,
  onBlur,
}: JournalTextSectionProps) {
  const [titleFocused, setTitleFocused] = useState(false);
  const [textFocused, setTextFocused] = useState(false);
  const [textExpanded, setTextExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textDisplayRef = useRef<HTMLParagraphElement>(null);
  const [isClamped, setIsClamped] = useState(false);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  // Detect overflow on read-only display (only for non-editable days)
  useEffect(() => {
    const el = textDisplayRef.current;
    if (!el) return;
    setIsClamped(el.scrollHeight > el.clientHeight);
  }, [text]);

  return (
    <>
      {/* Title */}
      {(canEdit || title) && (
        <div>
          {canEdit ? (
            <div className="relative pb-2">
              <input
                type="text"
                value={title}
                maxLength={TITLE_LIMIT}
                onChange={(e) => onTitleChange(e.target.value)}
                onFocus={() => setTitleFocused(true)}
                onBlur={() => {
                  setTitleFocused(false);
                  onBlur();
                }}
                placeholder="Give this day a title…"
                className="w-full text-3xl font-bold text-center bg-transparent focus:outline-none placeholder:text-muted-foreground/50 font-crimson"
              />
              {titleFocused && (
                <p className="absolute bottom-0 right-0 text-xs text-muted-foreground">
                  {title.length}/{TITLE_LIMIT}
                </p>
              )}
            </div>
          ) : (
            <p className="text-3xl font-bold text-center font-crimson">
              {title}
            </p>
          )}
        </div>
      )}

      {/* Reflection */}
      {(canEdit || text) && (
        <div>
          {canEdit ? (
            // Editable days: always a plain auto-growing textarea
            <div className="relative pb-4">
              <textarea
                ref={textareaRef}
                value={text}
                maxLength={TEXT_LIMIT}
                rows={1}
                onChange={(e) => onTextChange(e.target.value)}
                onFocus={() => setTextFocused(true)}
                onBlur={() => {
                  setTextFocused(false);
                  onBlur();
                }}
                placeholder="Write your thoughts for the day…"
                className="w-full resize-none bg-transparent focus:outline-none text-base leading-relaxed placeholder:text-muted-foreground/50 text-center font-crimson"
              />
              {textFocused && (
                <p className="absolute bottom-0 right-0 text-xs text-muted-foreground">
                  {text.length}/{TEXT_LIMIT}
                </p>
              )}
            </div>
          ) : (
            // Read-only days: clamped with "Read more"
            <div>
              <p
                ref={textDisplayRef}
                className={`text-base leading-relaxed text-muted-foreground whitespace-pre-wrap text-center font-crimson ${
                  !textExpanded ? "line-clamp-4" : ""
                }`}
              >
                {text}
              </p>
              {(isClamped || textExpanded) && (
                <button
                  onClick={() => setTextExpanded((v) => !v)}
                  className="mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {textExpanded ? "Read less" : "Read more"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
