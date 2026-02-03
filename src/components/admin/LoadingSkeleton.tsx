export function LoadingSkeleton({ type = 'card' }: { type?: 'card' | 'table' | 'stat' }) {
    if (type === 'stat') {
        return (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 animate-pulse">
                <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-slate-200 rounded-xl" />
                    <div className="w-16 h-6 bg-slate-200 rounded" />
                </div>
                <div className="space-y-2">
                    <div className="w-24 h-4 bg-slate-200 rounded" />
                    <div className="w-32 h-8 bg-slate-200 rounded" />
                </div>
            </div>
        );
    }

    if (type === 'table') {
        return (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-200 rounded-xl" />
                        <div className="flex-1 space-y-2">
                            <div className="w-3/4 h-4 bg-slate-200 rounded" />
                            <div className="w-1/2 h-3 bg-slate-200 rounded" />
                        </div>
                        <div className="w-20 h-8 bg-slate-200 rounded" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 animate-pulse">
            <div className="w-full h-48 bg-slate-200 rounded-xl mb-4" />
            <div className="space-y-3">
                <div className="w-3/4 h-6 bg-slate-200 rounded" />
                <div className="w-full h-4 bg-slate-200 rounded" />
                <div className="w-5/6 h-4 bg-slate-200 rounded" />
            </div>
        </div>
    );
}
