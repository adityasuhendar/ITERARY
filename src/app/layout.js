import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: "DWash Laundry",
  description: 'DWash Laundry — Cuci sendiri lebih hemat! Registrasi aplikasi, kumpulkan poin, dan nikmati banyak kemudahan di setiap transaksi.',
  keywords: ['laundry', 'self service laundry', 'cuci kering lipat', 'dwash', 'laundry terdekat', 'laundry kiloan'],

  // Google Search Console Verification (ganti dengan code kamu)
  verification: {
    google: 'google6b2799f0e29492a6.html',
  },

  // Open Graph (Facebook, WhatsApp, LinkedIn, etc.)
  openGraph: {
    title: 'DWash Laundry - Self Service Laundry',
    description: 'DWash Laundry — Cuci sendiri lebih hemat! Registrasi aplikasi, kumpulkan poin, dan nikmati banyak kemudahan di setiap transaksi.',
    url: 'https://dwashlaundry.com',
    siteName: 'DWash Laundry',
    images: [
      {
        url: '/images/logo/logo-dwash.jpg',
        width: 1200,
        height: 630,
        alt: 'DWash Laundry Logo',
      }
    ],
    locale: 'id_ID',
    type: 'website',
  },

  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'DWash Laundry - Self Service Laundry',
    description: 'DWash Laundry — Cuci sendiri lebih hemat! Registrasi aplikasi, kumpulkan poin, dan nikmati banyak kemudahan di setiap transaksi.',
    images: ['/images/logo/logo-dwash.jpg'],
  },

  icons: {
    icon: '/favicon.ico',
    apple: '/images/logo/logo-dwash.jpg',
  },

  manifest: '/manifest.json',

  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DWash Laundry',
  },

  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'DWash Laundry',
    'application-name': 'DWash Laundry',
    'msapplication-TileColor': '#FFFFFF',
    'theme-color': '#FFFFFF',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#FFFFFF" />
        <link rel="apple-touch-icon" href="/images/logo/logo-dwash.jpg" />

        {/* JSON-LD Structured Data for Google */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "DWash Laundry",
              "description": 'DWash Laundry — Cuci sendiri lebih hemat! Registrasi aplikasi, kumpulkan poin, dan nikmati banyak kemudahan di setiap transaksi.',
              "description": "Self Service Laundry - Cuci, Kering, Lipat",
              "url": "https://dwashlaundry.com",
              "logo": "https://dwashlaundry.com/images/logo/logo-dwash.jpg",
              "image": "https://dwashlaundry.com/images/logo/logo-dwash.jpg",
              "founder": {
                "@type": "Person",
                "name": "DWash"
              },
              "sameAs": [],
              "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "Customer Service",
                "availableLanguage": ["Indonesian"]
              }
            })
          }}
        />

        {/* JSON-LD for Sitelinks - 7 Branches */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "DWash Laundry",
              "url": "https://dwashlaundry.com",
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://dwashlaundry.com/#cabang-{search_term_string}",
                "query-input": "required name=search_term_string"
              },
              "hasPart": [
                {
                  "@type": "WebPage",
                  "@id": "https://dwashlaundry.com/#cabang-tanjung-senang",
                  "name": "Cabang Tanjung Senang",
                  "url": "https://dwashlaundry.com/#cabang-tanjung-senang",
                  "description": "DWash Laundry Tanjung Senang - 5 Mesin Cuci + 5 Pengering"
                },
                {
                  "@type": "WebPage",
                  "@id": "https://dwashlaundry.com/#cabang-panglima-polim",
                  "name": "Cabang Panglima Polim",
                  "url": "https://dwashlaundry.com/#cabang-panglima-polim",
                  "description": "DWash Laundry Panglima Polim - 5 Mesin Cuci + 5 Pengering"
                },
                {
                  "@type": "WebPage",
                  "@id": "https://dwashlaundry.com/#cabang-sukarame",
                  "name": "Cabang Sukarame",
                  "url": "https://dwashlaundry.com/#cabang-sukarame",
                  "description": "DWash Laundry Sukarame - 6 Mesin Cuci + 6 Pengering"
                },
                {
                  "@type": "WebPage",
                  "@id": "https://dwashlaundry.com/#cabang-korpri",
                  "name": "Cabang Korpri",
                  "url": "https://dwashlaundry.com/#cabang-korpri",
                  "description": "DWash Laundry Korpri - 5 Mesin Cuci + 5 Pengering"
                },
                {
                  "@type": "WebPage",
                  "@id": "https://dwashlaundry.com/#cabang-gedong-meneng",
                  "name": "Cabang Gedong Meneng",
                  "url": "https://dwashlaundry.com/#cabang-gedong-meneng",
                  "description": "DWash Laundry Gedong Meneng - 5 Mesin Cuci + 5 Pengering"
                },
                {
                  "@type": "WebPage",
                  "@id": "https://dwashlaundry.com/#cabang-untung",
                  "name": "Cabang Untung",
                  "url": "https://dwashlaundry.com/#cabang-untung",
                  "description": "DWash Laundry Untung - 3 Mesin Cuci + 3 Pengering"
                },
                {
                  "@type": "WebPage",
                  "@id": "https://dwashlaundry.com/#cabang-komarudin",
                  "name": "Cabang Komarudin",
                  "url": "https://dwashlaundry.com/#cabang-komarudin",
                  "description": "DWash Laundry Komarudin - 3 Mesin Cuci + 3 Pengering"
                }
              ]
            })
          }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning={true}>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', async function() {
                  try {
                    const registration = await navigator.serviceWorker.register('/sw.js');
                    // console.log('SW registered: ', registration);

                    // Wait for service worker to be ready
                    await navigator.serviceWorker.ready;
                    // console.log('SW ready for push notifications');
                  } catch (registrationError) {
                    console.log('SW registration failed: ', registrationError);
                  }
                });
              }
            `
          }}
        />
      </body>
    </html>
  )
}