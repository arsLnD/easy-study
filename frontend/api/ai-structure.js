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
  if (!key) {
    res.status(500).json({ error: "Нет ключа OpenRouter на сервере" });
    return;
  }
  const text = String(req.body?.text ?? "").trim();
  if (!text) {
    res.status(400).json({ error: "Пустой текст" });
    return;
  }
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://easy-study.vercel.app",
      "X-Title": "Easy Study",
    },
    body: JSON.stringify({
      model: "dots-studio/dots-3-note-preview:free",
      temperature: 0,
      max_tokens: 2500,
      messages: [
        {
          role: "system",
          content: "Оформи конспект. Не меняй слова. Формат:\nTITLE: заголовок\n---\nтекст с нумерацией",
        },
        { role: "user", content: text.slice(0, 6000) },
      ],
    }),
  });
  const data = await r.json();
  if (!r.ok) {
    res.status(502).json({ error: data?.error?.message || `OpenRouter ${r.status}` });
    return;
  }
  const content = data?.choices?.[0]?.message?.content || "";
  let title = "Без названия";
  let structured = text;
  if (content.includes("---")) {
    const [head, rest] = content.split("---");
    if (head?.includes("TITLE:")) title = head.split("TITLE:")[1]?.trim() || title;
    structured = rest?.trim() || text;
  }
  res.status(200).json({ title, structured, wordsChanged: false });
}
