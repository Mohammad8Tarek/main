
import React from 'react';

interface StatCardProps {
    icon: string;
    title: string;
    value: string | number;
    gradient: string;
    onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ icon, title, value, gradient, onClick }) => {
    const isClickable = !!onClick;
    
    const getCircleColor = (grad: string) => {
        if (grad.includes('blue')) return 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400';
        if (grad.includes('green')) return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400';
        if (grad.includes('purple')) return 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400';
        if (grad.includes('pink')) return 'bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400';
        if (grad.includes('slate')) return 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
        if (grad.includes('orange') || grad.includes('yellow')) return 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400';
        return 'bg-hotel-teal/20 text-hotel-teal';
    };

    const cardClasses = `
        bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-sm hotel-card
        flex items-center gap-8 animate-fade-in-up w-full h-40
        border border-slate-100 dark:border-slate-700
        ${isClickable ? 'cursor-pointer' : ''}
    `;

    const content = (
        <>
            <div className={`w-20 h-20 rounded-2xl flex-shrink-0 flex items-center justify-center text-3xl ${getCircleColor(gradient)} transition-all shadow-inner`}>
                <i className={`fas ${icon}`}></i>
            </div>
            <div className="flex flex-col gap-1 overflow-hidden">
                <p className="text-hotel-muted dark:text-slate-400 text-sm font-bold uppercase tracking-widest truncate">{title}</p>
                <p className="text-hotel-navy dark:text-white text-4xl font-black tracking-tight">{value}</p>
            </div>
        </>
    );

    if (isClickable) {
        return (
            <button onClick={onClick} className={cardClasses + ' text-left'}>
                {content}
            </button>
        );
    }

    return (
        <div className={cardClasses}>
            {content}
        </div>
    );
};

export default StatCard;
