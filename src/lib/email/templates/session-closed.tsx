import { Text } from "@react-email/components";
import { EmailLayout, emailTextStyles } from "@/lib/email/layout";

export function SessionClosedEmail(props: {
  storeName: string;
  cashierName: string;
  openedAtLabel: string;
  closedAtLabel: string;
  openingCashLabel: string;
  expectedCashLabel: string;
  actualCashLabel: string;
  varianceLabel: string;
  varianceNotable: boolean;
  forceClosed: boolean;
  closeReason?: string | null;
}) {
  const preview = props.forceClosed
    ? `إغلاق إجباري لوردية — ${props.storeName}`
    : `إغلاق وردية — ${props.storeName}`;

  return (
    <EmailLayout preview={preview}>
      <Text style={emailTextStyles.heading}>
        {props.forceClosed ? "إغلاق إجباري للوردية" : "تم إغلاق وردية"}
      </Text>
      <Text style={emailTextStyles.paragraph}>
        ملخص إغلاق الجلسة في فرع <strong>{props.storeName}</strong>.
      </Text>

      <Text style={emailTextStyles.label}>الكاشير</Text>
      <Text style={emailTextStyles.value}>{props.cashierName}</Text>

      <Text style={emailTextStyles.label}>الفتح / الإغلاق</Text>
      <Text style={emailTextStyles.value}>
        {props.openedAtLabel} → {props.closedAtLabel}
      </Text>

      <Text style={emailTextStyles.label}>نقد البداية</Text>
      <Text style={emailTextStyles.value}>{props.openingCashLabel}</Text>

      <Text style={emailTextStyles.label}>المتوقع / الفعلي</Text>
      <Text style={emailTextStyles.value}>
        {props.expectedCashLabel} / {props.actualCashLabel}
      </Text>

      <Text style={emailTextStyles.label}>فرق الخزنة</Text>
      <Text
        style={{
          ...emailTextStyles.value,
          color: props.varianceNotable ? "#b45309" : "#18181b",
        }}
      >
        {props.varianceLabel}
      </Text>

      {props.forceClosed ? (
        <Text style={{ ...emailTextStyles.paragraph, color: "#b91c1c" }}>
          تم الإغلاق إجبارياً
          {props.closeReason ? `: ${props.closeReason}` : "."}
        </Text>
      ) : null}
    </EmailLayout>
  );
}
