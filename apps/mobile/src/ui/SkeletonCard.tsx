export function SkeletonCard() {
  return (
    <div className="bg-bg-glass border border-subtle rounded-card p-3.5 mb-2.5">
      <div className="skeleton h-3.5 w-3/5 mb-2 rounded" />
      <div className="skeleton h-3 w-2/5 mb-3 rounded" />
      <div className="skeleton h-3 w-4/5 mb-3 rounded" />
      <div className="flex gap-1">
        <div className="skeleton w-6 h-6 rounded-full" />
        <div className="skeleton w-6 h-6 rounded-full" />
        <div className="skeleton w-6 h-6 rounded-full" />
      </div>
    </div>
  );
}
