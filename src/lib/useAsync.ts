import { useCallback, useEffect, useState } from 'react'

/**
 * Minimal async loader. Every page reads data through this and data.ts.
 *
 * A failed first load is rethrown during render, so the error boundary in
 * AppShell shows it — one place, every page — instead of a skeleton that
 * never resolves. Once a page has data, a failed refetch (a realtime ping
 * over flaky Wi-Fi) keeps the last good data on screen rather than
 * replacing a working page with an error.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let live = true
    setLoading(true)
    fn()
      .then((r) => {
        if (!live) return
        setData(r)
        setError(null)
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e : new Error(String(e)))
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  if (error && data === null) throw error
  return { data, loading, reload }
}
