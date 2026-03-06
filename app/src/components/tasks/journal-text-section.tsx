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
  return (
    <>
      {/* Title */}
      {(canEdit || title) && (
        <div>
          {canEdit ? (
            <div className="relative">
              <input
                type="text"
                value={title}
                maxLength={TITLE_LIMIT}
                onChange={(e) => onTitleChange(e.target.value)}
                onBlur={onBlur}
                placeholder="Give this day a title…"
                className="w-full text-xl font-semibold bg-transparent focus:outline-none placeholder:text-muted-foreground/50 pr-12"
              />
              <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {title.length}/{TITLE_LIMIT}
              </span>
            </div>
          ) : (
            <p className="text-xl font-semibold">{title}</p>
          )}
        </div>
      )}

      {/* Reflection textarea */}
      {(canEdit || text) && (
        <div>
          {canEdit ? (
            <div className="relative">
              <textarea
                value={text}
                maxLength={TEXT_LIMIT}
                rows={3}
                onChange={(e) => onTextChange(e.target.value)}
                onBlur={onBlur}
                placeholder="Write your thoughts for the day…"
                className="w-full resize-none bg-transparent focus:outline-none text-sm leading-relaxed placeholder:text-muted-foreground/50"
              />
              <span className="text-xs text-muted-foreground float-right">
                {text.length}/{TEXT_LIMIT}
              </span>
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
