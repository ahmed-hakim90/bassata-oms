import QRCode from "qrcode";

export async function commercialDocumentQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 112,
    errorCorrectionLevel: "M",
  });
}
