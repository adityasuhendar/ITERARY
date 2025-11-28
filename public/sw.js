// Basic Service Worker for DWash Laundry PWA
const CACHE_NAME = 'dwash-laundry-v3';
const urlsToCache = [
  // Static files yang jarang berubah
  '/',
  '/login',
  '/help',
  '/profile',
  '/manifest.json',
  
  // 🖼️ Images & Icons (Struktur rumah)
  '/images/logo/logo-dwash.jpg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/badge-72x72.png',
  
  // 📱 PWA Assets
  '/favicon.ico',
  
];

// Install event - cache resources with error handling
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        // Cache files individually with error handling
        const cachePromises = urlsToCache.map(async (url) => {
          try {
            await cache.add(url);
            console.log(`✅ Cached: ${url}`);
          } catch (error) {
            console.warn(`❌ Failed to cache: ${url}`, error.message);
            // Continue with other files even if one fails
          }
        });
        
        await Promise.allSettled(cachePromises);
        console.log('🎯 PWA Cache installation completed');
      })
      .catch(error => {
        console.error('💥 PWA Cache installation failed:', error);
      })
  );
});

// Fetch event - serve from cache when offline
// Fetch event - network-first strategy for navigation, cache-first for assets
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Don't handle navigation requests for the login page.
  if (requestUrl.pathname === '/login') {
    return; // Let the browser handle it
  }

  // Use network-first for HTML navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // If successful, cache it and return it
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
        .catch(() => {
          // If network fails, try to return the cached version
          return caches.match(event.request);
        })
    );
  } else {
    // Use cache-first for other requests (CSS, JS, images)
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          return response || fetch(event.request);
        })
    );
  }
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  // console.log('Push event received:', event); // Removed for cleaner console
  
  const defaultOptions = {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    tag: 'dwash-notification'
  };

  let notificationData = defaultOptions;
  
  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = { ...defaultOptions, ...pushData };
    } catch (error) {
      console.error('Failed to parse push data:', error);
    }
  }

  const promiseChain = self.registration.showNotification(
    notificationData.title || 'D\'Wash Laundry',
    notificationData
  );

  event.waitUntil(promiseChain);
});

// Notification click event - handle notification interactions
self.addEventListener('notificationclick', (event) => {
  // console.log('Notification click received:', event); // Removed for cleaner console
  
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/dashboard';
  const notificationData = event.notification.data || {};
  const fullUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      let targetClient = null;
      
      // Check if DWash is already open in a tab
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          targetClient = client;
          client.focus();
          if (client.url !== fullUrl) {
            await client.navigate(fullUrl);
          }
          break;
        }
      }
      
      // Open new tab if not already open
      if (!targetClient && clients.openWindow) {
        targetClient = await clients.openWindow(fullUrl);
      }

      // For kasir notifications, trigger openStockRequest event after navigation
      if (targetClient && notificationData.requestId && targetUrl.includes('/dashboard')) {
        // Small delay to ensure page is loaded
        setTimeout(() => {
          targetClient.postMessage({
            type: 'OPEN_STOCK_REQUEST',
            requestId: notificationData.requestId, // This is audit_log.id_audit
            notification: {
              id: notificationData.requestId, // Use audit_log.id_audit as notification id
              message: event.notification.body,
              action: notificationData.action,
              requestType: notificationData.requestType,
              title: event.notification.title
            }
          });
        }, 1000);
      }
    })
  );
});

// Background sync for failed notifications (optional)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-notifications') {
    event.waitUntil(
      // Handle background sync for notifications that failed to send
      handleBackgroundSync()
    );
  }
});

async function handleBackgroundSync() {
  // Placeholder for handling failed notification sends
  // This could retry sending notifications that failed due to network issues
  console.log('Background sync for notifications');
}

// ==========================================
// BISMILLAH - PWA PERSISTENT NOTIFICATION SYSTEM  
// ==========================================

// Storage for active monitoring
let customerNotificationState = {
  isMonitoring: false,
  lastCheck: null,
  customers: new Map() // phone -> customer data
}

// PWA Installation Detection & Enhanced Notification System
async function isPWAInstalled() {
  try {
    // Check if app is running in standalone mode (installed PWA)
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://') ||
           // Check if launched from home screen
           window.location.search.includes('source=pwa') ||
           // Check installation prompt was accepted
           localStorage.getItem('dwash_pwa_installed') === 'true'
  } catch (error) {
    return false
  }
}

// Enhanced Notification for PWA Users
async function showEnhancedPWANotification(data) {
  try {
    const isInstalled = await isPWAInstalled()
    
    if (isInstalled) {
      // Enhanced notification for PWA users
      const enhancedOptions = {
        title: data.title || '🎉 D\'Wash Laundry',
        body: data.body,
        icon: data.icon || '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        vibrate: [200, 100, 200, 100, 200], // Stronger vibration for PWA
        requireInteraction: true,
        silent: false,
        tag: data.tag || 'dwash-pwa-notification',
        renotify: true, // Allow re-notification
        timestamp: Date.now(),
        data: {
          ...data.data,
          isPWA: true,
          enhancedFeatures: true,
          showTime: new Date().toLocaleTimeString('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit'
          })
        },
        actions: [
          {
            action: 'view',
            title: '👀 Lihat Status',
            icon: '/icons/icon-96x96.png'
          },
          {
            action: 'close',
            title: '❌ Tutup',
            icon: '/icons/icon-96x96.png'
          },
          ...(data.actions || [])
        ],
        // PWA-specific enhancements
        image: data.image, // Hero image for rich notifications
        dir: 'ltr',
        lang: 'id'
      }

      // Show the enhanced notification
      await self.registration.showNotification(enhancedOptions.title, enhancedOptions)
      
      // Log for PWA analytics
      console.log('🎯 Enhanced PWA notification shown:', {
        title: enhancedOptions.title,
        timestamp: enhancedOptions.timestamp,
        isPWA: true
      })

      // Store notification for tracking
      customerNotificationState.customers.set(data.phone || 'unknown', {
        lastNotification: Date.now(),
        notificationsCount: (customerNotificationState.customers.get(data.phone)?.notificationsCount || 0) + 1,
        isPWAUser: true
      })

    } else {
      // Standard notification for non-PWA users
      const standardOptions = {
        title: data.title || 'D\'Wash Laundry',
        body: data.body,
        icon: data.icon || '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        vibrate: [200, 100, 200],
        tag: data.tag || 'dwash-notification',
        data: {
          ...data.data,
          isPWA: false
        },
        actions: data.actions || []
      }

      await self.registration.showNotification(standardOptions.title, standardOptions)
      console.log('📱 Standard notification shown for non-PWA user')
    }

  } catch (error) {
    console.error('❌ Failed to show enhanced notification:', error)
    
    // Fallback to basic notification
    try {
      await self.registration.showNotification(
        data.title || 'D\'Wash Laundry', 
        {
          body: data.body,
          icon: '/icons/icon-192x192.png'
        }
      )
    } catch (fallbackError) {
      console.error('❌ Fallback notification also failed:', fallbackError)
    }
  }
}

// Enhanced notification click handler for PWA
self.addEventListener('notificationclick', (event) => {
  console.log('🎯 PWA notification clicked:', event.notification.data)
  
  event.notification.close()
  
  const notificationData = event.notification.data || {}
  const action = event.action
  const targetUrl = notificationData.url || '/dashboard'
  const fullUrl = new URL(targetUrl, self.location.origin).href

  // Handle different actions
  if (action === 'close') {
    console.log('🔕 User dismissed notification')
    return
  }

  if (action === 'view' || !action) {
    // Open/focus app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Try to focus existing window first
          for (const client of clientList) {
            if (client.url.includes(self.location.origin)) {
              console.log('🎯 Focusing existing PWA window')
              return client.focus()
            }
          }
          
          // Open new window if none exists
          console.log('🎯 Opening new PWA window')
          return clients.openWindow(fullUrl)
        })
        .then((client) => {
          // Send message to client about notification interaction
          if (client && notificationData.isPWA) {
            client.postMessage({
              type: 'PWA_NOTIFICATION_CLICKED',
              data: notificationData,
              action: action,
              timestamp: Date.now()
            })
          }
        })
    )
  }
})

// PWA lifecycle - detect installation
self.addEventListener('appinstalled', (event) => {
  console.log('🎉 PWA installed! Enhanced notifications available')
  
  // Mark PWA as installed for enhanced features
  try {
    // This will be available to main thread
    clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'PWA_INSTALLED',
          timestamp: Date.now(),
          enhancedNotifications: true
        })
      })
    })
  } catch (error) {
    console.log('Note: PWA installation detected in Service Worker context')
  }
})

// Background sync for PWA - handle offline notifications
self.addEventListener('sync', (event) => {
  if (event.tag === 'pwa-notification-sync') {
    console.log('🔄 PWA background sync for notifications')
    event.waitUntil(handlePWABackgroundSync())
  }
})

async function handlePWABackgroundSync() {
  try {
    // Check for pending notifications when back online
    const pendingNotifications = await getStoredPendingNotifications()
    
    for (const notification of pendingNotifications) {
      await showEnhancedPWANotification(notification)
      await removePendingNotification(notification.id)
    }
    
    console.log(`✅ Processed ${pendingNotifications.length} pending PWA notifications`)
  } catch (error) {
    console.error('❌ PWA background sync failed:', error)
  }
}

// Helper functions for offline notification storage
async function getStoredPendingNotifications() {
  try {
    // In a real implementation, this would read from IndexedDB
    return [] // Placeholder
  } catch (error) {
    return []
  }
}

async function removePendingNotification(id) {
  try {
    // Remove from IndexedDB storage
    console.log(`🗑️ Removed pending notification: ${id}`)
  } catch (error) {
    console.log('Note: Cleanup of pending notification failed')
  }
}

console.log('✅ PWA Enhanced Notification System initialized')