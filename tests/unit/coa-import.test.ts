import { describe, expect, it } from "vitest";
import {
  mapRawCoaRow,
  orderCoaImportRows,
  parseCoaAccountType,
  parseCoaImportRows,
  planCoaImport,
  resolveCoaHeader,
} from "@/modules/accounting/lib/coa-import";

describe("coa import parser", () => {
  it("maps Arabic and English headers", () => {
    expect(resolveCoaHeader("كود")).toBe("code");
    expect(resolveCoaHeader("كود الحساب")).toBe("code");
    expect(resolveCoaHeader("Account_Type")).toBe("account_type");
    expect(resolveCoaHeader("كود الأب")).toBe("parent_code");
    expect(resolveCoaHeader("مدين")).toBe("opening_debit");
    expect(resolveCoaHeader("دائن أول المدة")).toBe("opening_credit");
  });

  it("maps Arabic account types", () => {
    expect(parseCoaAccountType("أصل")).toBe("asset");
    expect(parseCoaAccountType("خصوم")).toBe("liability");
    expect(parseCoaAccountType("إيراد")).toBe("revenue");
    expect(parseCoaAccountType("مصروف")).toBe("expense");
    expect(parseCoaAccountType("equity")).toBe("equity");
  });

  it("parses a header + child row with Arabic columns", () => {
    const parsed = mapRawCoaRow(
      {
        كود: "61",
        اسم: "مصروفات إدارية",
        نوع: "مصروف",
        "كود الأب": "5",
        "قابل للترحيل": "لا",
        ترتيب: "6100",
      },
      2
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.row).toMatchObject({
      code: "61",
      name: "مصروفات إدارية",
      account_type: "expense",
      parent_code: "5",
      is_postable: false,
      sort_order: 6100,
      opening_debit: 0,
      opening_credit: 0,
    });
  });

  it("parses opening debit and credit columns", () => {
    const parsed = mapRawCoaRow(
      {
        كود: "1111",
        اسم: "صندوق",
        نوع: "أصل",
        مدين: "250.5",
        دائن: "",
      },
      2
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.row).toMatchObject({
      opening_debit: 250.5,
      opening_credit: 0,
    });
  });

  it("rejects duplicate codes and orders parents first", () => {
    const parsed = parseCoaImportRows([
      { code: "5110", name: "كهربا", account_type: "مصروف", parent_code: "51" },
      { code: "51", name: "تشغيل", account_type: "مصروف", parent_code: "5" },
      { code: "5", name: "مصروفات", account_type: "مصروف" },
      { code: "5110", name: "مكرر", account_type: "مصروف" },
    ]);
    expect(parsed.errors.some((e) => e.message.includes("مكرر"))).toBe(true);

    const unique = parseCoaImportRows([
      { code: "5110", name: "كهربا", account_type: "مصروف", parent_code: "51" },
      { code: "51", name: "تشغيل", account_type: "مصروف", parent_code: "5" },
      { code: "5", name: "مصروفات", account_type: "مصروف" },
    ]);
    const ordered = orderCoaImportRows(unique.rows);
    expect(ordered.errors).toEqual([]);
    expect(ordered.ordered.map((r) => r.code)).toEqual(["5", "51", "5110"]);
  });

  it("detects a parent cycle in the file", () => {
    const parsed = parseCoaImportRows([
      { code: "A", name: "أ", account_type: "أصل", parent_code: "B" },
      { code: "B", name: "ب", account_type: "أصل", parent_code: "A" },
    ]);
    const ordered = orderCoaImportRows(parsed.rows);
    expect(ordered.errors.length).toBeGreaterThan(0);
  });
});

describe("planCoaImport", () => {
  const cash = {
    id: "id-cash",
    code: "1111",
    name: "الصندوق / النقدية",
    account_type: "asset" as const,
    parent_id: "id-11",
    is_postable: true,
    is_system: true,
    sort_order: 1111,
  };

  it("creates new accounts and updates names without touching system type", () => {
    const plan = planCoaImport(
      [cash],
      [
        {
          row: 2,
          code: "1111",
          name: "الخزينة",
          account_type: "asset",
          parent_code: null,
          is_postable: true,
          sort_order: 1111,
          opening_debit: 0,
          opening_credit: 0,
        },
        {
          row: 3,
          code: "1140",
          name: "عهد موظفين",
          account_type: "asset",
          parent_code: null,
          is_postable: true,
          sort_order: 1140,
          opening_debit: 0,
          opening_credit: 0,
        },
      ]
    );
    expect(plan.errors).toEqual([]);
    expect(plan.ops).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "update", id: "id-cash" }),
        expect.objectContaining({ kind: "create" }),
      ])
    );
  });

  it("rejects changing a system account type", () => {
    const plan = planCoaImport(
      [cash],
      [
        {
          row: 2,
          code: "1111",
          name: "الخزينة",
          account_type: "expense",
          parent_code: null,
          is_postable: true,
          sort_order: 1111,
          opening_debit: 0,
          opening_credit: 0,
        },
      ]
    );
    expect(plan.errors[0]?.message).toMatch(/حساب النظام/);
    expect(plan.ops).toEqual([]);
  });

  it("rejects a missing parent", () => {
    const plan = planCoaImport([], [
      {
        row: 2,
        code: "6110",
        name: "إيجار",
        account_type: "expense",
        parent_code: "61",
        is_postable: true,
        sort_order: 6110,
        opening_debit: 0,
        opening_credit: 0,
      },
    ]);
    expect(plan.errors[0]?.message).toMatch(/مش موجود/);
  });

  it("rejects unbalanced opening balances", () => {
    const plan = planCoaImport([], [
      {
        row: 2,
        code: "1111",
        name: "صندوق",
        account_type: "asset",
        parent_code: null,
        is_postable: true,
        sort_order: 1111,
        opening_debit: 100,
        opening_credit: 0,
      },
    ]);
    expect(plan.errors.some((e) => e.message.includes("مش متوازنة"))).toBe(true);
  });

  it("accepts a balanced opening trial balance", () => {
    const plan = planCoaImport([], [
      {
        row: 2,
        code: "1111",
        name: "صندوق",
        account_type: "asset",
        parent_code: null,
        is_postable: true,
        sort_order: 1111,
        opening_debit: 100,
        opening_credit: 0,
      },
      {
        row: 3,
        code: "3100",
        name: "رأس المال",
        account_type: "equity",
        parent_code: null,
        is_postable: true,
        sort_order: 3100,
        opening_debit: 0,
        opening_credit: 100,
      },
    ]);
    expect(plan.errors).toEqual([]);
    expect(plan.ops.filter((op) => op.kind === "create")).toHaveLength(2);
  });

  it("rejects openings on header accounts", () => {
    const plan = planCoaImport([], [
      {
        row: 2,
        code: "11",
        name: "أصول متداولة",
        account_type: "asset",
        parent_code: null,
        is_postable: false,
        sort_order: 11,
        opening_debit: 50,
        opening_credit: 0,
      },
      {
        row: 3,
        code: "3100",
        name: "رأس المال",
        account_type: "equity",
        parent_code: null,
        is_postable: true,
        sort_order: 3100,
        opening_debit: 0,
        opening_credit: 50,
      },
    ]);
    expect(plan.errors.some((e) => e.message.includes("القابلة للترحيل"))).toBe(
      true
    );
  });
});
