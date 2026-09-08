import React, { useState, useEffect } from "react"
import { LoginForm } from "@/components/login-form"
import { BoqPage } from "@/components/boq-page"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { Icon } from "@/components/common/Icon"
import { FlutedGlass } from "@paper-design/shaders-react"
import { motion } from "motion/react"
import { Moon, Sun } from "lucide-react"

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 text-center select-none font-sans">
          <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 shadow-lg space-y-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-foreground">Something went wrong</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              An unexpected render error occurred in the workspace. Your session is preserved.
            </p>
            {this.state.error?.message && (
              <div className="text-left bg-muted/60 p-2.5 rounded text-[11px] font-mono text-muted-foreground break-all border border-border/50 max-h-28 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                size="sm"
                onClick={() => this.setState({ hasError: false, error: null })}
                className="text-xs bg-primary text-primary-foreground cursor-pointer"
              >
                Try Again
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                className="text-xs cursor-pointer"
              >
                Reload Page
              </Button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('strelza-auth-session') === 'active'
    } catch {
      return false
    }
  })

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('strelza-theme')
    if (saved === 'dark' || saved === 'light') return saved
    return 'dark'
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

  const handleLogin = () => {
    try {
      localStorage.setItem('strelza-auth-session', 'active')
    } catch {}
    setIsLoggedIn(true)
  }

  const handleLogout = () => {
    try {
      localStorage.removeItem('strelza-auth-session')
    } catch {}
    setIsLoggedIn(false)
  }

  if (isLoggedIn) {
    return (
      <ErrorBoundary>
        <BoqPage onLogout={handleLogout} />
        <Toaster richColors position="bottom-right" closeButton />
      </ErrorBoundary>
    )
  }

  return (
    <>
      <Toaster richColors position="bottom-right" closeButton />
      <div className="grid h-screen w-screen max-h-screen overflow-hidden lg:grid-cols-2 bg-background font-sans antialiased">
        
        {/* Left Side: Full-bleed Auth Form Area */}
        <div className="flex h-full flex-col justify-between overflow-y-auto p-6 md:p-10 lg:p-14 relative z-10 bg-background">
          {/* Top Brand Header */}
          <div className="flex justify-between items-center w-full">
            <a href="#" className="inline-flex items-center hover:opacity-90 transition-opacity">
              <img
                src="/strelza-logo.svg"
                alt="Strelza Logo"
                className="h-14 sm:h-16 w-auto object-contain dark:invert dark:hue-rotate-180"
              />
            </a>

            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer rounded-lg border-border"
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              {theme === 'light' ? (
                <>
                  <Moon className="size-3.5" />
                  <span>Dark</span>
                </>
              ) : (
                <>
                  <Sun className="size-3.5" />
                  <span>Light</span>
                </>
              )}
            </Button>
          </div>

          {/* Center Form */}
          <div className="mx-auto w-full max-w-[420px] py-6">
            <LoginForm onLogin={handleLogin} />
          </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border/40 gap-2">
            <span>&copy; {new Date().getFullYear()} Strelza Inc. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:underline hover:text-foreground">Privacy Policy</a>
              <a href="#" className="hover:underline hover:text-foreground">Terms of Service</a>
            </div>
          </div>
        </div>

        {/* Right Side: Full-bleed Marketing Testimonial and Tailored BOQ Mockup */}
        <div className="relative hidden lg:flex h-full flex-col justify-between overflow-hidden border-l border-border bg-[#030305] p-10 lg:p-14 text-white select-none">
          
          {/* Background Shader & Luxury Overlay Filters */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            <FlutedGlass
              size={0.89}
              shape="lines"
              angle={0}
              distortionShape="prism"
              distortion={0.5}
              shift={0}
              blur={0}
              edges={0.25}
              stretch={0}
              scale={1.11}
              fit="cover"
              highlights={0.18}
              shadows={0.45}
              grainMixer={0.12}
              grainOverlay={0.12}
              colorBack="#00000000"
              colorHighlight="#FFFFFF"
              colorShadow="#000000"
              className="w-full h-full bg-transparent"
            />
            {/* Rich Vignette and Dark Tint Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#040406]/95 via-[#06070a]/50 to-[#020204]/85" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_20%_25%,rgba(255,255,255,0.09),transparent_70%)]" />
          </div>

          {/* Foreground Content */}
          <div className="relative z-10 h-full w-full flex flex-col justify-center max-w-[560px] mx-auto">
            {/* Author Badge & Testimonial Quote */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-3.5"
              >
                <div className="size-11 rounded-full border border-white/20 overflow-hidden bg-neutral-800 shadow-md flex items-center justify-center shrink-0">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80"
                    alt="Charlotte"
                    className="size-full object-cover"
                  />
                </div>
                <div>
                  <div className="font-semibold leading-tight text-white text-base">
                    Charlotte
                  </div>
                  <div className="mt-0.5 text-xs text-white/60">
                    Lead Estimating Engineer
                  </div>
                </div>
              </motion.div>

              <motion.blockquote
                initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.8,
                  delay: 0.12,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="mt-8 text-3xl font-light leading-snug tracking-[-0.035em] text-white/95 sm:text-4xl lg:text-[38px]"
              >
                “Every takeoff measurement, rate code, and BOQ summary has the exact precision and speed our team needs.”
              </motion.blockquote>
            </div>
          </div>
        </div>

      </div>
    </>
  )
}
