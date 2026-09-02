import { useState, useEffect } from "react"
import { LoginForm } from "@/components/login-form"
import { BoqPage } from "@/components/boq-page"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { Icon } from "@/components/common/Icon"
import { FlutedGlass } from "@paper-design/shaders-react"
import { motion } from "motion/react"
import { Moon, Sun } from "lucide-react"

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
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

  if (isLoggedIn) {
    return (
      <>
        <BoqPage onLogout={() => setIsLoggedIn(false)} />
        <Toaster richColors position="top-right" closeButton />
      </>
    )
  }

  return (
    <>
      <Toaster richColors position="top-right" closeButton />
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
            <LoginForm onLogin={() => setIsLoggedIn(true)} />
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
