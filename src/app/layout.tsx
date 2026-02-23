import "./globals.css";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "./providers";

const miFuente = localFont({
  src: [
    { path: "../../public/fonts/migthy.otf", weight: "400", style: "normal" },
  ],
  variable: "--font-main-font",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Apoteósicas by Elizabeth Rizos",
  description: "Curly hair · Reservas · Academia",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={miFuente.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
