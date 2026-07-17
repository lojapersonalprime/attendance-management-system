import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Personal Prime | Gestão de Ponto",
  description: "Sistema interno do RH para importação e tratamento de ponto.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
