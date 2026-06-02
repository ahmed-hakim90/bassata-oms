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
          className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
        >
          <Icon className="size-4 text-primary" />
          {label}
        </Link>
      ))}
    </div>
  );
}
