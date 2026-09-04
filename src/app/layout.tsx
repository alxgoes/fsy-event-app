import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Cinzel, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ProfileProvider } from "@/lib/supabase/useProfile";
import { SeigaihaBackground } from "@/components/ui/SeigaihaBackground";

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
};

export const metadata: Metadata = {
  title: "FSY Sessão Ribeirão Preto 2",
  description: "Web application for FSY Sessão Ribeirão Preto 2 event",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
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
          </ProfileProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
