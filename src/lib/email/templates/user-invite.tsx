import { Button, Link, Text } from "@react-email/components";
import { EmailLayout, emailTextStyles } from "@/lib/email/layout";

export function UserInviteEmail(props: {
  recipientName: string;
  orgName: string;
  roleLabel: string;
  loginUrl: string;
  setPasswordUrl: string;
}) {
  return (
    <EmailLayout preview={`دعوة للانضمام إلى ${props.orgName} على Velora`}>
      <Text style={emailTextStyles.heading}>تمت إضافة حسابك على Velora</Text>
      <Text style={emailTextStyles.paragraph}>
        مرحباً {props.recipientName}، تم إنشاء حساب لك في{" "}
        <strong>{props.orgName}</strong> بدور <strong>{props.roleLabel}</strong>.
      </Text>
      <Text style={emailTextStyles.paragraph}>
        عيّن كلمة المرور الخاصة بك أولاً، بعدين سجّل الدخول للنظام.
      </Text>
      <Text style={{ margin: "20px 0 8px" }}>
        <Button href={props.setPasswordUrl} style={emailTextStyles.button}>
          تعيين كلمة المرور
        </Button>
      </Text>
      <Text style={emailTextStyles.muted}>
        بعد التعيين تقدر تدخل من هنا:{" "}
        <Link href={props.loginUrl} style={{ color: "#0f766e" }}>
          {props.loginUrl}
        </Link>
      </Text>
    </EmailLayout>
  );
}
