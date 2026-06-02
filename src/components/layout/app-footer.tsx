const PORTFOLIO_URL = "https://portfolio-flame-tau-19.vercel.app/";

export function AppFooter() {
  return (
    <footer className="shrink-0 border-t border-border/60 bg-background/80 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+5rem)] text-center text-sm text-muted-foreground backdrop-blur-xl md:px-6 md:pb-3">
      <span>صنع بـ </span>
      <a
        href={PORTFOLIO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-primary transition-colors hover:text-primary/80 hover:underline"
      >
        Hakim
      </a>
      <span> · جميع الحقوق محفوظة</span>
    </footer>
  );
}
