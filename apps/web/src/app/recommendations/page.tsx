'use client';
export default function RecommendationsPage() {
  const categories = [
    { key: 'similar', title: 'Похоже на то, что нравится', icon: '🎯' },
    { key: 'now_will_fit', title: 'Сейчас зайдёт', icon: '⚡' },
    { key: 'work_walk', title: 'Для работы/прогулки', icon: '🚶' },
    { key: 'maybe_missed', title: 'Возможно пропустил', icon: '💎' },
    { key: 'deep_weekly', title: 'Глубокая рекомендация недели', icon: '🌊' },
    { key: 'new_artists', title: 'Новые артисты', icon: '🌟' },
  ];
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">For You</h1>
      <div className="space-y-8">
        {categories.map((cat) => (
          <section key={cat.key}>
            <h2 className="text-lg font-semibold mb-3">
              <span className="mr-2">{cat.icon}</span>
              {cat.title}
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-40">
                  <div className="aspect-square bg-surface rounded-lg mb-2" />
                  <div className="h-3 bg-muted/20 rounded w-3/4 mb-1" />
                  <div className="h-2.5 bg-muted/15 rounded w-1/2" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
