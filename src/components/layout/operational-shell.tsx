interface OperationalShellProps {
  children: React.ReactNode;
  header?: React.ReactNode;
}

export function OperationalShell({ children, header }: OperationalShellProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {header ? (
        <header className="shrink-0 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-xl md:px-6">
          {header}
        </header>
      ) : null}
      <main className="flex min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
