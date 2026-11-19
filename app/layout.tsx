import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vectorify AI — Raster to Vector Style",
  description: "Transform raster images into vector-style illustrations, black and white artwork, and clean line drawings with AI."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}