import Link from "next/link";
import {
  Clock,
  Receipt,
  ShoppingCart,
  Wallet,
} from "lucide-react";

const actions = [
  { href: "/pos/start", label: "POS", icon: ShoppingCart },
  { href: "/sessions", label: "Sessions", icon: Clock },
  { href: "/orders", label: "Orders", icon: Receipt },
  { href: "/expenses", label: "Expenses", icon: Wallet },
];

export function QuickActionsBar() {
  return (
    <div className="flex flex-wrap gap-3">
      {actions.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="inline-flex items-center gap-2 rounded-2xl bg-card px-4 py-3 text-sm font-medium text-card-foreground shadow-sm ring-1 ring-border transition hover:bg-muted hover:shadow-md"
        >
          <Icon className="size-4 text-primary" />
          {label}
        </Link>
      ))}
    </div>
  );
}
