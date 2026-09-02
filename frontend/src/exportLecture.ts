const TYPE_LABEL: Record<string, string> = {
  lecture: "Лекция",
  exercise: "Упражнение",
  lab: "Лабораторная работа",
};

function safeName(name: string) {
  return name.replace(/[<>:"/\\|?*]+/g, " ").trim().slice(0, 80) || "konspekt";
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function toMarkdown(input: {
  title: string;
  subject: string;
  type: string;
  body: string;
}) {
  const kind = TYPE_LABEL[input.type] ?? input.type;
  return `# ${input.title}

**Предмет:** ${input.subject}  
**Тип:** ${kind}

${input.body.trim()}
`;
}

export function bodyToHtml(body: string) {
  const blocks = body.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trimEnd());
      const heading = lines[0]?.match(/^(#{1,3})\s+(.+)$/);
      if (heading && lines.length === 1) {
        const tag = `h${heading[1].length + 1}`;
        return `<${tag}>${escapeHtml(heading[2])}</${tag}>`;
      }
      const items = lines.filter(
        (l) => /^\d+(\.\d+)*[.)]?\s+/.test(l.trim()) || /^[*\-+•]\s+/.test(l.trim()),
      );
      if (items.length === lines.filter(Boolean).length && items.length > 0) {
        const lis = lines
          .filter(Boolean)
          .map((l) => l.replace(/^\s*(\d+(\.\d+)*[.)]?|[*\-+•])\s+/, ""))
          .map((t) => `<li>${escapeHtml(t)}</li>`)
          .join("");
        return `<ol>${lis}</ol>`;
      }
      return `<p>${escapeHtml(lines.join("\n")).replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");
}

export function previewDocumentHtml(title: string, body: string) {
  return `<h1>${escapeHtml(title)}</h1>${bodyToHtml(body)}`;
}

export function toHtmlDocument(input: {
  title: string;
  subject: string;
  type: string;
  body: string;
}) {
  const kind = TYPE_LABEL[input.type] ?? input.type;
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeHtml(input.title)}</title>
  <style>
    body { font-family: "Times New Roman", Times, serif; max-width: 800px; margin: 40px auto; font-size: 14pt; line-height: 1.45; color: #111; }
    h1 { font-size: 22pt; margin-bottom: 8px; }
    .meta { color: #444; font-size: 12pt; margin-bottom: 24px; }
    ol { padding-left: 1.4em; }
    li { margin: 6px 0; }
    p { margin: 10px 0; }
  </style>
</head>
<body>
  <h1>${escapeHtml(input.title)}</h1>
  <div class="meta">${escapeHtml(input.subject)} · ${escapeHtml(kind)}</div>
  ${bodyToHtml(input.body)}
</body>
</html>`;
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadLecture(input: {
  title: string;
  subject: string;
  type: string;
  body: string;
  format: "md" | "html" | "doc";
}) {
  const base = safeName(input.title);
  if (input.format === "md") {
    download(`${base}.md`, toMarkdown(input), "text/markdown;charset=utf-8");
    return;
  }
  const html = toHtmlDocument(input);
  if (input.format === "html") {
    download(`${base}.html`, html, "text/html;charset=utf-8");
    return;
  }
  download(
    `${base}.doc`,
    `\uFEFF${html}`,
    "application/msword",
  );
}
