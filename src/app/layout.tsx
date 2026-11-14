import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ToastProvider';
import { AppLayoutShell } from '@/components/AppLayoutShell';
import { COMPANY_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: {
    default: `${COMPANY_NAME} | Recruitment Desk`,
    template: `%s | ${COMPANY_NAME}`,
  },
  description: `High-velocity recruitment desk and candidate screening automation for ${COMPANY_NAME}. Powered by HireFlow.`,
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

const THEME_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('hireflow_theme_preference') || localStorage.getItem('hireflow_theme');
    var isDark = false;
    if (stored === 'dark') {
      isDark = true;
    } else if (stored === 'light') {
      isDark = false;
    } else {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    var root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="font-sans antialiased min-h-screen bg-background text-primary" suppressHydrationWarning>
        <ToastProvider>
          <AppLayoutShell>{children}</AppLayoutShell>
        </ToastProvider>
      </body>
    </html>
  );
}
