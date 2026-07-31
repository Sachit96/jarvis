import { Fragment } from "react";

/** Renders `**bold**` and `` `code` `` spans within a line; everything else as plain text. */
function renderInline(text: string, key: number) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <Fragment key={key}>
      {parts.map((part, i) => {
        const bold = part.match(/^\*\*(.+)\*\*$/);
        if (bold) return <strong key={i} className="font-semibold text-foreground">{bold[1]}</strong>;
        const code = part.match(/^`(.+)`$/);
        if (code) return <code key={i} className="rounded bg-white/[0.08] px-1 py-0.5 font-mono text-[0.85em]">{code[1]}</code>;
        return <span key={i}>{part}</span>;
      })}
    </Fragment>
  );
}

function renderTable(lines: string[], key: number) {
  const rows = lines
    .filter((l) => !/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(l))
    .map((l) => l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
  const [header, ...body] = rows;
  return (
    <div key={key} className="overflow-x-auto rounded-lg ring-1 ring-border">
      <table className="w-full text-left text-body">
        {header ? (
          <thead>
            <tr className="border-b border-border">
              {header.map((cell, i) => (
                <th key={i} className="whitespace-nowrap px-3 py-1.5 font-medium text-foreground">
                  {renderInline(cell, i)}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {body.map((row, r) => (
            <tr key={r} className="border-b border-border/50 last:border-0">
              {row.map((cell, c) => (
                <td key={c} className="px-3 py-1.5 text-muted-foreground">
                  {renderInline(cell, c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A small, dependency-free markdown renderer — headings, bold/code spans, lists, tables, blockquotes, rules. Covers everything the vault's own notes actually use. */
export function MarkdownBody({ body }: { body: string }) {
  const blocks = body.split(/\n{2,}/);

  return (
    <div className="space-y-3 text-body">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (lines.length === 0) return null;

        if (lines[0].startsWith("|")) return renderTable(lines, i);

        if (/^#{1,3}\s/.test(lines[0]) && lines.length === 1) {
          const level = lines[0].match(/^(#{1,3})/)![1].length;
          const text = lines[0].replace(/^#{1,3}\s+/, "");
          const cls = level === 1 ? "text-heading font-semibold" : level === 2 ? "text-body font-semibold" : "text-body font-medium";
          return (
            <p key={i} className={cls}>
              {renderInline(text, i)}
            </p>
          );
        }

        if (/^---+$/.test(lines[0]) && lines.length === 1) {
          return <hr key={i} className="border-border" />;
        }

        if (lines.every((l) => /^>\s?/.test(l))) {
          return (
            <blockquote key={i} className="border-l-2 border-brand/40 pl-3 text-muted-foreground">
              {lines.map((l, li) => (
                <p key={li}>{renderInline(l.replace(/^>\s?/, ""), li)}</p>
              ))}
            </blockquote>
          );
        }

        if (lines.every((l) => /^[-*]\s/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^[-*]\s+/, ""), li)}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={i} className="whitespace-pre-line text-muted-foreground">
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 ? <br /> : null}
                {renderInline(l, li)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
