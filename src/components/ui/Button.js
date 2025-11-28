export default function Button({ 
  children, 
  variant = "primary", 
  size = "md", 
  disabled = false,
  onClick,
  type = "button",
  className = ""
}) {
  const baseClasses = "font-medium rounded-lg transition-colors focus:outline-none focus:ring-2"
  
  const variants = {
    primary: "bg-dwash-red text-white hover:bg-red-600 focus:ring-dwash-red",
    secondary: "bg-dwash-yellow text-dwash-dark hover:bg-yellow-400 focus:ring-dwash-yellow",
    outline: "border-2 border-dwash-red text-dwash-red hover:bg-dwash-red hover:text-white",
    ghost: "text-dwash-red hover:bg-red-50"
  }
  
  const sizes = {
    sm: "px-3 py-2 text-sm",
    md: "px-6 py-3 text-base", 
    lg: "px-8 py-4 text-lg"
  }
  
  const disabledClasses = disabled ? "opacity-50 cursor-not-allowed" : ""

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${disabledClasses} ${className}`}
    >
      {children}
    </button>
  )
}