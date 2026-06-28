import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";

export default function ShellNotFound() {
  return (
    <EmptyStateBlock
      title="الصفحة غير موجودة"
      description="الصفحة التي تبحث عنها غير موجودة أو غير متاحة لمستوى صلاحيتك."
      ctaHref="/"
      ctaLabel="الذهاب للوحة التحكم"
    />
  );
}
