import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	extend: {
  		screens: {
  			// Extra-small phones (≈320–400px) need their own step: the default
  			// `sm` (640px) is far too late for them.
  			xs: '400px'
  		},
  		colors: {
  			// Brand ramp. The gold was previously hardcoded as #c8a415 in dozens
  			// of files with hand-picked hover shades; these tokens make the
  			// states consistent.
  			gold: {
  				50: '#fdfbf0',
  				100: '#faf4d8',
  				200: '#f2e6a8',
  				300: '#e6d374',
  				400: '#d9be45',
  				500: '#c8a415',
  				600: '#b08e10',
  				700: '#8d710d',
  				800: '#6b5609',
  				900: '#4a3b06'
  			},
  			ink: {
  				50: '#f6f6f5',
  				100: '#e7e7e4',
  				200: '#cbcbc6',
  				300: '#a5a49d',
  				400: '#7b7a72',
  				500: '#5a5952',
  				600: '#42413c',
  				700: '#2f2e2a',
  				800: '#1d1c1a',
  				900: '#100f0a'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		// ── Brand palette ────────────────────────────────────────────────
  		// The gold was previously hardcoded as #c8a415 in ~40 files. These
  		// tokens give it a real ramp so hover/active/muted states are
  		// consistent instead of hand-picked per component.
  		fontFamily: {
  			sans: ['Inter var', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  			display: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  			mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
  		},
  		boxShadow: {
  			// Layered shadows read as real elevation; a single large blur
  			// looks like a smudge.
  			'elev-1': '0 1px 2px rgba(16,15,10,0.04), 0 1px 3px rgba(16,15,10,0.06)',
  			'elev-2': '0 2px 4px rgba(16,15,10,0.04), 0 4px 12px rgba(16,15,10,0.08)',
  			'elev-3': '0 4px 8px rgba(16,15,10,0.04), 0 12px 28px rgba(16,15,10,0.10)',
  			'elev-4': '0 8px 16px rgba(16,15,10,0.05), 0 24px 56px rgba(16,15,10,0.14)',
  			'gold-sm': '0 2px 10px rgba(200,164,21,0.22)',
  			'gold-md': '0 8px 26px rgba(200,164,21,0.28)',
  			'gold-lg': '0 16px 48px rgba(200,164,21,0.34)',
  			'inner-hi': 'inset 0 1px 0 rgba(255,255,255,0.65)'
  		},
  		transitionTimingFunction: {
  			'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
  			'out-back': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  			'in-out-quint': 'cubic-bezier(0.83, 0, 0.17, 1)'
  		},
  		backgroundImage: {
  			'gold-sheen': 'linear-gradient(110deg, #b8952e 0%, #e6cc5a 45%, #fff6cf 50%, #e6cc5a 55%, #b8952e 100%)',
  			'grid-faint':
  				'linear-gradient(to right, rgba(16,15,10,0.055) 1px, transparent 1px), linear-gradient(to bottom, rgba(16,15,10,0.055) 1px, transparent 1px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: { height: '0' },
  				to: { height: 'var(--radix-accordion-content-height)' }
  			},
  			'accordion-up': {
  				from: { height: 'var(--radix-accordion-content-height)' },
  				to: { height: '0' }
  			},
  			// Slow drifting blobs behind the hero.
  			'ba-float': {
  				'0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
  				'33%': { transform: 'translate3d(18px,-24px,0) scale(1.05)' },
  				'66%': { transform: 'translate3d(-14px,16px,0) scale(0.97)' }
  			},
  			// Light sweeping across gold text / buttons.
  			'ba-sheen': {
  				'0%': { backgroundPosition: '200% 50%' },
  				'100%': { backgroundPosition: '-200% 50%' }
  			},
  			// Skeleton loading shimmer.
  			'ba-shimmer': {
  				'0%': { transform: 'translateX(-100%)' },
  				'100%': { transform: 'translateX(100%)' }
  			},
  			// Expanding ring behind live/status dots.
  			'ba-ping-ring': {
  				'0%': { transform: 'scale(0.85)', opacity: '0.7' },
  				'80%, 100%': { transform: 'scale(2.1)', opacity: '0' }
  			},
  			'ba-spin-slow': {
  				to: { transform: 'rotate(360deg)' }
  			},
  			'ba-bob': {
  				'0%, 100%': { transform: 'translateY(0)' },
  				'50%': { transform: 'translateY(-6px)' }
  			},
  			'ba-fade-up': {
  				from: { opacity: '0', transform: 'translateY(14px)' },
  				to: { opacity: '1', transform: 'translateY(0)' }
  			},
  			'ba-scale-in': {
  				from: { opacity: '0', transform: 'scale(0.94)' },
  				to: { opacity: '1', transform: 'scale(1)' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'float-slow': 'ba-float 18s ease-in-out infinite',
  			'float-slower': 'ba-float 26s ease-in-out infinite reverse',
  			sheen: 'ba-sheen 4.5s linear infinite',
  			shimmer: 'ba-shimmer 1.6s ease-in-out infinite',
  			'ping-ring': 'ba-ping-ring 1.8s cubic-bezier(0,0,0.2,1) infinite',
  			'spin-slow': 'ba-spin-slow 9s linear infinite',
  			bob: 'ba-bob 3s ease-in-out infinite',
  			'fade-up': 'ba-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both',
  			'scale-in': 'ba-scale-in 0.35s cubic-bezier(0.16,1,0.3,1) both'
  		}
  	}
  },
  plugins: [],
};
export default config;
