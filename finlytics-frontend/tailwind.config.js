/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#14171F",
          900: "#0D1017",
          800: "#101827",
          700: "#1B2233",
          600: "#2B3348",
        },
        paper: "#F7F7F4",
        surface: "#FFFFFF",
        border: "#E5E4DF",
        muted: "#6B6F76",
        faint: "#9A9DA3",
        ledger: {
          DEFAULT: "#1F6F54",
          50: "#EAF5F0",
          100: "#CFE9DD",
          600: "#1F6F54",
          700: "#175843",
        },
        mint: "#6FE7C4",
        amber: "#E8963C",
        danger: "#D6534A",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(20, 23, 31, 0.04), 0 1px 12px rgba(20, 23, 31, 0.04)",
        raised: "0 4px 24px rgba(20, 23, 31, 0.08)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
