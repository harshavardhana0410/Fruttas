import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

/**
 * Re-runs `onChange` when a submission the caller is allowed to see is filed.
 *
 * The event is treated purely as a signal to refetch. Payload data is never
 * rendered directly — refetching goes back through the normal RLS-checked
 * path, so a stray broadcast can never put another kitchen's row on screen.
 */
export function useSubmissionStream(onChange: () => void) {
  const latest = useRef(onChange)
  latest.current = onChange

  useEffect(() => {
    let timer: number | undefined
    let disposed = false

    // A busy evening across several kitchens should not trigger a refetch
    // storm, so collapse bursts into one call per second.
    const ping = () => {
      if (disposed || timer !== undefined) return
      timer = window.setTimeout(() => {
        timer = undefined
        latest.current()
      }, 1000)
    }

    const channel = supabase
      .channel('submissions-stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'submissions' },
        ping,
      )
      .subscribe((status) => {
        // Catch anything filed while the socket was down.
        if (status === 'SUBSCRIBED') ping()
      })

    return () => {
      disposed = true
      if (timer !== undefined) window.clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [])
}

/**
 * Fires when an admin edits the checklist template.
 *
 * Used only to warn someone mid-audit. Never swap the questions under a person
 * who is halfway through answering them.
 */
export function useTemplateStream(onChange: () => void) {
  const latest = useRef(onChange)
  latest.current = onChange

  useEffect(() => {
    const channel = supabase
      .channel('template-stream')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inspection_points' },
        () => latest.current(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])
}
