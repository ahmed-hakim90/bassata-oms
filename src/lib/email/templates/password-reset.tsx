import { Button, Link, Text } from "@react-email/components";
import { EmailLayout, emailTextStyles } from "@/lib/email/layout";

export function PasswordResetEmail(props: { resetUrl: string }) {
  return (
    <EmailLayout preview="إعادة تعيين كلمة المرور — Velora">
      <Text style={emailTextStyles.heading}>إعادة تعيين كلمة المرور</Text>
      <Text style={emailTextStyles.paragraph}>
        استلمنا طلب لإعادة تعيين كلمة المرور لحسابك على Velora. اضغط الزر
        التالي لاختيار كلمة مرور جديدة.
      </Text>
      <Text style={{ margin: "20px 0" }}>
        <Button href={props.resetUrl} style={emailTextStyles.button}>
          تعيين كلمة مرور جديدة
        </Button>
      </Text>
      <Text style={emailTextStyles.muted}>
        اللينك صالح لفترة قصيرة. لو الزر مش شغال، انسخ الرابط ده في المتصفح:
      </Text>
      <Text style={{ ...emailTextStyles.muted, wordBreak: "break-all" as const }}>
        <Link href={props.resetUrl} style={{ color: "#0f766e" }}>
          {props.resetUrl}
        </Link>
      </Text>
      <Text style={emailTextStyles.muted}>
        لو ما طلبتش إعادة التعيين، تجاهل الرسالة — حسابك زي ما هو.
      </Text>
    </EmailLayout>
  );
}
