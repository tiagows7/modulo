"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isFilialPosto } from "@/lib/filialTipo";

/** True se existir ao menos uma filial ativa marcada como posto de combustível. */
export function useTemFilialPosto() {
  const [ready, setReady] = useState(false);
  const [temPosto, setTemPosto] = useState(true);

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from("filial")
      .select("tipo_filial")
      .eq("status", "ativo")
      .limit(200);

    if (error) {
      // Sem coluna ainda / falha: mantém visível para não quebrar operação
      setTemPosto(true);
      setReady(true);
      return;
    }

    const list = data ?? [];
    if (!list.length) {
      setTemPosto(false);
      setReady(true);
      return;
    }

    setTemPosto(list.some((f) => isFilialPosto(f.tipo_filial as string | null)));
    setReady(true);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ready, temPosto, reload };
}
