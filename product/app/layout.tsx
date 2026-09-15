import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Systems from First Principles",
  description: "Build real systems, reproduce their limits, and inspect every change.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
