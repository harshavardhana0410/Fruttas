import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../lib/session'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'

export default function SignIn() {
  const { signIn } = useSession()
  const nav = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!email.trim()) return setError('Email is required.')
    if (!password) return setError('Password is required.')

    setBusy(true)
    try {
      // The role argument is vestigial — role comes from the profiles row.
      // A user who can choose their own role is not access control.
      await signIn(email, password, 'staff')
      nav('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.')
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-5 py-10">
      {/* Ambient warmth, barely there. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(60rem 40rem at 50% 0%, rgba(149, 100, 0, 0.03), transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <p className="font-serif text-[26px] tracking-[0.18em]">FRUTTA</p>
          <p className="label-section mt-2">Kitchen Operations</p>
        </div>

        <form
          onSubmit={submit}
          noValidate
          className="rounded-card border border-hairline bg-surface p-6"
        >
          <div className="flex flex-col gap-4">
            <Field label="Email">
              {(id) => (
                <Input
                  id={id}
                  type="email"
                  value={email}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="name@frutta.com"
                  invalid={Boolean(error) && !email.trim()}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>

            <Field label="Password">
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  value={password}
                  invalid={Boolean(error) && !password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </Field>

            {error && <p className="text-[12px] text-fail-fg">{error}</p>}

            <Button type="submit" variant="primary" size="lg" full disabled={busy}>
              {busy ? 'Signing in' : 'Sign in'}
            </Button>
          </div>
        </form>

        <p className="mt-4 text-center text-[12px] text-ink-soft">
          Contact your kitchen manager for access.
        </p>
      </div>
    </div>
  )
}
