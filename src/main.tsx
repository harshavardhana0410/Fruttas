import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { isSupabaseConfigured } from './lib/supabase'
import './styles/tokens.css'

/**
 * Shown instead of the app when the environment is not wired up.
 * A misconfigured build should say so on screen, not in the console.
 */
function Setup() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col justify-center px-5">
      <p className="font-serif text-[26px] tracking-[0.18em]">FRUTTA</p>
      <p className="label-section mt-2">Kitchen Operations</p>

      <div className="mt-8 rounded-card border border-hairline bg-surface p-6">
        <p className="text-[15px] font-medium">Not connected to a database yet</p>
        <p className="mt-1.5 text-[13px] leading-[1.6] text-ink-soft">
          Copy <code className="font-mono">.env.example</code> to{' '}
          <code className="font-mono">.env.local</code> and fill in both values, then
          restart the dev server.
        </p>

        <pre className="mt-4 overflow-x-auto rounded-control bg-sunken p-3 font-mono text-[12px] leading-[1.7] text-ink-soft">
{`VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=`}
        </pre>

        <p className="mt-4 text-[13px] leading-[1.6] text-ink-soft">
          Both are printed by <code className="font-mono">supabase start</code>, or found
          under Project Settings → API. Use the publishable key only — never the
          service role key.
        </p>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isSupabaseConfigured ? <App /> : <Setup />}</StrictMode>,
)
