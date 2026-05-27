export function PlaylistCardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg overflow-hidden">
          <div className="aspect-square bg-muted/20 rounded-lg" />
          <div className="mt-2 space-y-1.5">
            <div className="h-3.5 bg-muted/20 rounded w-3/4" />
            <div className="h-3 bg-muted/15 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
