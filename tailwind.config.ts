import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./components/**/*.{ts,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1.25rem",
        sm: "1.5rem",
        lg: "2rem",
        xl: "2.5rem",
        "2xl": "3rem",
      },
      screens: {
        "2xl": "1440px",
      },
    },
    extend: {
      colors: {
        ink: {
          DEFAULT: "#161310",
          90: "#23201B",
          80: "#313029",
          60: "#4F4A42",
          40: "#7D766B",
        },
        bone: {
          DEFAULT: "#F7F1E3",
          90: "#EFE6D3",
          80: "#E6DDC7",
          60: "#D4C8AF",
        },
        paper: "#EFE7D0",
        moss: {
          DEFAULT: "#56684B",
          80: "#6C7E5F",
          60: "#869477",
        },
        saffron: {
          DEFAULT: "#B8C45E",
          80: "#C9D378",
          60: "#D8E08B",
        },
        poppy: {
          DEFAULT: "#C47557",
          80: "#D4896C",
          60: "#E39C7C",
        },
        jade: {
          DEFAULT: "#6E8E5D",
          80: "#87A06F",
          60: "#A5B97E",
        },
        sky: {
          DEFAULT: "#6D8796",
          80: "#829AA7",
          60: "#A1B2BC",
        },
        sun: {
          DEFAULT: "#D9C57A",
          80: "#E3D292",
          60: "#ECE0AE",
        },
        plum: {
          DEFAULT: "#7E685E",
          80: "#947F73",
          60: "#AA988D",
        },
        stone: {
          DEFAULT: "#8E8578",
          80: "#AAA297",
          60: "#C8C0B6",
        },
        signal: "#C47557",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.08em" }],
        xs: ["0.75rem", { lineHeight: "1.1rem", letterSpacing: "0.04em" }],
        sm: ["0.875rem", { lineHeight: "1.3rem" }],
        base: ["1rem", { lineHeight: "1.55rem" }],
        lg: ["1.125rem", { lineHeight: "1.65rem" }],
        xl: ["1.3125rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.625rem", { lineHeight: "2rem", letterSpacing: "-0.01em" }],
        "3xl": ["2.125rem", { lineHeight: "2.35rem", letterSpacing: "-0.015em" }],
        "4xl": ["2.75rem", { lineHeight: "2.9rem", letterSpacing: "-0.02em" }],
        "5xl": ["3.75rem", { lineHeight: "3.85rem", letterSpacing: "-0.025em" }],
        "6xl": ["5rem", { lineHeight: "1", letterSpacing: "-0.03em" }],
        "7xl": ["6.75rem", { lineHeight: "0.95", letterSpacing: "-0.035em" }],
        "8xl": ["9rem", { lineHeight: "0.92", letterSpacing: "-0.04em" }],
      },
      spacing: {
        "4.5": "1.125rem",
        "18": "4.5rem",
        "22": "5.5rem",
        "30": "7.5rem",
        "42": "10.5rem",
      },
      boxShadow: {
        cut: "0 0 0 1px #161310",
        offset: "4px 4px 0 0 #161310",
        "offset-sm": "2px 2px 0 0 #161310",
        "offset-lg": "6px 6px 0 0 #161310",
        "offset-saffron": "4px 4px 0 0 #B8C45E",
        "offset-sky": "4px 4px 0 0 #6D8796",
        "offset-jade": "4px 4px 0 0 #6E8E5D",
        "offset-poppy": "4px 4px 0 0 #C47557",
        "offset-plum": "4px 4px 0 0 #7E685E",
        "offset-sun": "4px 4px 0 0 #D9C57A",
        soft: "0 18px 40px -20px rgba(22,19,16,0.32)",
      },
      borderRadius: {
        none: "0",
        xs: "2px",
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "12px",
        xl: "18px",
      },
      transitionTimingFunction: {
        atelier: "cubic-bezier(0.65, 0, 0.35, 1)",
        quartIn: "cubic-bezier(0.5, 0, 0.75, 0)",
        quartOut: "cubic-bezier(0.25, 1, 0.5, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
