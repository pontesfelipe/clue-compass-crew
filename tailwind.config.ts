import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      gridTemplateColumns: {
        '14': 'repeat(14, minmax(0, 1fr))',
      },
      fontSize: {
        // Mobile-first responsive text sizes
        'xs-mobile': ['0.75rem', { lineHeight: '1rem' }],     // 12px
        'sm-mobile': ['0.875rem', { lineHeight: '1.25rem' }],  // 14px
        'base-mobile': ['1rem', { lineHeight: '1.5rem' }],     // 16px
        'lg-mobile': ['1.125rem', { lineHeight: '1.75rem' }],  // 18px
        'xl-mobile': ['1.25rem', { lineHeight: '1.75rem' }],   // 20px
        '2xl-mobile': ['1.5rem', { lineHeight: '2rem' }],      // 24px
        '3xl-mobile': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        civic: {
          navy: "hsl(var(--civic-navy))",
          "navy-light": "hsl(var(--civic-navy-light))",
          blue: "hsl(var(--civic-blue))",
          gold: "hsl(var(--civic-gold))",
          "gold-light": "hsl(var(--civic-gold-light))",
          red: "hsl(var(--civic-red))",
          green: "hsl(var(--civic-green))",
          slate: "hsl(var(--civic-slate))",
        },
        score: {
          excellent: "hsl(var(--score-excellent))",
          good: "hsl(var(--score-good))",
          average: "hsl(var(--score-average))",
          poor: "hsl(var(--score-poor))",
          bad: "hsl(var(--score-bad))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
      boxShadow: {
        'civic-sm': 'var(--shadow-sm)',
        'civic-md': 'var(--shadow-md)',
        'civic-lg': 'var(--shadow-lg)',
        'civic-xl': 'var(--shadow-xl)',
        'civic-glow': 'var(--shadow-glow)',
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
        "score-fill": {
          from: { strokeDashoffset: "100" },
          to: { strokeDashoffset: "var(--score-offset)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "score-fill": "score-fill 1s ease-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
