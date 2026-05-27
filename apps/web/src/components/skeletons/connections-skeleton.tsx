export function ConnectionsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-surface">
          <div className="w-12 h-12 rounded-full bg-muted/20 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted/20 rounded w-1/3" />
            <div className="h-3 bg-muted/15 rounded w-1/5" />
          </div>
          <div className="h-8 w-24 bg-muted/20 rounded" />
        </div>
      ))}
    </div>
  );
}
