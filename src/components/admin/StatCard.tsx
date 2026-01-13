import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    color?: 'primary' | 'success' | 'warning' | 'danger';
}

export function StatCard({ title, value, icon: Icon, trend, color = 'primary' }: StatCardProps) {
    const colorClasses = {
        primary: 'from-indigo-500 to-purple-500',
        success: 'from-green-500 to-emerald-500',
        warning: 'from-amber-500 to-orange-500',
        danger: 'from-red-500 to-rose-500',
    };

    return (
        <motion.div
            whileHover={{ y: -4, scale: 1.02 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-xl transition-all relative overflow-hidden group"
        >
            {/* Gradient accent */}
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colorClasses[color]} opacity-10 rounded-bl-full`} />

            <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]} shadow-lg`}>
                        <Icon size={24} className="text-white" />
                    </div>

                    {trend && (
                        <div className={`flex items-center gap-1 text-sm font-bold ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            <span>{trend.isPositive ? '↑' : '↓'}</span>
                            <span>{Math.abs(trend.value)}%</span>
                        </div>
                    )}
                </div>

                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
                    <p className="text-3xl font-black text-slate-900">{value}</p>
                </div>
            </div>
        </motion.div>
    );
}
