import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-3xl shadow-inner border border-slate-200 flex items-center justify-center mb-6 transform rotate-6">
                <Icon size={36} className="text-slate-400 -rotate-6" />
            </div>

            <h3 className="font-black text-slate-800 text-lg mb-2">{title}</h3>
            <p className="text-sm text-slate-500 max-w-md mb-6">{description}</p>

            {action && (
                <button
                    onClick={action.onClick}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg hover:scale-105 transition-all"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}
