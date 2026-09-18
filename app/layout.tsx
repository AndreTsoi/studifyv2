import type { Metadata } from "next";
import "./globals.css";
import "./journal.css";
export const metadata: Metadata = {
  title: "Study Journal — A clearer next step",
  description:
    "A study journal that helps you understand what is working. Reflect on your sessions, explore your habits, and choose a clearer next step.",
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
