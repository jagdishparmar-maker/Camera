import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GateMS",
  description: "Vehicle gate management - PocketBase",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/gate.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/gate.svg" }],
  },
  appleWebApp: {
    capable: true,
    title: "GateMS",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
