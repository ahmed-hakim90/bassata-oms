import { Button, Link, Text } from "@react-email/components";
import { EmailLayout, emailTextStyles } from "@/lib/email/layout";

export function PlatformInviteEmail(props: {
  ownerName?: string;
  orgName: string;
  inviteUrl: string;
  expiresAtLabel: string;
}) {
  const greeting = props.ownerName?.trim()
    ? `مرحباً ${props.ownerName.trim()}،`
    : "مرحباً،";

  return (
    <EmailLayout preview={`دعوة لإنشاء ${props.orgName} على Velora`}>
      <Text style={emailTextStyles.heading}>دعوة لإنشاء شركتك على Velora</Text>
      <Text style={emailTextStyles.paragraph}>
        {greeting} تمت دعوتك لتسجيل شركة <strong>{props.orgName}</strong>.
      </Text>
      <Text style={emailTextStyles.paragraph}>
        اضغط الزر لإكمال التسجيل. الدعوة تنتهي في{" "}
        <strong>{props.expiresAtLabel}</strong>.
      </Text>
      <Text style={{ margin: "20px 0" }}>
        <Button href={props.inviteUrl} style={emailTextStyles.button}>
          ابدأ التسجيل
        </Button>
      </Text>
      <Text style={emailTextStyles.muted}>
        لو الزر مش شغال، انسخ الرابط:
      </Text>
      <Text style={{ ...emailTextStyles.muted, wordBreak: "break-all" as const }}>
        <Link href={props.inviteUrl} style={{ color: "#0f766e" }}>
          {props.inviteUrl}
        </Link>
      </Text>
    </EmailLayout>
  );
}
