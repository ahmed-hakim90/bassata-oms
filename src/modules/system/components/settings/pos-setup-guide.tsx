"use client";

import Link from "next/link";
import { OperationalCard } from "@/components/SweetFlow/operational-card";

const steps = [
  { text: "Add or select a branch below and save branch details." },
  { text: "Confirm an active default warehouse exists for the branch." },
  { text: "Add a POS device under the same branch card." },
  {
    text: "Pair the terminal at /device/pair with a one-time code, or click Register this browser on the device row.",
    href: "/device/pair",
  },
  {
    text: "Create cashiers in Settings → Users & Roles with branch access, password (8+ chars), and optional device restrictions.",
    href: "/settings?tab=users",
  },
  { text: "Cashier signs in at /login with email and password." },
  { text: "Cashier selects branch if they have more than one.", href: "/pos/start" },
  { text: "Cashier opens a session from Sessions.", href: "/sessions" },
  { text: "Sell on POS.", href: "/pos" },
];

export function PosSetupGuide() {
  return (
    <OperationalCard title="POS go-live checklist">
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        {steps.map((step, i) => (
          <li key={i}>
            {step.href ? (
              <Link
                href={step.href}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {step.text}
              </Link>
            ) : (
              step.text
            )}
          </li>
        ))}
      </ol>
    </OperationalCard>
  );
}
