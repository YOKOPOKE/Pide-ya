
"use client";

export function BuilderSkeleton() {
    return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col lg:flex-row animate-pulse">
            {/* LEFT: CONTENT SKELETON */}
            <div className="flex-1 flex flex-col h-full bg-slate-50/50 relative">
                {/* Header */}
                <header className="px-4 md:px-8 py-4 md:py-6 flex justify-between items-center bg-white border-b border-slate-100">
                    <div className="w-24 h-8 bg-slate-200 rounded-lg"></div>
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-20 h-3 bg-slate-200 rounded"></div>
                        <div className="w-32 h-6 bg-slate-200 rounded"></div>
                    </div>
                    <div className="w-16 h-8 bg-slate-200 rounded-lg"></div>
                </header>

                {/* Step Area */}
                <div className="flex-1 p-4 md:p-12 overflow-hidden">
                    <div className="max-w-4xl mx-auto flex flex-col items-center">
                        {/* Step Title */}
                        <div className="w-24 h-4 bg-slate-200 rounded mb-4"></div>
                        <div className="w-64 h-12 bg-slate-200 rounded-lg mb-8"></div>
                        <div className="w-48 h-10 bg-slate-200 rounded-full mb-12"></div>

                        {/* Grid */}
                        <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="aspect-square bg-slate-200 rounded-2xl"></div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-white border-t border-slate-100 flex justify-between items-center">
                    <div className="w-32 h-12 bg-slate-200 rounded-full"></div>
                    <div className="w-32 h-12 bg-slate-200 rounded-full"></div>
                </div>
            </div>

            {/* RIGHT: PREVIEW SKELETON (Hidden on mobile) */}
            <div className="hidden lg:flex w-[400px] bg-slate-100 h-full border-l border-slate-200 flex-col p-8 items-center justify-center">
                <div className="w-64 h-64 bg-slate-200 rounded-full mb-8"></div>
                <div className="w-full space-y-4">
                    <div className="w-full h-4 bg-slate-200 rounded"></div>
                    <div className="w-3/4 h-4 bg-slate-200 rounded"></div>
                    <div className="w-1/2 h-4 bg-slate-200 rounded"></div>
                </div>
            </div>
        </div>
    );
}
