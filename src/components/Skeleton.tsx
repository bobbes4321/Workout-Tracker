/** Shimmering placeholder block shown while data loads. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />
}

/** Dashboard-shaped loading state so the landing screen isn't blank. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-5 animate-[fadein_0.2s_ease]">
      <Skeleton className="h-16 w-full !rounded-2xl" />
      <Skeleton className="h-24 w-full !rounded-2xl" />
      <Skeleton className="h-40 w-full !rounded-2xl" />
      <Skeleton className="h-28 w-full !rounded-2xl" />
      <Skeleton className="h-24 w-full !rounded-2xl" />
    </div>
  )
}
