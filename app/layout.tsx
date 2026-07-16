import type { Metadata } from "next";
import { Inter, Lexend } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
});

export const metadata: Metadata = {
  title: "Addlet | Image Markup for Google Docs",
  description: "Addlet builds Image Markup, a Google Docs add-on for visual image notes and clean AI revisions.",
  verification: {
    google: "0gV3N6gTfQcGDg3rGHRo6iXocty9otWVz-Ws5nIEjhM",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${lexend.variable}`}>{children}</body>
    </html>
  );
}
