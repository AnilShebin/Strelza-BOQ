import { useState, useEffect } from "react"
import { LoginForm } from "@/components/login-form"
import { BoqPage } from "@/components/boq-page"
import { Button } from "@/components/ui/button"
import heroImg from "@/assets/hero-boq.jpg"

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('strelza-theme')
    if (saved === 'dark' || saved === 'light') return saved
    return 'light'
  })

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('strelza-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  if (isLoggedIn) {
    return <BoqPage onLogout={() => setIsLoggedIn(false)} />
  }

  return (
    <div className="grid h-screen w-screen max-h-screen overflow-hidden lg:grid-cols-2 bg-background">
      <div className="flex h-full flex-col justify-between overflow-y-auto p-6 md:px-12 md:py-8 relative">
        <div className="flex justify-between items-center w-full">
          <a href="#" className="inline-flex items-center hover:opacity-90 transition-opacity">
            <img src="/strelza-logo.svg" alt="Strelza Logo" className="h-14 w-auto object-contain" />
          </a>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          >
            {theme === 'light' ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                <span>Dark</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>Light</span>
              </>
            )}
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center py-4">
          <div className="w-full max-w-sm">
            <LoginForm onLogin={() => setIsLoggedIn(true)} />
          </div>
        </div>
        <div className="hidden md:block text-xs text-muted-foreground text-center md:text-left">
          &copy; {new Date().getFullYear()} Strelza Inc. All rights reserved.
        </div>
      </div>
      <div className="relative hidden bg-muted lg:flex flex-col justify-end p-8 lg:p-12 h-full overflow-hidden border-l border-border">
        <img
          src={heroImg}
          alt="Strelza BOQ Estimation Architecture"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
        <div className="relative z-10 text-white space-y-3 max-w-lg">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Next-Gen BOQ Estimation Platform
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white leading-tight">
            Precision Quantity Takeoffs & Cost Intelligence
          </h2>
          <p className="text-sm text-neutral-300 leading-relaxed">
            Generate detailed bill of quantities, streamline material estimates, and collaborate seamlessly across engineering and procurement teams.
          </p>
        </div>
      </div>
    </div>
  )
}
