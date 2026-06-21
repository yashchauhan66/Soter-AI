import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Soter Chat - AI Safety Demo",
  description: "Next.js app protected by Soter AI safety layer",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
