import type { Metadata, Viewport } from "next";
import "./fonts.css";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { LoginDialog } from "@/components/LoginDialog";

const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined;

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  vercelProductionUrl ||
  process.env.URL ||
  "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "SportSlot | Méně domlouvání. Více hraní.",
  description:
    "Tvůj čas. Tvoje hra. Objev SportSlot, vznikající platformu pro rezervace tenisových kurtů, padelu a dalších sportovišť. Vyzkoušej si ukázku rezervace.",
  openGraph: {
    type: "website",
    locale: "cs_CZ",
    siteName: "SportSlot",
    title: "Méně domlouvání. Více hraní. | SportSlot",
    description: "Tvůj další dobrý den začíná hrou. Objev SportSlot a vyzkoušej si ukázku rezervace.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9f4" },
    { media: "(prefers-color-scheme: dark)", color: "#111f18" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body className="flex min-h-dvh flex-col bg-page font-sans text-foreground antialiased">
        <a href="#main-content" className="sr-only fixed top-3 left-3 z-40 rounded-full bg-ball px-5 py-3 font-semibold text-brand-900 focus:not-sr-only">Přejít na obsah</a>
        <AuthProvider>
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
          <LoginDialog />
        </AuthProvider>
      </body>
    </html>
  );
}
