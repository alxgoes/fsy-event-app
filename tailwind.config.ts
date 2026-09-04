import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "#F8FAFC",
        foreground: "hsl(var(--foreground))",
        "slate-850": "#1e293b",
        primary: {
          DEFAULT: "#007DA5", // Official FSY Blue 25
          foreground: "#FFFFFF",
          50: "#F0F9FF",
          100: "#B0EEFC", // Blue 5
          200: "#7DE3F4", // Blue 10
          500: "#01B6D1", // Blue 20
          600: "#007DA5", // Blue 25
          700: "#005E7C",
        },
        secondary: {
          DEFAULT: "#FFE48A", // Official Sunshine
          foreground: "#000000",
        },
        accent: {
          DEFAULT: "#FC4E6D", // Official Red 10
          foreground: "#FFFFFF",
        },
        success: {
          DEFAULT: "#93C742", // Official Green 15
          foreground: "#000000",
        },
        destructive: {
          DEFAULT: "#D45311", // Official Yellow 30 / Rust
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Official FSY 2027 Palette
        fsy: {
          neutral5: "#EFEFE7",
          parchment: "#F5EFCA",
          sunshine: "#FFE48A",
          yellow10: "#FFB81C",
          gold10: "#DBBF6B",
          gray5: "#E0E2E2",
          red5: "#FDA192",
          red10: "#FC4E6D",
          yellow20: "#F68D2E",
          yellow30: "#D45311",
          green5: "#D3E952",
          green10: "#BED21E",
          green15: "#93C742",
          green20: "#6DB344",
          blue5: "#B0EEFC",
          blue10: "#7DE3F4",
          blue20: "#01B6D1",
          blue25: "#007DA5",
          black: "#000000",
        },
        brand: {
          blue: "#007DA5",
          teal: "#01B6D1",
          yellow: "#FFE48A",
          gold: "#DBBF6B",
          pink: "#FC4E6D",
          coral: "#FDA192",
          green: "#93C742",
          dark: "#0F172A",
          surface: "#F5EFCA",
          neutral: "#EFEFE7",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
        "4xl": "2.5rem",
      },
      boxShadow: {
        "brutal-sm": "4px 4px 0px 0px rgba(0,0,0,1)",
        "brutal-md": "6px 6px 0px 0px rgba(0,0,0,1)",
        "brutal-soft": "0 10px 0px 0px rgba(0, 125, 165, 0.15), 0 20px 25px -5px rgba(0, 0, 0, 0.05)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        heading: ["var(--font-heading)", "var(--font-serif)", "Cinzel", "Cormorant Garamond", "serif"],
        serif: ["var(--font-serif)", "var(--font-heading)", "Cormorant Garamond", "Cinzel", "serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
