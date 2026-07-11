export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-[var(--mds-color-bg-canvas)] px-[var(--mds-space-4)] py-[var(--mds-space-12)]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 0%, color-mix(in srgb, var(--mds-color-action-primary) 18%, transparent), transparent 60%), radial-gradient(ellipse 50% 40% at 100% 100%, color-mix(in srgb, var(--mds-color-action-primary) 10%, transparent), transparent 55%)",
        }}
      />
      <div className="pointer-events-none absolute -start-20 top-16 size-72 rounded-full bg-[var(--mds-color-harbor-100)] blur-3xl" />
      <div className="pointer-events-none absolute -end-16 bottom-10 size-80 rounded-full bg-[var(--mds-color-action-primary)]/10 blur-3xl" />
      <div className="relative z-10 w-full max-w-3xl">{children}</div>
    </div>
  );
}
