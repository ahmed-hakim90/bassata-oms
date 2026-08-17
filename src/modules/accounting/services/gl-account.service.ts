import * as glRepo from "@/lib/repositories/gl-account.repository";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { GlAccount, GlAccountType } from "@/lib/types";

export type GlAccountTreeNode = GlAccount & {
  depth: number;
  children: GlAccountTreeNode[];
};

export async function ensureSeeded(): Promise<void> {
  const orgId = await getOrgId();
  const count = await glRepo.countGlAccounts();
  if (count === 0) {
    await glRepo.seedDefaultChartOfAccounts(orgId);
    return;
  }
  const overShort = await glRepo.getGlAccountBySystemKey("cash_over_short");
  if (!overShort) {
    await glRepo.ensureSystemGlAccounts(orgId);
  }
}

export async function listGlAccountsFlat(options?: {
  activeOnly?: boolean;
  postableOnly?: boolean;
}): Promise<GlAccount[]> {
  await ensureSeeded();
  return glRepo.listGlAccounts(options);
}

export function buildAccountTree(accounts: GlAccount[]): GlAccountTreeNode[] {
  const byParent = new Map<string | null, GlAccount[]>();
  for (const account of accounts) {
    const key = account.parent_id;
    const list = byParent.get(key) ?? [];
    list.push(account);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code, "en"));
  }

  function walk(parentId: string | null, depth: number): GlAccountTreeNode[] {
    return (byParent.get(parentId) ?? []).map((account) => ({
      ...account,
      depth,
      children: walk(account.id, depth + 1),
    }));
  }

  return walk(null, 0);
}

export function flattenAccountTree(nodes: GlAccountTreeNode[]): GlAccountTreeNode[] {
  const out: GlAccountTreeNode[] = [];
  function visit(list: GlAccountTreeNode[]) {
    for (const node of list) {
      out.push(node);
      if (node.children.length) visit(node.children);
    }
  }
  visit(nodes);
  return out;
}

export async function listGlAccountTree(options?: {
  activeOnly?: boolean;
}): Promise<GlAccountTreeNode[]> {
  const accounts = await listGlAccountsFlat(options);
  return buildAccountTree(accounts);
}

export async function createGlAccount(
  input: {
    parent_id?: string | null;
    code: string;
    name: string;
    account_type: GlAccountType;
    is_postable?: boolean;
    sort_order?: number;
  }
): Promise<GlAccount> {
  await ensureSeeded();
  if (!input.code.trim()) throw new Error("كود الحساب مطلوب");
  if (!input.name.trim()) throw new Error("اسم الحساب مطلوب");
  if (input.parent_id) {
    const parent = await glRepo.getGlAccount(input.parent_id);
    if (!parent) throw new Error("الحساب الأب غير موجود");
    if (parent.account_type !== input.account_type) {
      throw new Error("نوع الحساب لازم يطابق الحساب الأب");
    }
  }
  return glRepo.createGlAccount(input);
}

export async function updateGlAccount(
  id: string,
  patch: {
    parent_id?: string | null;
    code?: string;
    name?: string;
    account_type?: GlAccountType;
    is_postable?: boolean;
    is_active?: boolean;
    sort_order?: number;
  }
): Promise<GlAccount> {
  await ensureSeeded();
  const existing = await glRepo.getGlAccount(id);
  if (!existing) throw new Error("الحساب غير موجود");

  if (existing.is_system) {
    if (patch.account_type && patch.account_type !== existing.account_type) {
      throw new Error("مفيش تعديل لنوع حساب النظام");
    }
    if (patch.code && patch.code.trim() !== existing.code) {
      throw new Error("مفيش تعديل لكود حساب النظام");
    }
    if (patch.is_postable != null && patch.is_postable !== existing.is_postable) {
      throw new Error("مفيش تعديل لقابلية ترحيل حساب النظام");
    }
  }

  if (patch.parent_id === id) {
    throw new Error("الحساب مش ممكن يبقى أب لنفسه");
  }

  const nextParentId = patch.parent_id !== undefined ? patch.parent_id : existing.parent_id;
  if (nextParentId) {
    const parent = await glRepo.getGlAccount(nextParentId);
    if (!parent) throw new Error("الحساب الأب غير موجود");
    const nextType = patch.account_type ?? existing.account_type;
    if (parent.account_type !== nextType) {
      throw new Error("نوع الحساب لازم يطابق الحساب الأب");
    }
  }

  const updated = await glRepo.updateGlAccount(id, patch);
  if (!updated) throw new Error("فشل تحديث الحساب");
  return updated;
}

export async function deactivateGlAccount(id: string): Promise<GlAccount> {
  const existing = await glRepo.getGlAccount(id);
  if (!existing) throw new Error("الحساب غير موجود");
  if (existing.is_system) {
    throw new Error("مفيش تعطيل لحسابات النظام");
  }
  return updateGlAccount(id, { is_active: false });
}
