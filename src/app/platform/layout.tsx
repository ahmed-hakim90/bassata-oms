import { redirect } from "next/navigation";
import { logoutAction } from "@/modules/auth/actions/logout.action";
import { requirePlatformAdmin } from "@/lib/platform/auth";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requirePlatformAdmin();
  } catch {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b bg-card/70">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="text-sm font-semibold">SweetFlow Platform</div>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
      {children}
    </div>
  );
}
