// Theme provider: 'light' | 'dark', persisted to localStorage.
//
// On change we set ``data-theme`` on <html>, which CSS uses via the
// [data-theme="dark"] selector. Components only need to call useTheme()
// for the toggle button; styling is purely CSS.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'

type Ctx = {
  theme: Theme
  toggle: () => void
}

const STORAGE_KEY = 'cordillera_theme'
const ThemeContext = createContext<Ctx | undefined>(undefined)

function readInitial(): Theme {
  if (typeof window === 'undefined') return 'light'
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved === 'dark' || saved === 'light') return saved
  // Honor the OS preference on first ever launch.
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readInitial)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // localStorage may be disabled (private browsing); silently ignore.
    }
  }, [theme])

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
