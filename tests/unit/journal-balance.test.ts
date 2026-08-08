import { describe, expect, it } from "vitest";
import {
  assertJournalBalanced,
  isJournalBalanced,
  journalTotals,
} from "@/modules/accounting/lib/journal-balance";

describe("journal balance helpers", () => {
  it("accepts balanced debit/credit lines", () => {
    const lines = [
      { debit: 100, credit: 0 },
      { debit: 0, credit: 60 },
      { debit: 0, credit: 40 },
    ];
    expect(isJournalBalanced(lines)).toBe(true);
    expect(journalTotals(lines)).toEqual({ debit: 100, credit: 100 });
    expect(() => assertJournalBalanced(lines)).not.toThrow();
  });

  it("rejects unbalanced lines", () => {
    const lines = [
      { debit: 100, credit: 0 },
      { debit: 0, credit: 90 },
    ];
    expect(isJournalBalanced(lines)).toBe(false);
    expect(() => assertJournalBalanced(lines)).toThrow(/مش متوازن/);
  });

  it("rejects a line with both debit and credit", () => {
    expect(() =>
      assertJournalBalanced([
        { debit: 50, credit: 50 },
        { debit: 0, credit: 0 },
      ])
    ).toThrow(/مدين أو دائن فقط/);
  });

  it("requires at least two lines", () => {
    expect(() => assertJournalBalanced([{ debit: 10, credit: 0 }])).toThrow(
      /سطرين/
    );
  });
});
