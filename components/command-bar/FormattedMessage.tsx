import React from "react";

interface FormattedMessageProps {
  text: string;
  role: "user" | "assistant";
  isStreaming?: boolean;
}

/**
 * Render inline markdown tokens: **bold**, *italic*, and `code`
 */
function renderInlineTokens(text: string, isUser: boolean): React.ReactNode[] {
  // Regex to match **bold**, *italic*, `code`
  const tokenRegex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      const content = part.slice(2, -2);
      return (
        <strong
          key={index}
          className={
            isUser
              ? "font-bold text-white tracking-tight"
              : "font-semibold text-slate-900 dark:text-white"
          }
        >
          {content}
        </strong>
      );
    }

    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      const content = part.slice(1, -1);
      return (
        <em key={index} className="italic">
          {content}
        </em>
      );
    }

    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      const content = part.slice(1, -1);
      return (
        <code
          key={index}
          className={
            isUser
              ? "font-mono text-[11px] px-1.5 py-0.5 rounded bg-white/20 text-white"
              : "font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700/80 text-slate-900 dark:text-slate-100 border border-slate-300/40 dark:border-slate-650"
          }
        >
          {content}
        </code>
      );
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

/**
 * Clean, lightweight markdown renderer for Command Bar responses.
 * Renders paragraphs, lists, and inline styles without heavy external dependencies.
 */
export function FormattedMessage({
  text,
  role,
  isStreaming,
}: FormattedMessageProps) {
  const isUser = role === "user";

  if (!text) {
    return isStreaming ? (
      <span className="inline-block h-3.5 w-1 bg-[#107e65] dark:bg-[#34d399] animate-pulse ml-0.5 align-middle" />
    ) : null;
  }

  // Split lines while preserving structure
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5 text-xs leading-relaxed break-words">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();

        // Empty line spacer
        if (!trimmed) {
          return <div key={lineIdx} className="h-1" />;
        }

        // Bullet point list item (- or *)
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const itemText = trimmed.slice(2);
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-1 my-0.5">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${
                  isUser ? "bg-white" : "bg-[#107e65] dark:bg-[#34d399]"
                }`}
              />
              <span className="flex-1">
                {renderInlineTokens(itemText, isUser)}
                {isStreaming && lineIdx === lines.length - 1 && (
                  <span className="inline-block h-3.5 w-1 bg-[#107e65] dark:bg-[#34d399] animate-pulse ml-1 align-middle" />
                )}
              </span>
            </div>
          );
        }

        // Numbered list item (e.g. 1. , 2. )
        const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numberedMatch) {
          const num = numberedMatch[1];
          const itemText = numberedMatch[2];
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-1 my-0.5">
              <span
                className={`font-mono text-[10px] font-bold mt-0.5 shrink-0 ${
                  isUser
                    ? "text-white/80"
                    : "text-[#107e65] dark:text-[#34d399]"
                }`}
              >
                {num}.
              </span>
              <span className="flex-1">
                {renderInlineTokens(itemText, isUser)}
                {isStreaming && lineIdx === lines.length - 1 && (
                  <span className="inline-block h-3.5 w-1 bg-[#107e65] dark:bg-[#34d399] animate-pulse ml-1 align-middle" />
                )}
              </span>
            </div>
          );
        }

        // Standard paragraph line
        return (
          <p key={lineIdx} className="whitespace-pre-wrap">
            {renderInlineTokens(line, isUser)}
            {isStreaming && lineIdx === lines.length - 1 && (
              <span className="inline-block h-3.5 w-1 bg-[#107e65] dark:bg-[#34d399] animate-pulse ml-1 align-middle" />
            )}
          </p>
        );
      })}
    </div>
  );
}
