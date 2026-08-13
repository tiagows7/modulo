import { useEffect, type RefObject } from 'react'

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable
  )
}

export type UseGridKeyboardNavOptions<T extends string> = {
  /** IDs das linhas/itens do grid (ordem de navegação). */
  ids: readonly T[]
  selectedId: T | null
  setSelectedId: (id: T | null) => void
  /** Container com `tr[data-row-id]` ou `[data-row-id]` para scroll. */
  containerRef?: RefObject<HTMLElement | null>
  enabled?: boolean
  /** Enter na linha selecionada. */
  onEnter?: (id: T) => void
  /**
   * true = ↑↓ funcionam mesmo com foco em input (padrão PDV).
   * false = ignora teclas enquanto digita.
   */
  allowArrowsWhileTyping?: boolean
  /** Filtros laterais com ← → (ex.: Todos / NFC-e). */
  filterOptions?: readonly string[]
  filterValue?: string
  onFilterChange?: (value: string) => void
  /**
   * Navegação em grade 2D (produtos).
   * Se omitido, ↑↓ é linear.
   */
  columns?: number
}

/**
 * Navegação padrão de grids do PDV: ↑↓ (e ←→ em grade/filtros), Enter.
 */
export function useGridKeyboardNav<T extends string>({
  ids,
  selectedId,
  setSelectedId,
  containerRef,
  enabled = true,
  onEnter,
  allowArrowsWhileTyping = true,
  filterOptions,
  filterValue,
  onFilterChange,
  columns,
}: UseGridKeyboardNavOptions<T>) {
  useEffect(() => {
    if (!enabled) return
    if (ids.length === 0) {
      if (selectedId != null) setSelectedId(null)
      return
    }
    if (!selectedId || !ids.includes(selectedId)) {
      setSelectedId(ids[0])
    }
  }, [enabled, ids, selectedId, setSelectedId])

  useEffect(() => {
    if (!enabled || !selectedId || !containerRef?.current) return
    const row = containerRef.current.querySelector<HTMLElement>(
      `[data-row-id="${CSS.escape(selectedId)}"]`,
    )
    row?.scrollIntoView({ block: 'nearest' })
  }, [enabled, selectedId, containerRef])

  useEffect(() => {
    if (!enabled) return

    function onKeyDown(event: KeyboardEvent) {
      if (ids.length === 0) return
      const typing = isTypingTarget(event.target)

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (typing && !allowArrowsWhileTyping) return

        if (filterOptions && filterOptions.length > 0 && onFilterChange && filterValue != null) {
          if (typing) return
          event.preventDefault()
          const idx = Math.max(0, filterOptions.indexOf(filterValue))
          const next =
            event.key === 'ArrowRight'
              ? Math.min(idx + 1, filterOptions.length - 1)
              : Math.max(idx - 1, 0)
          onFilterChange(filterOptions[next])
          return
        }

        if (columns && columns > 1) {
          if (typing && !allowArrowsWhileTyping) return
          event.preventDefault()
          const currentIndex = Math.max(0, ids.indexOf(selectedId as T))
          const nextIndex =
            event.key === 'ArrowRight'
              ? Math.min(currentIndex + 1, ids.length - 1)
              : Math.max(currentIndex - 1, 0)
          setSelectedId(ids[nextIndex])
        }
        return
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (typing && !allowArrowsWhileTyping) return
        event.preventDefault()
        const currentIndex = Math.max(0, ids.indexOf(selectedId as T))
        const step = columns && columns > 1 ? columns : 1
        const nextIndex =
          event.key === 'ArrowDown'
            ? Math.min(currentIndex + step, ids.length - 1)
            : Math.max(currentIndex - step, 0)
        setSelectedId(ids[nextIndex])
        return
      }

      if (event.key === 'Enter' && onEnter && selectedId) {
        if (typing) return
        event.preventDefault()
        onEnter(selectedId)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    enabled,
    ids,
    selectedId,
    setSelectedId,
    onEnter,
    allowArrowsWhileTyping,
    filterOptions,
    filterValue,
    onFilterChange,
    columns,
  ])
}
