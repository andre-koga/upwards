import { useState } from "react";

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
                onBlur={() => { setTitleFocused(false); onBlur(); }}
                placeholder="Give this day a title…"
                className="w-full text-2xl font-bold text-center bg-transparent focus:outline-none placeholder:text-muted-foreground/50"
              />
              {titleFocused && (
                <p className="absolute bottom-0 right-0 text-xs text-muted-foreground">
                  {title.length}/{TITLE_LIMIT}
                </p>
              )}
            </div>
          ) : (
            <p className="text-2xl font-bold text-center">{title}</p>
          )}
        </div>
      )}

      {/* Reflection textarea */}
      {(canEdit || text) && (
        <div>
          {canEdit ? (
            <div className="relative pb-2">
              <textarea
                value={text}
                maxLength={TEXT_LIMIT}
                rows={3}
                onChange={(e) => onTextChange(e.target.value)}
                onFocus={() => setTextFocused(true)}
                onBlur={() => { setTextFocused(false); onBlur(); }}
                placeholder="Write your thoughts for the day…"
                className="w-full resize-none bg-transparent focus:outline-none text-sm leading-relaxed placeholder:text-muted-foreground/50 text-center"
              />
              {textFocused && (
                <p className="absolute bottom-0 right-0 text-xs text-muted-foreground">
                  {text.length}/{TEXT_LIMIT}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {text}
            </p>
          )}
        </div>
      )}
    </>
  );
}
