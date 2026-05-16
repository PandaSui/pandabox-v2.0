import type { Config } from "tailwindcss";
import preset from "@pandasui/ui/tailwind-preset";

const config: Config = {
  presets: [preset],
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./components/**/*.{ts,tsx,mdx}",
    "./node_modules/@pandasui/ui/dist/**/*.{js,mjs}",
  ],
};

export default config;
