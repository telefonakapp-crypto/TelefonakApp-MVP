type NumberedPaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
};

export function NumberedPagination({
  page,
  totalPages,
  onPageChange,
  disabled = false,
}: NumberedPaginationProps) {
  if (totalPages < 1) return null;

  const pages: Array<number | 'ellipsis'> = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i += 1) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('ellipsis');
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i += 1) pages.push(i);
    if (page < totalPages - 2) pages.push('ellipsis');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white disabled:opacity-40"
        aria-label="Previous page"
      >
        ‹
      </button>
      {pages.map((entry, index) =>
        entry === 'ellipsis' ? (
          <span key={`e-${index}`} className="px-1 text-sm text-slate-400">
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            disabled={disabled}
            onClick={() => onPageChange(entry)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium disabled:opacity-60 ${
              entry === page
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-white'
            }`}
          >
            {entry}
          </button>
        )
      )}
      <button
        type="button"
        disabled={disabled || page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white disabled:opacity-40"
        aria-label="Next page"
      >
        ›
      </button>
    </div>
  );
}
