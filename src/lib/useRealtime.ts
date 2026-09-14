import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

/**
 * Re-runs `onChange` when `table` changes in a way the caller may see.
 *
 * The event is only a signal to refetch. Payload data is never rendered
 * directly: refetching goes back through the normal RLS-checked path, so a
 * stray broadcast can never put another kitchen's row on screen.
 */
function useStream(table: string, event: 'INSERT' | '*', onChange: () => void) {
  const latest = useRef(onChange)
  latest.current = onChange

  useEffect(() => {
    let timer: number | undefined
    let disposed = false

    // Collapse bursts (a chef editing several items, several kitchens
    // reporting at once) into one refetch per second.
    const ping = () => {
      if (disposed || timer !== undefined) return
      timer = window.setTimeout(() => {
        timer = undefined
        latest.current()
      }, 1000)
    }

    const channel = supabase
      .channel(`${table}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event, schema: 'public', table }, ping)
      .subscribe((status) => {
        // Catch anything that changed while the socket was down.
        if (status === 'SUBSCRIBED') ping()
      })

    return () => {
      disposed = true
      if (timer !== undefined) window.clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [table, event])
}

/** A submission the caller can see was filed or removed. */
export function useSubmissionStream(onChange: () => void) {
  useStream('submissions', '*', onChange)
}

/** Anything a record displays changed: the submission, its kitchen, or who filed it. */
export function useRecordStream(onChange: () => void) {
  useStream('submissions', '*', onChange)
  useStream('kitchens', '*', onChange)
  useStream('profiles', '*', onChange)
}

/** Anything in `table` was added, changed or removed. */
export function useTableStream(table: string, onChange: () => void) {
  useStream(table, '*', onChange)
}
