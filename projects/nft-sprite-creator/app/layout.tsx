import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NFT Sprite Creator',
  description: 'Create pixel art sprite sheets from NFT characters using AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
