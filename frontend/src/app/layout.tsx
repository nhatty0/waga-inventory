import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { LanguageProvider } from "@/context/LanguageContext";
import { ShopProvider } from "@/context/ShopContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ዋጋ ኢንቬንቶሪ - Waga Inventory | Estif Electronics",
  description: "የኤሌክትሮኒክስ ሱቅ ክምችትና የጎረቤት ብድር ማስተዳደሪያ - እስቲፍ ኤሌክትሮኒክስ (Gondar, Piassa)",
  manifest: "/manifest.json",
  applicationName: "Waga Stock",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Waga Stock",
  },
  formatDetection: {
    telephone: true,
  },
  icons: {
    icon: "/icons/icon-192.svg",
    apple: "/icons/icon-192.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1e293b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="am" className="dark h-full">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#1e293b" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-slate-950 text-slate-100 antialiased font-sans flex flex-col selection:bg-blue-600 selection:text-white`}
      >
        <ShopProvider>
          <LanguageProvider>
            <main className="flex-1 pb-20">{children}</main>
            <BottomNav />
          </LanguageProvider>
        </ShopProvider>
      </body>
    </html>
  );
}
