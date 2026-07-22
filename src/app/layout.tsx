import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { BackToTop } from "@/components/ui/back-to-top";

export const metadata: Metadata = {
  title: "Garage ERP",
  description: "Simple Garage ERP System",
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
