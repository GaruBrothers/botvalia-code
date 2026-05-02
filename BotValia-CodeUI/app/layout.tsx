import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'BotValia Runtime',
  description: 'Live Session Inspector',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className="font-sans antialiased">{children}</body>
    </html>
  );
}
