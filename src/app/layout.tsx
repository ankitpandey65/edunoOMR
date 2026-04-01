import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { getAppSettings } from "@/lib/app-settings";

const dm = DM_Sans({ subsets: ["latin"], variable: "--font-dm" });

export const metadata: Metadata = {
  title: "Eduno Olympiad Platform",
  description: "Centralised olympiad registration, OMR, and scoring",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getAppSettings();
  const themeClass = settings.theme === "light" ? "theme-light" : "theme-dark";
  return (
    <html lang="en" className={`${dm.variable} ${themeClass}`}>
      <body className={`${dm.className} antialiased`}>{children}</body>
    </html>
  );
}
