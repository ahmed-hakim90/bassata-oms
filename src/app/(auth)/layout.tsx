export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(37,99,235,0.12),transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(96,165,250,0.08),transparent_50%)]" />
      <div className="pointer-events-none absolute -left-24 top-20 size-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-20 size-72 rounded-full bg-sky-400/10 blur-3xl" />
      <div className="relative z-10 w-full max-w-3xl">{children}</div>
    </div>
  );
}
