import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";

export default function ShellNotFound() {
  return (
    <EmptyStateBlock
      title="Page not found"
      description="The page you are looking for does not exist or is not available for your access level."
      ctaHref="/"
      ctaLabel="Go to dashboard"
    />
  );
}
