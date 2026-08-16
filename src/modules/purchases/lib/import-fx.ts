import { roundMoney } from "@/lib/money";

/** Unit cost in foreign currency → org currency (4 dp). */
export function foreignUnitToBase(foreignUnitCost: number, fxRate: number): number {
  const rate = Number(fxRate);
  if (!(rate > 0)) throw new Error("سعر التحويل لازم يكون أكبر من صفر");
  return Number((Math.max(0, foreignUnitCost) * rate).toFixed(4));
}

export function foreignLineToBase(
  foreignUnitCost: number,
  quantity: number,
  fxRate: number
): { unitCost: number; lineTotal: number; foreignLineTotal: number } {
  const foreignLineTotal = roundMoney(Math.max(0, foreignUnitCost) * Math.max(0, quantity));
  const unitCost = foreignUnitToBase(foreignUnitCost, fxRate);
  const lineTotal = roundMoney(unitCost * Math.max(0, quantity));
  return { unitCost, lineTotal, foreignLineTotal };
}

export type CertificateCostShareLine = {
  id: string;
  lineTotal: number;
};

/**
 * Allocate certificate costs across merchandise lines by line_total (org currency).
 * Last line absorbs rounding remainder.
 */
export function allocateCertificateCosts(
  lines: CertificateCostShareLine[],
  certificateCostTotal: number
): Map<string, number> {
  const shares = new Map<string, number>();
  if (lines.length === 0) return shares;
  const extra = Math.max(0, certificateCostTotal);
  const subtotal = lines.reduce((sum, line) => sum + Math.max(0, line.lineTotal), 0);
  let allocated = 0;
  lines.forEach((line, index) => {
    const baseShare = subtotal > 0 ? Math.max(0, line.lineTotal) / subtotal : 1 / lines.length;
    const share =
      index === lines.length - 1
        ? Number((extra - allocated).toFixed(2))
        : Number((extra * baseShare).toFixed(2));
    allocated += share;
    shares.set(line.id, share);
  });
  return shares;
}
