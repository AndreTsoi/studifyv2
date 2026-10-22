import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./journal.css";
import "./landing.css";
export const metadata: Metadata = {
  title: {
    default: "Studify — Your personal study journal",
    template: "%s · Studify",
  },
  description:
    "Reflect on your study sessions, see what is working, and choose a clearer next step.",
  applicationName: "Studify",
};
export const viewport: Viewport = {
  themeColor: "#1a1a1a",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
