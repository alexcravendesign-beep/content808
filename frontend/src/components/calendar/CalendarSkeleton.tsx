export function CalendarSkeleton({ view }: { view: "month" | "week" | "day" | "agenda" }) {
    if (view === "month") {
        return (
            <div className="border border-zinc-800/60 rounded-xl overflow-hidden animate-fadeIn">
                <div className="grid grid-cols-7 bg-zinc-900/40">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                        <div key={d} className="px-2 py-2.5 text-xs font-medium text-zinc-600 text-center border-b border-zinc-800/40">{d}</div>
                    ))}
                </div>
                {Array.from({ length: 5 }).map((_, wi) => (
                    <div key={wi} className="grid grid-cols-7">
                        {Array.from({ length: 7 }).map((_, di) => (
                            <div key={di} className="min-h-[100px] border-b border-r border-zinc-800/30 p-2">
                                <div className="skeleton h-4 w-6 mb-2" />
                                {di % 3 === 0 && <div className="skeleton h-5 w-full mb-1" />}
                                {di % 4 === 1 && <div className="skeleton h-5 w-3/4" />}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        );
    }

    if (view === "week") {
        return (
            <div className="grid grid-cols-7 gap-3 animate-fadeIn">
                {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-zinc-800/40 min-h-[200px]">
                        <div className="px-3 py-3 border-b border-zinc-800/30">
                            <div className="skeleton h-3 w-8 mb-1" />
                            <div className="skeleton h-6 w-6" />
                        </div>
                        <div className="p-2 space-y-2">
                            {i % 2 === 0 && <div className="skeleton h-12 w-full rounded-lg" />}
                            {i % 3 === 0 && <div className="skeleton h-12 w-full rounded-lg" />}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (view === "day") {
        return (
            <div className="animate-fadeIn space-y-0">
                {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="flex border-b border-zinc-800/30 min-h-[48px]">
                        <div className="w-16 shrink-0 py-2 px-2">
                            <div className="skeleton h-3 w-10" />
                        </div>
                        <div className="flex-1 py-2 px-2">
                            {i % 4 === 1 && <div className="skeleton h-8 w-3/4 rounded-lg" />}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // agenda
    return (
        <div className="animate-fadeIn space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i}>
                    <div className="skeleton h-5 w-32 mb-3" />
                    <div className="space-y-2">
                        <div className="skeleton h-16 w-full rounded-lg" />
                        {i % 2 === 0 && <div className="skeleton h-16 w-full rounded-lg" />}
                    </div>
                </div>
            ))}
        </div>
    );
}
