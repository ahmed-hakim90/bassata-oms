import { Link, Text } from "@react-email/components";
import { EmailLayout, emailTextStyles } from "@/lib/email/layout";

export function ScheduledReportDigestEmail(props: {
  orgName: string;
  periodLabel: string;
  revenueLabel: string;
  orderCount: number;
  reportLinks: { label: string; href: string }[];
}) {
  return (
    <EmailLayout preview={`ملخص تقارير ${props.orgName} — ${props.periodLabel}`}>
      <Text style={emailTextStyles.heading}>ملخص التقارير المجدوَل</Text>
      <Text style={emailTextStyles.paragraph}>
        مرحبًا — ده ملخص الفترة <strong>{props.periodLabel}</strong> لـ{" "}
        <strong>{props.orgName}</strong>.
      </Text>

      <Text style={emailTextStyles.label}>إجمالي المبيعات</Text>
      <Text style={emailTextStyles.value}>{props.revenueLabel}</Text>

      <Text style={emailTextStyles.label}>عدد الطلبات</Text>
      <Text style={emailTextStyles.value}>{props.orderCount}</Text>

      {props.reportLinks.length > 0 ? (
        <>
          <Text style={{ ...emailTextStyles.paragraph, marginTop: 20 }}>
            افتح التقارير التفصيلية:
          </Text>
          {props.reportLinks.map((link) => (
            <Text key={link.href} style={emailTextStyles.paragraph}>
              <Link href={link.href} style={{ color: "#0f766e", fontWeight: 600 }}>
                {link.label}
              </Link>
            </Text>
          ))}
        </>
      ) : null}
    </EmailLayout>
  );
}
