import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark' | 'system'
type ThemeState = { theme: Theme; resolvedTheme: 'light' | 'dark'; setTheme: (theme: Theme | string) => void }

// Same storage key as the no-flash script in index.html.
const KEY = 'theme'
const query = () => window.matchMedia('(prefers-color-scheme: dark)')

const ThemeContext = createContext<ThemeState>({ theme: 'system', resolvedTheme: 'light', setTheme: () => {} })

/** Light / dark / system via the `.dark` class on <html> (what shadcn and tweakcn themes expect). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(KEY) as Theme) || 'system'
    } catch {
      return 'system'
    }
  })
  const [systemDark, setSystemDark] = useState(() => query().matches)

  useEffect(() => {
    const mq = query()
    const onChange = () => setSystemDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  useEffect(() => {
    // Switch without every element animating its colours.
    const pause = document.createElement('style')
    pause.textContent = '*,*::before,*::after{transition:none!important}'
    document.head.appendChild(pause)
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.style.colorScheme = resolvedTheme
    void getComputedStyle(document.body).opacity
    const t = setTimeout(() => pause.remove(), 1)
    return () => clearTimeout(t)
  }, [resolvedTheme])

  const setTheme = (next: Theme | string) => {
    const value = (['light', 'dark', 'system'].includes(next) ? next : 'system') as Theme
    setThemeState(value)
    try {
      localStorage.setItem(KEY, value)
    } catch {
      /* private window: not remembered */
    }
  }

  return <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>
}

// oxlint-disable-next-line react/only-export-components -- the hook belongs with its provider
export const useTheme = () => useContext(ThemeContext)
