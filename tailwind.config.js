import animate from "tailwindcss-animate";
/** @type {import('tailwindcss').Config} */
const v = (name) => `hsl(var(--${name}) / <alpha-value>)`;
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // màu cặp lỗi dùng động theo dữ liệu (bg-ln-soft, text-chtr-ink, ...)
  safelist: [{ pattern: /^(bg|text|ring|border|from|to)-(ln|chtr|sx)(-(soft|ink))?$/ }, { pattern: /^bg-grad-(ln|chtr|sx)$/ }],
  theme: {
    container: { center: true, padding: "1rem" },
    extend: {
      fontFamily: {
        sans: ['"Be Vietnam Pro"', "system-ui", "sans-serif"],
      },
      colors: {
        border: v("border"),
        input: v("input"),
        ring: v("ring"),
        background: v("background"),
        foreground: v("foreground"),
        primary: { DEFAULT: v("primary"), foreground: v("primary-foreground"), soft: v("primary-soft") },
        secondary: { DEFAULT: v("secondary"), foreground: v("secondary-foreground") },
        muted: { DEFAULT: v("muted"), foreground: v("muted-foreground") },
        accent: { DEFAULT: v("accent"), foreground: v("accent-foreground") },
        destructive: { DEFAULT: v("destructive"), foreground: v("destructive-foreground") },
        success: { DEFAULT: v("success"), foreground: v("success-foreground"), soft: v("success-soft") },
        warning: { DEFAULT: v("warning"), foreground: v("warning-foreground"), soft: v("warning-soft") },
        card: { DEFAULT: v("card"), foreground: v("card-foreground") },
        popover: { DEFAULT: v("card"), foreground: v("card-foreground") },
        ln: { DEFAULT: v("ln"), soft: v("ln-soft"), ink: v("ln-ink") },
        chtr: { DEFAULT: v("chtr"), soft: v("chtr-soft"), ink: v("chtr-ink") },
        sx: { DEFAULT: v("sx"), soft: v("sx-soft"), ink: v("sx-ink") },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
        "4xl": "2rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgb(16 24 40 / .04), 0 4px 12px rgb(16 24 40 / .05), 0 18px 36px -12px rgb(16 24 40 / .10)",
        lift: "0 2px 4px rgb(16 24 40 / .05), 0 10px 24px rgb(16 24 40 / .08), 0 30px 60px -20px rgb(16 24 40 / .18)",
        glow: "0 0 0 6px hsl(var(--primary) / .12), 0 12px 30px -6px hsl(var(--primary) / .55)",
      },
      keyframes: {
        "float-y": { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
      },
      animation: { "float-y": "float-y 3s ease-in-out infinite" },
    },
  },
  plugins: [animate],
};
