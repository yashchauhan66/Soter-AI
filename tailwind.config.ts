import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#08111f",
        panel: "#101b2d",
        cyan: "#31d7c8",
        lime: "#b7f34a"
      },
      boxShadow: { glow: "0 0 50px rgba(49, 215, 200, 0.12)" }
    },
  },
  plugins: [],
};

export default config;
