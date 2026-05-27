export function TrackListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2 rounded-lg">
          <div className="w-10 h-10 rounded bg-muted/20 flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-muted/20 rounded w-3/4" />
            <div className="h-3 bg-muted/15 rounded w-1/2" />
          </div>
          <div className="h-3 bg-muted/15 rounded w-10" />
        </div>
      ))}
    </div>
  );
}
