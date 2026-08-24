import type { Metadata } from "next";
import { Barlow_Condensed, Manrope } from "next/font/google";
import "@/app/globals.css";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const body = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Personal Prime | Gestão de Ponto",
  description: "Sistema interno do RH para importação e tratamento de ponto.",
  icons: {
    icon: [{ url: "/brand/personal-prime-symbol-orange.png", type: "image/png" }],
    apple: [{ url: "/brand/personal-prime-symbol-orange.png", type: "image/png" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`${display.variable} ${body.variable}`} lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
