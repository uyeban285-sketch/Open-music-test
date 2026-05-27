'use client';
import { useState } from 'react';
export default function SearchPage() {
  const [query, setQuery] = useState('');
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Search</h1>
      <div className="relative mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by mood, genre, or describe what you want..."
          className="w-full px-4 py-3 rounded-lg bg-surface border border-muted/20 text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>
      {!query && (
        <div className="text-center py-12">
          <p className="text-3xl mb-4">🔍</p>
          <p className="text-muted">
            Try: &quot;energetic electronic for running&quot; or &quot;calm jazz for evening&quot;
          </p>
        </div>
      )}
    </div>
  );
}
