/**
 * Reusable skeleton loading components.
 * Uses the `.skeleton` CSS class from index.css (shimmer animation).
 */

export function KanbanSkeleton() {
    return (
        <div className="flex gap-3 overflow-x-auto pb-4">
            {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="min-w-[220px] flex-1">
                    <div className="skeleton h-6 w-20 mb-3 rounded" />
                    <div className="space-y-2">
                        {Array.from({ length: 2 + (i % 3) }).map((_, j) => (
                            <div key={j} className="skeleton h-24 rounded-xl" />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
                    <div className="skeleton h-10 w-10 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="skeleton h-4 w-1/3 rounded" />
                        <div className="skeleton h-3 w-2/3 rounded" />
                    </div>
                    <div className="skeleton h-6 w-16 rounded-full shrink-0" />
                </div>
            ))}
        </div>
    );
}

export function ActivitySkeleton({ rows = 8 }: { rows?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 p-3">
                    <div className="skeleton h-8 w-8 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5">
                        <div className="skeleton h-3 w-2/5 rounded" />
                        <div className="skeleton h-3 w-3/4 rounded" />
                    </div>
                    <div className="skeleton h-3 w-20 rounded shrink-0" />
                </div>
            ))}
        </div>
    );
}

export function DetailSkeleton() {
    return (
        <div className="max-w-4xl mx-auto">
            <div className="skeleton h-4 w-16 rounded mb-4" />
            <div className="bg-[hsl(var(--th-surface))] border border-[hsl(var(--th-border))] rounded-lg p-6 mb-4">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="space-y-2 flex-1">
                        <div className="skeleton h-6 w-40 rounded" />
                        <div className="skeleton h-4 w-64 rounded" />
                    </div>
                    <div className="flex gap-2">
                        <div className="skeleton h-9 w-9 rounded-md" />
                        <div className="skeleton h-9 w-9 rounded-md" />
                    </div>
                </div>
                <div className="grid grid-cols-4 gap-4 mb-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="skeleton h-12 rounded-lg" />
                    ))}
                </div>
                <div className="skeleton h-20 rounded-lg" />
            </div>
        </div>
    );
}
