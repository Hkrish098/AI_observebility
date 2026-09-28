import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "AmazonHelp",
  description: "See how AI understands a customer request, retrieves context, and decides what to send.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-paper text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
