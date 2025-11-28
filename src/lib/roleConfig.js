// Centralized role configuration
export const getRoleConfig = (role) => {
  const configs = {
    'super_admin': {
      name: 'Super Admin',
      color: 'bg-gradient-to-r from-purple-500 to-purple-600',
      textColor: 'text-white',
      icon: '👑'
    },
    'owner': {
      name: 'Owner',
      color: 'bg-gradient-to-r from-blue-500 to-blue-600',
      textColor: 'text-white',
      icon: '🏢'
    },
    'collector': {
      name: 'Collector',
      color: 'bg-gradient-to-r from-green-500 to-green-600',
      textColor: 'text-white',
      icon: '🚚'
    },
    'kasir': {
      name: 'Kasir',
      color: 'bg-gradient-to-r from-orange-500 to-orange-600',
      textColor: 'text-white',
      icon: '💰'
    }
  }
  
  return configs[role] || {
    name: role,
    color: 'bg-gray-500',
    textColor: 'text-white',
    icon: '👤'
  }
}