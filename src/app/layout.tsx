import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { BackToTop } from "@/components/ui/back-to-top";

export const metadata: Metadata = {
  title: "Bin Matar Garage",
  description: "Bin Matar Garage Management System",
  icons: {
    icon: "/images/logo.webp",
    shortcut: "/images/logo.webp",
    apple: "/images/logo.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <BackToTop />
        </Providers>
      </body>
    </html>
  );
}
