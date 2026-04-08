export default function TripDetailLoading() {
  return (
    <div className="w-full min-w-0 overflow-hidden animate-pulse">
      {/* Toolbar row */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="h-8 w-48 bg-[var(--color-border)] rounded-lg" />
        <div className="flex gap-2">
          <div className="h-8 w-24 bg-[var(--color-border)] rounded-lg" />
          <div className="h-8 w-24 bg-[var(--color-border)] rounded-lg" />
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-[var(--color-border)] overflow-hidden bg-white">
        {/* Day header row */}
        <div className="flex border-b border-[var(--color-border)] bg-gray-50">
          <div className="w-[52px] shrink-0 border-r border-[var(--color-border)]" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-1 border-r border-[var(--color-border)] last:border-r-0"
            >
              <div className="h-2.5 w-6 bg-[var(--color-border)] rounded" />
              <div className="h-3 w-10 bg-[var(--color-border)] rounded" />
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="flex">
          {/* Time column */}
          <div className="w-[52px] shrink-0 border-r border-[var(--color-border)]">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex justify-end pr-2 pt-1" style={{ height: 80 }}>
                <div className="h-2 w-7 bg-[var(--color-border)] rounded mt-1" />
              </div>
            ))}
          </div>

          {/* Day columns */}
          {[1, 2, 3, 4, 5].map((col) => (
            <div
              key={col}
              className="flex-1 border-r border-[var(--color-border)] last:border-r-0 relative"
            >
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="border-t border-gray-100"
                  style={{ height: 80 }}
                />
              ))}
              {/* Fake activity blocks */}
              {col === 2 && (
                <div className="absolute inset-x-1 rounded-lg bg-[var(--color-border)]" style={{ top: 80, height: 76 }} />
              )}
              {col === 3 && (
                <div className="absolute inset-x-1 rounded-lg bg-[var(--color-border)]" style={{ top: 160, height: 60 }} />
              )}
              {col === 4 && (
                <div className="absolute inset-x-1 rounded-lg bg-[var(--color-border)]" style={{ top: 80, height: 76 }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
