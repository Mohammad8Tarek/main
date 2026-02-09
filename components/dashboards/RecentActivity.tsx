import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { ActivityLog } from '../../types';

interface RecentActivityProps {
    logs: ActivityLog[];
}

const RecentActivity: React.FC<RecentActivityProps> = ({ logs }) => {
    const { t } = useLanguage();

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md animate-fade-in-up">
            <h3 className="text-lg font-semibold p-4 border-b dark:border-slate-700 text-slate-800 dark:text-slate-200">{t('dashboard.recentActivity.title')}</h3>
            <div className="overflow-y-auto max-h-80">
                <ul className="divide-y dark:divide-slate-700">
                    {logs.slice(0, 10).map(log => (
                        <li key={log.id} className="p-4 flex items-start space-x-4 rtl:space-x-reverse">
                             <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                                <i className="fas fa-history text-primary-500 dark:text-primary-400"></i>
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-slate-900 dark:text-white">{log.action}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {t('dashboard.recentActivity.by')} <span className="font-semibold">{log.username}</span> - {new Date(log.timestamp).toLocaleString()}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default RecentActivity;