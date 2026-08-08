/**
 * Тема оформления Plans/Finance.
 *
 * Идея дизайна: почти чёрный фон (не абсолютный #000, а тёплый тёмно-серый
 * #0B0B0F — меньше устают глаза и лучше видна глубина карточек), на нём —
 * чёткие яркие акцентные цвета, каждый со своим смыслом:
 *   - primary (фиолетово-синий) — основные действия, ссылки, активная навигация
 *   - income  (зелёный)          — доходы, выполненные цели, "всё хорошо"
 *   - expense (розово-красный)   — траты, превышение бюджета, предупреждения
 *   - warning (янтарный)         — предупреждения, близость к лимиту
 * Поверхности (surface/surfaceMuted) — чуть светлее фона, чтобы карточки
 * визуально "выступали", без резких белых плашек, которые слепят в темноте.
 */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0B0B0F",
        surface: "#15151C",
        surfaceMuted: "#1D1D26",
        border: "#2A2A35",
        textPrimary: "#F5F5F7",
        textSecondary: "#9A9AA6",
        primary: {
          DEFAULT: "#7C5CFF",
          hover: "#6A4BEF",
          soft: "rgba(124, 92, 255, 0.14)",
        },
        income: {
          DEFAULT: "#00E38C",
          soft: "rgba(0, 227, 140, 0.14)",
        },
        expense: {
          DEFAULT: "#FF5470",
          soft: "rgba(255, 84, 112, 0.14)",
        },
        warning: {
          DEFAULT: "#FFB020",
          soft: "rgba(255, 176, 32, 0.14)",
        },
      },
      fontFamily: {
        sans: [
          "Manrope",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(124, 92, 255, 0.25), 0 8px 24px rgba(124, 92, 255, 0.15)",
        card: "0 4px 20px rgba(0, 0, 0, 0.35)",
      },
    },
  },
  plugins: [],
};
