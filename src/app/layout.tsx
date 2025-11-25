import type { Metadata } from "next";
import { Anta } from "next/font/google";
import "./globals.css";
import { TRPCReactProvider } from "@/trpc/client";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/components/auth-provider";

const anta = Anta({
  variable: "--font-anta",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  description: "Build lit with mSpace — your AI hype squad for coding",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <TRPCReactProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <meta charSet="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <meta name="description" content="mSPACE" />
          <meta name="keywords" content="mSPACE" />
          <meta name="author" content="mSPACE Yancey Sanford" />
          <meta name="robots" content="index, follow" />

          <meta property="og:type" content="website" />
          <meta property="og:title" content="mSPACE" />
          <meta property="og:description" content="mSPACE" />
          <meta property="og:url" content="https://mstro.ai" />
          <meta property="og:site_name" content="mSPACE" />
          <meta
            property="og:image"
            content="https://i.imgur.com/WG9XtSx.jpeg"
          />
          <meta property="og:image:alt" content="mSPACE" />

          <link rel="icon" href="/logo.png" />
          <link
            rel="apple-touch-icon"
            sizes="180x180"
            href="/apple-touch-icon.png"
          />
          <link rel="icon" type="image/png" sizes="32x32" href="/logo.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/logo.png" />
          <link rel="manifest" href="/site.webmanifest" />
          <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#ff6600" />
          <meta name="msapplication-TileColor" content="#ffffff" />
          <meta name="theme-color" content="#ffffff" />
        </head>
        <body className={`${anta.variable} antialiased`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AuthProvider>
              <Toaster />
              {children}
            </AuthProvider>
          </ThemeProvider>
        </body>
      </html>
    </TRPCReactProvider>
  );
}
