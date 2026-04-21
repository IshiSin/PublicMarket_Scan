import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Public Market Monitor",
  description: "Public markets dashboard tracking the AI ecosystem — 28 companies",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
