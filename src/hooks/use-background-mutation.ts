"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useBackgroundMutationStore } from "@/stores/background-mutation-store";

export type BackgroundMutationRunInput<T> = {
  /** Stable key — same key cannot run twice while pending. */
  key: string;
  /** Arabic loading copy shown in toast. */
  label: string;
  execute: () => Promise<T>;
  onSuccess?: (result: T) => void;
  onError?: (error: string) => void;
  /** Optional success toast; omit to handle in onSuccess. */
  successMessage?: string | ((result: T) => string);
};

/**
 * Fire-and-forget operator mutation: toast.loading → success/error,
 * track pending keys for list badges / double-submit guards.
 */
export function useBackgroundMutation() {
  const start = useBackgroundMutationStore((s) => s.start);
  const succeed = useBackgroundMutationStore((s) => s.succeed);
  const fail = useBackgroundMutationStore((s) => s.fail);
  const clear = useBackgroundMutationStore((s) => s.clear);
  const isPending = useCallback(
    (key: string) => useBackgroundMutationStore.getState().isPending(key),
    []
  );

  const run = useCallback(
    <T,>(input: BackgroundMutationRunInput<T>): boolean => {
      const accepted = start(input.key, input.label);
      if (!accepted) {
        toast.message("نفس العملية لسه بتخلّص…");
        return false;
      }

      toast.loading(input.label, { id: input.key });

      void (async () => {
        try {
          const result = await input.execute();
          succeed(input.key);
          const successMsg =
            typeof input.successMessage === "function"
              ? input.successMessage(result)
              : input.successMessage;
          if (successMsg) {
            toast.success(successMsg, { id: input.key });
          } else {
            toast.dismiss(input.key);
          }
          input.onSuccess?.(result);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "حصلت مشكلة أثناء الحفظ";
          fail(input.key, message);
          toast.error(message, { id: input.key });
          input.onError?.(message);
          // Keep error state briefly for badges, then clear.
          window.setTimeout(() => clear(input.key), 8000);
        }
      })();

      return true;
    },
    [start, succeed, fail, clear]
  );

  return { run, isPending };
}

export function backgroundMutationKey(
  domain: "purchase" | "pos" | "sales" | "transfer",
  action: string,
  id: string
): string {
  return `${domain}:${action}:${id}`;
}
