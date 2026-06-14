import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TechUp Sessions",
  description: "Community session coordination dashboard",
  icons: {
    icon: "/techup.png",
    shortcut: "/techup.png",
    apple: "/techup.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
