import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "GrantsNow", template: "%s | GrantsNow" },
  description: "Research administration workspace",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
