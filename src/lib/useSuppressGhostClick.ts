"use client";

import { useEffect, useState } from "react";

/**
 * Evita o "ghost click" após navegação (comum no mobile/touch):
 * o toque no card da tela anterior cai no botão que aparece sob o dedo
 * na tela seguinte (ex.: Editar da 1ª linha do grid).
 *
 * Use com `pointerEvents: armed ? "auto" : "none"` no container.
 */
export function useSuppressGhostClick(ms = 450) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    setArmed(false);
    const t = window.setTimeout(() => setArmed(true), ms);
    return () => window.clearTimeout(t);
  }, [ms]);

  return armed;
}
