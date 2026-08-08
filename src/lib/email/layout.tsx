import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

const fontStack =
  "Cairo, Tahoma, 'Segoe UI', Arial, sans-serif";

export function EmailLayout(props: {
  preview: string;
  children: ReactNode;
  footerNote?: string;
}) {
  return (
    <Html lang="ar" dir="rtl">
      <Head />
      <Preview>{props.preview}</Preview>
      <Body
        style={{
          margin: 0,
          padding: "24px 12px",
          backgroundColor: "#f4f4f5",
          fontFamily: fontStack,
          color: "#18181b",
          direction: "rtl",
        }}
      >
        <Container
          style={{
            maxWidth: "560px",
            margin: "0 auto",
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            padding: "28px 24px",
            border: "1px solid #e4e4e7",
          }}
        >
          <Text
            style={{
              margin: "0 0 4px",
              fontSize: "22px",
              fontWeight: 700,
              color: "#0f766e",
              letterSpacing: "-0.02em",
            }}
          >
            Velora
          </Text>
          <Text
            style={{
              margin: "0 0 20px",
              fontSize: "13px",
              color: "#71717a",
            }}
          >
            نظام الكاشير وإدارة الفروع
          </Text>
          <Section>{props.children}</Section>
          <Hr style={{ borderColor: "#e4e4e7", margin: "24px 0 16px" }} />
          <Text
            style={{
              margin: 0,
              fontSize: "12px",
              lineHeight: "1.6",
              color: "#a1a1aa",
            }}
          >
            {props.footerNote ??
              "هذه رسالة تلقائية من Velora. لو مش متوقع الرسالة دي، تجاهلها بأمان."}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const emailTextStyles = {
  heading: {
    margin: "0 0 12px",
    fontSize: "18px",
    fontWeight: 700,
    color: "#18181b",
    lineHeight: "1.4",
  } as const,
  paragraph: {
    margin: "0 0 12px",
    fontSize: "14px",
    lineHeight: "1.7",
    color: "#3f3f46",
  } as const,
  muted: {
    margin: "0 0 12px",
    fontSize: "13px",
    lineHeight: "1.6",
    color: "#71717a",
  } as const,
  label: {
    margin: "0 0 4px",
    fontSize: "12px",
    color: "#71717a",
  } as const,
  value: {
    margin: "0 0 12px",
    fontSize: "14px",
    fontWeight: 600,
    color: "#18181b",
  } as const,
  button: {
    display: "inline-block",
    backgroundColor: "#0f766e",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 600,
    textDecoration: "none",
    padding: "12px 20px",
    borderRadius: "8px",
  } as const,
};
