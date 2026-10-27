import type { Metadata } from "next";
import "./globals.css";
import { InputModality } from "@/components/layout/input-modality";
export const metadata: Metadata = {
  title: { default: "GrantsNow", template: "%s | GrantsNow" },
  description: "Research administration workspace",
  robots: { index: false, follow: false },
  // Legacy index.html's favicon (one icon for light and dark).
  icons: { icon: { url: "/images/gn.ico", type: "image/x-icon" } },
};
// Oracle Sans + oj-ux-ico glyphs (D13, D14): the same gallery bundle the VBCS app loads.
const oracleGallery =
  "https://static.oracle.com/cdn/fnd/gallery/2307.0.0/images/iconfont/ojuxgallerybundle.min.css";
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://static.oracle.com" />
        <link rel="stylesheet" href={oracleGallery} />
      </head>
      <body>
        <InputModality />
        <a id="skip-link" className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
