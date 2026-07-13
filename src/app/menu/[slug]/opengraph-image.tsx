import { ImageResponse } from "next/og";
import { getOnlineMenuBySlug } from "@/modules/online-menu/services/online-menu.service";

export const alt = "منيو أونلاين";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function MenuOpenGraphImage({ params }: Props) {
  const { slug } = await params;
  const menu = await getOnlineMenuBySlug(slug, { skipRateLimit: true });
  const businessName =
    menu?.organization.name.trim() || menu?.store.name.trim() || "منيو أونلاين";
  const branchLabel =
    menu?.store.name && menu.store.name.trim() !== businessName
      ? menu.store.name.trim()
      : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: 72,
          background: "linear-gradient(160deg, #0f172a 0%, #134e4a 55%, #0e7490 100%)",
          color: "#ffffff",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 28,
            opacity: 0.8,
            marginBottom: 20,
            letterSpacing: 1,
          }}
        >
          منيو أونلاين
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: -1,
            maxWidth: 980,
          }}
        >
          {businessName}
        </div>
        {branchLabel ? (
          <div
            style={{
              marginTop: 24,
              fontSize: 32,
              opacity: 0.9,
            }}
          >
            {branchLabel}
          </div>
        ) : null}
      </div>
    ),
    { ...size }
  );
}
