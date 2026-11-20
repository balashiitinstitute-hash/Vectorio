import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vectorio AI — Image to Vector-Style Prompt Generator",
  description: "Create image-aware prompts for vector illustration, laser engraving-style black and white artwork, and clean line drawings with Gemini."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}