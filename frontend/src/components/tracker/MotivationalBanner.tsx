import { useEffect, useState } from "react";
import { Sparkle } from "lucide-react";
import { getRandomQuote } from "@/api/quotes";
import type { Quote } from "@/types";

/**
 * Мотивационная плашка, показываемая при заходе на экран трекера (п.3
 * требований: "приложение должно подбадривать человека мотивационными
 * фразами при заходе в него"). Фраза запрашивается один раз при монтировании
 * компонента — то есть один раз за "визит" на этот экран.
 */
export function MotivationalBanner() {
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    getRandomQuote()
      .then(setQuote)
      .catch(() => setQuote(null));
  }, []);

  if (!quote) return null;

  return (
    <div className="mx-5 mb-4 flex items-start gap-3 rounded-xl2 border border-primary/30 bg-primary/10 px-4 py-3.5">
      <Sparkle size={18} className="mt-0.5 shrink-0 text-primary" />
      <p className="text-sm leading-relaxed text-textPrimary">{quote.text}</p>
    </div>
  );
}
