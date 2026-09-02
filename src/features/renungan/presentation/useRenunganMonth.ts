"use client";

import { useCallback, useEffect, useState } from "react";
import type { RenunganMonthResponse } from "./types";

type State = {
  data: RenunganMonthResponse | null;
  loading: boolean;
  error: string | null;
};

export function useRenunganMonth(month: string) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`/api/renungan?month=${encodeURIComponent(month)}`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as RenunganMonthResponse;
      setState({ data, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      setState({ data: null, loading: false, error: message });
    }
  }, [month]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}
