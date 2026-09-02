export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "method" });
    return;
  }
  const key = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || "";
  const text = String(req.body?.text ?? "").trim();
  if (!text) {
    res.status(400).json({ error: "Пустой текст" });
    return;
  }
  const models = [
    "inclusionai/ling-3.0-flash-fin:free",
    "dots-studio/dots-3-note-preview:free",
  ];
  const prompt = `Оформи студенческий конспект.

Формат:
1. Короткий заголовок
   Абзац из исходника.
   *   пункт списка

Правила:
- Не меняй и не выкидывай слова исходника.
- Можно только нумерацию, маркеры *, переносы строк и короткие заголовки из слов исходника.
- Разбей сплошной текст на пункты 1. 2. 3.
- Списки внутри пункта — * или 1. 2.
- Ответ: только оформленный конспект. Без TITLE, без ---, без пояснений.`;
  const errors = [];
  for (const model of models) {
    if (!key) break;
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://easy-study.vercel.app",
        "X-Title": "Easy Study",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 6000,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: text.slice(0, 12000) },
        ],
      }),
    });
    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content?.trim() || "";
    if (!r.ok || content.length < 80) {
      errors.push(data?.error?.message || `${model} ${r.status}`);
      continue;
    }
    let structured = content;
    let title = "Без названия";
    if (content.includes("---") && /TITLE:/i.test(content)) {
      const [head, rest] = content.split("---");
      title = head.split("TITLE:")[1]?.trim() || title;
      structured = rest.trim();
    }
    const heading = structured.match(/^\s*1\.\s+(.+)/m);
    if (heading) title = heading[1].trim().slice(0, 80) || title;
    res.status(200).json({ title, structured, wordsChanged: false });
    return;
  }
  res.status(502).json({ error: errors[0] || "ИИ не ответил" });
}
