import { Text } from "@react-email/components";
import { EmailLayout, emailTextStyles } from "@/lib/email/layout";

export function PlatformBroadcastEmail(props: {
  subject: string;
  body: string;
  orgName?: string;
}) {
  const paragraphs = props.body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <EmailLayout preview={props.subject}>
      <Text style={emailTextStyles.heading}>{props.subject}</Text>
      {props.orgName ? (
        <Text style={emailTextStyles.muted}>إلى: {props.orgName}</Text>
      ) : null}
      {paragraphs.map((line) => (
        <Text key={line.slice(0, 24)} style={emailTextStyles.paragraph}>
          {line}
        </Text>
      ))}
    </EmailLayout>
  );
}
