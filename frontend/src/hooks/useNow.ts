'use client'

import { useSyncExternalStore } from 'react'

/**
 * Returns the current timestamp, refreshed every `intervalMs`.
 *
 * Reading the clock during render is impure (and flagged by the React Compiler
 * lint rules), so this exposes time as an external store instead. The snapshot
 * is quantised to `intervalMs` so it stays referentially stable between ticks.
 */
export function useNow(intervalMs = 30_000): number {
  return useSyncExternalStore(
    (onStoreChange) => {
      const id = setInterval(onStoreChange, intervalMs)
      return () => clearInterval(id)
    },
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => 0,
  )
}
