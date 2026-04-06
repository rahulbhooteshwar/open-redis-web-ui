import type { Metadata, Viewport } from 'next'
import { ThemeProvider } from '@/components/shared/ThemeProvider'
import { SwRegistration } from '@/components/shared/SwRegistration'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

import { Montserrat } from "next/font/google";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-sans", // important for Tailwind/shadcn
  weight: ["400", "500", "600", "700"], // choose what you need
});

export const metadata: Metadata = {
  title: 'Open Redis Web UI',
  description: 'A self-hosted web UI for managing Redis — browse, edit and manage keys from your browser.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/icon-152x152.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Open Redis Web UI',
  },
}

export const viewport: Viewport = {
  themeColor: '#292D3E',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={montserrat.variable}>
      <body className="font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <SwRegistration />
        </ThemeProvider>
      </body>
    </html>
  )
}
