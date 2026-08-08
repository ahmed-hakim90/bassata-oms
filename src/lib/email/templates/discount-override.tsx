import { Text } from "@react-email/components";
import { EmailLayout, emailTextStyles } from "@/lib/email/layout";

export function DiscountOverrideEmail(props: {
  storeName: string;
  cashierName: string;
  approverName: string;
  discountLabel: string;
  thresholdLabel: string;
  reason?: string | null;
  sessionId: string;
}) {
  return (
    <EmailLayout preview={`خصم بتجاوز المدير — ${props.storeName}`}>
      <Text style={emailTextStyles.heading}>تنبيه: خصم بتجاوز الحد</Text>
      <Text style={emailTextStyles.paragraph}>
        تم اعتماد خصم أعلى من الحد المسموح في فرع{" "}
        <strong>{props.storeName}</strong>.
      </Text>

      <Text style={emailTextStyles.label}>مبلغ الخصم</Text>
      <Text style={emailTextStyles.value}>{props.discountLabel}</Text>

      <Text style={emailTextStyles.label}>حد التجاوز</Text>
      <Text style={emailTextStyles.value}>{props.thresholdLabel}</Text>

      <Text style={emailTextStyles.label}>الكاشير</Text>
      <Text style={emailTextStyles.value}>{props.cashierName}</Text>

      <Text style={emailTextStyles.label}>المعتمد</Text>
      <Text style={emailTextStyles.value}>{props.approverName}</Text>

      {props.reason ? (
        <>
          <Text style={emailTextStyles.label}>السبب</Text>
          <Text style={emailTextStyles.value}>{props.reason}</Text>
        </>
      ) : null}

      <Text style={emailTextStyles.muted}>مرجع الجلسة: {props.sessionId}</Text>
    </EmailLayout>
  );
}
