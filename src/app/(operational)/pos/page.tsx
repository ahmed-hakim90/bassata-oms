import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveStoreId, getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPosPathForSlug, storePosSlugFromSettings } from "@/lib/tenancy/pos-store-slug";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function PosHubPage() {
  const storeId = await getActiveStoreId();
  if (storeId) {
    const admin = createAdminClient();
    const { data: store } = await admin
      .from("stores")
      .select("settings")
      .eq("id", storeId)
      .maybeSingle();
    const settings =
      store?.settings && typeof store.settings === "object" && !Array.isArray(store.settings)
        ? (store.settings as Record<string, unknown>)
        : null;
    const slug = storePosSlugFromSettings(settings);
    if (slug) redirect(buildPosPathForSlug(slug));
  }

  const user = await getCurrentUser();
  if (user) {
    const admin = createAdminClient();
    let query = admin
      .from("stores")
      .select("id, name, settings")
      .eq("org_id", user.org_id)
      .eq("is_active", true)
      .order("name");
    if (user.role === "cashier" || user.role === "inventory") {
      if (user.store_ids.length === 0) {
        /* keep empty */
      } else {
        query = query.in("id", user.store_ids);
      }
    }
    const { data: stores } = await query;
    const withSlug = (stores ?? [])
      .map((row) => {
        const settings =
          row.settings && typeof row.settings === "object" && !Array.isArray(row.settings)
            ? (row.settings as Record<string, unknown>)
            : {};
        const slug = storePosSlugFromSettings(settings);
        return slug ? { id: row.id, name: row.name, slug, path: buildPosPathForSlug(slug) } : null;
      })
      .filter(Boolean) as { id: string; name: string; slug: string; path: string }[];

    if (withSlug.length === 1) {
      redirect(withSlug[0]!.path);
    }

    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center gap-4 p-6">
        <h1 className="text-xl font-semibold">اختار فرع الكاشير</h1>
        <p className="text-sm text-muted-foreground">
          كل فرع ليه رابط ثابت. افتح رابط الفرع ودخل برقم PIN.
        </p>
        {withSlug.length === 0 ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            مفيش slug للفروع. من الإعدادات ← الفروع اكتب رابط المنيو (slug) لكل فرع، وبعدين افتح{" "}
            <span className="font-mono" dir="ltr">
              /اسم-الفرع/pos
            </span>
            .
          </p>
        ) : (
          <ul className="space-y-2">
            {withSlug.map((store) => (
              <li key={store.id}>
                <Link
                  href={store.path}
                  className={cn(buttonVariants({ variant: "outline" }), "h-12 w-full justify-between rounded-xl")}
                >
                  <span>{store.name}</span>
                  <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                    {store.path}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">رابط نقطة البيع</h1>
      <p className="text-sm text-muted-foreground">
        افتح رابط الفرع مباشرة، مثال:{" "}
        <span className="font-mono text-foreground" dir="ltr">
          /nutalla/pos
        </span>
      </p>
      <p className="text-xs text-muted-foreground">
        الـ slug بيتكتب من الإعدادات ← الفروع (نفس slug المنيو).
      </p>
      <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "rounded-xl")}>
        دخول الإدارة
      </Link>
    </div>
  );
}
