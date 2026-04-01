import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: number
  icon: LucideIcon
  colorClass: string
  bgClass: string
  description: string
  size?: 'default' | 'sm'
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  colorClass,
  bgClass,
  description,
  size = 'default',
}: MetricCardProps) {
  return (
    <Card>
      <CardContent className={cn('flex items-start gap-4', size === 'sm' ? 'p-4' : 'p-5')}>
        <div className={cn('flex items-center justify-center rounded-lg shrink-0', bgClass, size === 'sm' ? 'w-9 h-9' : 'w-11 h-11')}>
          <Icon className={cn(colorClass, size === 'sm' ? 'w-4 h-4' : 'w-5 h-5')} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs text-muted-foreground font-medium">{title}</span>
          <span className={cn('font-bold text-foreground leading-tight', size === 'sm' ? 'text-2xl' : 'text-3xl')}>
            {value}
          </span>
          <span className="text-xs text-muted-foreground mt-0.5">{description}</span>
        </div>
      </CardContent>
    </Card>
  )
}
