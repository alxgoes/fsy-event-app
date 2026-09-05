import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Cinzel, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ProfileProvider } from "@/lib/supabase/useProfile";
import { SeigaihaBackground } from "@/components/ui/SeigaihaBackground";
import { PwaManager } from "@/components/pwa/PwaManager";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-heading",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#007DA5",
};

export const metadata: Metadata = {
  title: "FSY Sessão Ribeirão Preto 2",
  description: "Web application for FSY Sessão Ribeirão Preto 2 event",
  applicationName: "FSY RP 2",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FSY RP 2",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icon.svg",
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} ${cinzel.variable} ${cormorant.variable}`}
    >
      <body className="min-h-screen font-sans antialiased bg-transparent selection:bg-[#FFE48A] selection:text-slate-900">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <SeigaihaBackground />
          <ProfileProvider>
            {children}
            <PwaManager />
          </ProfileProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
