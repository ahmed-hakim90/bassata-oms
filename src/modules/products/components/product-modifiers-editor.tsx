"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  listProductModifierGroupsAction,
  setModifierGroupActiveAction,
  upsertModifierAction,
  upsertModifierGroupAction,
} from "@/modules/products/actions/product-modifiers.actions";
import type { ProductModifierGroup } from "@/modules/products/services/product-modifiers.service";

export function ProductModifiersEditor({ productId }: { productId: string }) {
  const [groups, setGroups] = useState<ProductModifierGroup[]>([]);
  const [pending, startTransition] = useTransition();
  const [groupName, setGroupName] = useState("إضافات");
  const [modName, setModName] = useState("");
  const [modPrice, setModPrice] = useState("0");
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  function reload() {
    startTransition(async () => {
      try {
        const next = await listProductModifierGroupsAction(productId);
        setGroups(next);
        if (!activeGroupId && next[0]) setActiveGroupId(next[0].id);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "فشل تحميل الإضافات");
      }
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per product
  }, [productId]);

  return (
    <div className="space-y-4 rounded-[var(--mds-radius-md)] border border-border p-4">
      <div>
        <h3 className="text-sm font-semibold">إضافات المنتج (Modifiers)</h3>
        <p className="text-xs text-muted-foreground">
          للمجموعات مثل حجم/إضافات — تظهر في نقطة البيع عند إضافة المنتج.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label>مجموعة جديدة</Label>
          <Input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-40"
          />
        </div>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await upsertModifierGroupAction({
                productId,
                name: groupName,
                minSelect: 0,
                maxSelect: 3,
              });
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success("تم إنشاء المجموعة");
              setActiveGroupId(result.id);
              reload();
            });
          }}
        >
          إضافة مجموعة
        </Button>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا توجد مجموعات بعد.</p>
      ) : (
        <ul className="space-y-3">
          {groups.map((group) => (
            <li key={group.id} className="rounded-md border border-border/80 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-sm font-medium hover:underline"
                  onClick={() => setActiveGroupId(group.id)}
                >
                  {group.name}{" "}
                  <span className="text-muted-foreground">
                    ({group.minSelect}–{group.maxSelect})
                  </span>
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await setModifierGroupActiveAction(
                        group.id,
                        !group.isActive
                      );
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      reload();
                    });
                  }}
                >
                  {group.isActive ? "إيقاف" : "تفعيل"}
                </Button>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {group.modifiers.map((m) => (
                  <li key={m.id} className="flex justify-between gap-2">
                    <span>{m.name}</span>
                    <span className="tabular-nums text-muted-foreground" dir="ltr">
                      {m.priceDelta >= 0 ? "+" : ""}
                      {m.priceDelta}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {activeGroupId ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <div className="space-y-1">
            <Label>إضافة</Label>
            <Input
              value={modName}
              onChange={(e) => setModName(e.target.value)}
              className="w-40"
              placeholder="جبن إضافي"
            />
          </div>
          <div className="space-y-1">
            <Label>فرق السعر</Label>
            <Input
              dir="ltr"
              value={modPrice}
              onChange={(e) => setModPrice(e.target.value)}
              className="w-24 text-start"
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await upsertModifierAction({
                  groupId: activeGroupId,
                  name: modName,
                  priceDelta: Number(modPrice) || 0,
                });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                setModName("");
                toast.success("تمت الإضافة");
                reload();
              });
            }}
          >
            حفظ الإضافة
          </Button>
        </div>
      ) : null}
    </div>
  );
}
