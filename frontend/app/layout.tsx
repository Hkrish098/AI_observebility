import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "AmazonHelp",
  description: "Customer tweets on the left. How each one was handled on the right.",
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
