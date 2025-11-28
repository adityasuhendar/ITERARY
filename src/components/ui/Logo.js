import { BRAND } from '@/lib/constants'

export default function Logo({ variant = "full", size = "md", className = "", theme = "default" }) {
  const sizes = {
    sm: variant === "full" ? "h-8" : "h-6 w-6",
    md: variant === "full" ? "h-12" : "h-8 w-8", 
    lg: variant === "full" ? "h-16" : "h-12 w-12",
    xl: variant === "full" ? "h-24" : "h-16 w-16"
  }

  const logoSrc = variant === "icon" ? BRAND.logo.icon : BRAND.logo.full

  if (variant === "text") {
    const textColors = theme === "light" 
      ? "text-dwash-yellow font-bold text-2xl" 
      : "text-dwash-yellow font-bold text-2xl drop-shadow-lg"
    const washColors = theme === "light" 
      ? "text-dwash-red font-bold text-2xl" 
      : "text-white font-bold text-2xl drop-shadow-lg"
    
    return (
      <div className={`flex items-center ${className}`}>
        <span className={textColors}>D</span>
        <span className={washColors}>Wash</span>
      </div>
    )
  }

  return (
    <img 
      src={logoSrc}
      alt={BRAND.name}
      className={`${sizes[size]} ${className}`}
    />
  )
}