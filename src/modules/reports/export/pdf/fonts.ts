import { Font } from "@react-pdf/renderer";

let registered = false;

export function registerPdfFonts(): void {
  if (registered) return;
  Font.register({
    family: "Cairo",
    fonts: [
      {
        src: "https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6HkvangtZmpcWmhzfH5lWWgcQyyS4J0.woff2",
        fontWeight: 400,
      },
      {
        src: "https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6HkvangtZmpcpmzSfW5lWWgcQyyS4J0.woff2",
        fontWeight: 600,
      },
      {
        src: "https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6HkvangtZmpcpmzSfW5lWWgcQyyS4J0.woff2",
        fontWeight: 700,
      },
    ],
  });
  registered = true;
}

export const PDF_FONT = "Cairo";
