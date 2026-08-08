import { Button, Text } from "@react-email/components";
import { EmailLayout, emailTextStyles } from "@/lib/email/layout";

export function WelcomeOnboardingEmail(props: {
  ownerName: string;
  orgName: string;
  loginUrl: string;
}) {
  return (
    <EmailLayout preview={`مرحباً بك في Velora — ${props.orgName}`}>
      <Text style={emailTextStyles.heading}>أهلاً بك في Velora</Text>
      <Text style={emailTextStyles.paragraph}>
        مرحباً {props.ownerName}، تم تجهيز حساب{" "}
        <strong>{props.orgName}</strong> بنجاح.
      </Text>
      <Text style={emailTextStyles.paragraph}>خطوات سريعة للبداية:</Text>
      <Text style={emailTextStyles.paragraph}>
        1. راجع إعدادات الفرع والطرق الدفع
        <br />
        2. أضف المنتجات أو استورد الكتالوج
        <br />
        3. سجّل جهاز الـ POS وافتح أول وردية
      </Text>
      <Text style={{ margin: "20px 0" }}>
        <Button href={props.loginUrl} style={emailTextStyles.button}>
          فتح لوحة التحكم
        </Button>
      </Text>
      <Text style={emailTextStyles.muted}>
        لو محتاج مساعدة، رد على هذه الرسالة أو تواصل مع الدعم.
      </Text>
    </EmailLayout>
  );
}
