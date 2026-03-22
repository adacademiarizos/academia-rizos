import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        xl: "18px",
        "2xl": "24px",
        "3xl": "32px",
      },
      boxShadow: {
        soft: "0 10px 30px rgba(27,26,23,0.10)",
        soft2: "0 6px 18px rgba(27,26,23,0.10)",
      },
      keyframes: {
        zoomLateral: {
          '0%': { transform: 'scale(1) translateX(0)' },
          '100%': { transform: 'scale(1.2) translateX(10%)' },
        }
      },
      animation: {
        'pan-zoom': 'zoomLateral 10s infinite alternate ease-in-out',
      }
    },
  },
  plugins: [],
} satisfies Config;