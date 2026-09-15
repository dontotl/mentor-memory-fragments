"use client";
import { useEffect, useState } from "react";
import type { Interview } from "@/lib/contracts";
import { api, errorText } from "@/components/api";
export function useInterview(id: string) {
  const [interview, setInterview] = useState<Interview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api<{ interview: Interview }>(`/api/interviews/${id}`, {
      signal: controller.signal,
    })
      .then((r) => setInterview(r.interview))
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorText(e));
      });
    return () => controller.abort();
  }, [id]);
  return { interview, setInterview, error, setError };
}
