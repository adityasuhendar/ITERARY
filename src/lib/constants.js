// DWash Brand Constants
export const BRAND = {
  name: "DWash Laundry",
  tagline: "Self Service Laundry",
  logo: {
    full: "/images/logo/logo-dwash.jpg",
    icon: "/images/logo/logo-dwash.jpg"
  }
}

// Colors from logo
export const COLORS = {
  primary: "#E53E3E",    // Red
  secondary: "#FFD700",  // Yellow
  dark: "#1A202C",       // Dark text
  gray: "#718096",       // Secondary text
}

// User Roles
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  OWNER: 'owner', 
  COLLECTOR: 'collector',
  KASIR: 'kasir'
}

// Services & Pricing
export const SERVICES = {
  CUCI: { id: 1, name: 'Cuci', duration: 15, price: 10000 },
  KERING: { id: 2, name: 'Kering', duration: 45, price: 10000 },
  BILAS: { id: 3, name: 'Bilas', duration: 7, price: 5000 }
}

// Branches
export const BRANCHES = [
  'Tanjung Senang',
  'Panglima Polim', 
  'Sukarame',
  'Korpri',
  'Gedong Meneng',
  'Untung'
]

// Payment Methods
export const PAYMENT_METHODS = {
  TUNAI: 'tunai',
  QRIS: 'qris'
}