import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#15201d",
        moss: "#215849",
        mint: "#baf4d8",
        paper: "#f5f3ea",
        coral: "#ff6b52",
      },
      boxShadow: {
        panel: "0 18px 50px rgba(21, 32, 29, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
