export default function Card({ children, className = "" }) {
  return (
    <div className={`card-dwash ${className}`}>
      {children}
    </div>
  )
}