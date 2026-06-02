import type { ReactNode } from "react";

/** Resolve display text for a Select whose value is an entity id. */
export function selectLabelById<T extends { id: string }>(
  items: readonly T[],
  value: unknown,
  getLabel: (item: T) => string
): ReactNode {
  if (value == null || value === "") return null;
  const item = items.find((i) => i.id === value);
  return item ? getLabel(item) : null;
}

/** Resolve display text when value matches a field on each item (e.g. code → label). */
export function selectLabelByKey<T>(
  items: readonly T[],
  value: unknown,
  getKey: (item: T) => string,
  getLabel: (item: T) => string
): ReactNode {
  if (value == null || value === "") return null;
  const item = items.find((i) => getKey(i) === value);
  return item ? getLabel(item) : null;
}
