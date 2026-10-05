import type { Metadata } from "next";
import { Geist, Geist_Mono, Jacques_Francois } from "next/font/google";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Only used by the DoorCal wordmark (src/components/Logo.tsx).
const wordmarkFont = Jacques_Francois({
  weight: "400",
  variable: "--font-wordmark",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Open-source scheduling that syncs with your Google or Microsoft calendar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${wordmarkFont.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
