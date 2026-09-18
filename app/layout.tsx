import type { Metadata } from "next";
import { IBM_Plex_Serif, Mona_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import Navbar from "@/components/ui/Navbar";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const ibmPlexSerif=IBM_Plex_Serif({
  variable: "--font-ibm-plex-serif",
  subsets : ['latin'],
  weight : ['400','500','600','700'],
  display: 'swap'
})
const monasans=Mona_Sans({
  variable : '--font-mona-sans',
  subsets : ['latin'],
  weight: ['400','500','600','700'],
  display : 'swap'
})
export const metadata: Metadata = {
  title: "Bookified",
  description: 
  "Transform Your Books into interactive AI coversation Upload PDF's And Chat With your Books Using Voice . ",

};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${ibmPlexSerif.variable} ${monasans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          <Navbar/>
          {children}
          <Toaster/>
        </ClerkProvider>
        </body>
    </html>
  );
}
