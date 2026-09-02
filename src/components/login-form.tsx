import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ArrowRight, Sparkles } from "lucide-react"

interface LoginFormProps extends Omit<React.ComponentProps<"form">, "onSubmit"> {
  onLogin?: () => void
}

export function LoginForm({
  className,
  onLogin,
  ...props
}: LoginFormProps) {
  const [email, setEmail] = React.useState("estimator@strelza.com")
  const [password, setPassword] = React.useState("password123")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onLogin?.()
  }

  return (
    <form className={cn("flex flex-col gap-5", className)} onSubmit={handleSubmit} {...props}>
      <FieldGroup className="gap-4">
        <div className="flex flex-col items-center gap-1.5 text-center mb-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Enter your credentials to access your BOQ workspace
          </p>
        </div>

        <Field className="gap-1.5">
          <FieldLabel htmlFor="email">Email address</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="name@company.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-background h-10 text-sm"
          />
        </Field>

        <Field className="gap-1.5">
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="text-xs text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
            >
              Forgot password?
            </a>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-background h-10 text-sm"
          />
        </Field>

        <Field className="pt-2">
          <Button type="submit" className="w-full h-10 font-medium cursor-pointer shadow-xs gap-1.5">
            <span>Sign In</span>
            <ArrowRight className="size-4" />
          </Button>
        </Field>

        <FieldSeparator className="my-1">Or continue with</FieldSeparator>

        <Field>
          <Button
            variant="outline"
            type="button"
            onClick={() => onLogin?.()}
            className="w-full h-10 font-medium cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 23 23" className="h-4 w-4 mr-2">
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
            Sign in with Microsoft
          </Button>
          <FieldDescription className="px-4 text-center text-xs mt-2 text-muted-foreground">
            Single Sign-On for enterprise domains (@strelza.com)
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
