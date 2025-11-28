// Push notification utility functions for client-side

export class PushNotificationManager {
  constructor() {
    // VAPID key will be fetched from API when needed
    this.vapidPublicKey = null
    this.swRegistration = null
  }

  // Check if push notifications are supported
  isSupported() {
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    )
  }

  // Get current notification permission
  getPermission() {
    if (!this.isSupported()) return 'unsupported'
    return Notification.permission
  }

  // Request notification permission (simplified - no custom modal)
  async requestPermission(context = {}) {
    if (!this.isSupported()) {
      throw new Error('Push notifications not supported')
    }

    if (Notification.permission === 'granted') {
      return 'granted'
    }

    if (Notification.permission === 'denied') {
      throw new Error('Push notifications are blocked')
    }

    // Request browser permission directly
    const permission = await Notification.requestPermission()
    return permission
  }


  // Get service worker registration
  async getSwRegistration() {
    if (!this.swRegistration) {
      // Wait for service worker to be ready with retry logic
      let retries = 3
      while (retries > 0) {
        try {
          this.swRegistration = await navigator.serviceWorker.ready
          break
        } catch (error) {
          console.log(`SW not ready, retrying... (${retries} attempts left)`)
          retries--
          if (retries === 0) throw error
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }
    return this.swRegistration
  }

  // Get VAPID public key from server
  async getVapidPublicKey() {
    if (this.vapidPublicKey) {
      return this.vapidPublicKey
    }

    const response = await fetch('/api/push/vapid')
    if (!response.ok) {
      throw new Error('Failed to fetch VAPID key')
    }
    
    const data = await response.json()
    this.vapidPublicKey = data.publicKey
    return this.vapidPublicKey
  }

  // Subscribe to push notifications
  async subscribe() {
    if (Notification.permission !== 'granted') {
      throw new Error('Permission not granted')
    }

    const swReg = await this.getSwRegistration()
    
    // Check for existing subscription
    const existingSubscription = await swReg.pushManager.getSubscription()
    if (existingSubscription) {
      return existingSubscription
    }

    // Get VAPID key and create new subscription
    const vapidKey = await this.getVapidPublicKey()
    const subscription = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: this.urlBase64ToUint8Array(vapidKey)
    })

    return subscription
  }

  // Unsubscribe from push notifications
  async unsubscribe() {
    const swReg = await this.getSwRegistration()
    const subscription = await swReg.pushManager.getSubscription()
    
    if (subscription) {
      await subscription.unsubscribe()
    }
    
    return true
  }

  // Save subscription to server
  async saveSubscription(subscription) {
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ subscription })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to save subscription')
    }

    return response.json()
  }

  // Remove subscription from server
  async removeSubscription(subscription) {
    const response = await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ endpoint: subscription.endpoint })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to remove subscription')
    }

    return response.json()
  }

  // Complete flow: request permission, subscribe, save to server
  async enableNotifications(context = {}) {
    try {
      // Step 1: Request permission
      const permission = await this.requestPermission(context)
      if (permission !== 'granted') {
        throw new Error('Permission denied')
      }

      // Step 2: Subscribe to push manager
      const subscription = await this.subscribe()

      // Step 3: Save to server
      await this.saveSubscription(subscription)

      console.log('✅ Push notifications enabled successfully')
      return { success: true, subscription }

    } catch (error) {
      console.error('❌ Failed to enable push notifications:', error)
      return { success: false, error: error.message }
    }
  }

  // Complete flow: unsubscribe and remove from server
  async disableNotifications() {
    try {
      const swReg = await this.getSwRegistration()
      const subscription = await swReg.pushManager.getSubscription()

      if (subscription) {
        // Remove from server first
        await this.removeSubscription(subscription)
        
        // Then unsubscribe locally
        await this.unsubscribe()
      }

      console.log('✅ Push notifications disabled successfully')
      return { success: true }

    } catch (error) {
      console.error('❌ Failed to disable push notifications:', error)
      return { success: false, error: error.message }
    }
  }

  // Check subscription status
  async getSubscriptionStatus() {
    try {
      if (!this.isSupported()) {
        return { supported: false, subscribed: false }
      }

      const permission = this.getPermission()
      if (permission !== 'granted') {
        return { supported: true, subscribed: false, permission }
      }

      const swReg = await this.getSwRegistration()
      const subscription = await swReg.pushManager.getSubscription()

      return {
        supported: true,
        subscribed: !!subscription,
        permission,
        subscription
      }

    } catch (error) {
      console.error('Failed to get subscription status:', error)
      return { supported: true, subscribed: false, error: error.message }
    }
  }

  // Utility function to convert VAPID public key
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }
}

// Export singleton instance
export const pushManager = new PushNotificationManager()

// Export utility functions
export const requestPushNotifications = (context) => pushManager.enableNotifications(context)
export const getNotificationStatus = () => pushManager.getSubscriptionStatus()