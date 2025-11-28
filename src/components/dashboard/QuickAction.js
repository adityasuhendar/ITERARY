import Button from '@/components/ui/Button'

export default function QuickAction({ title, icon, onClick, variant = "primary" }) {
  return (
    <Button
      variant={variant}
      onClick={onClick}
      className="h-24 flex flex-col items-center justify-center space-y-2"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-sm">{title}</span>
    </Button>
  )
}