
import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Employee, MaintenanceRequest } from '../../types';

interface AlertsPanelProps {
    overdueMaintenance: MaintenanceRequest[];
}

const AlertsPanel: React.FC<AlertsPanelProps> = ({ overdueMaintenance }) => {
    const { t } = useLanguage();

    if (overdueMaintenance.length === 0) {
        return null;
    }
    
    const getDaysOverdue = (dateString: string) => {
        const diff = new Date().getTime() - new Date(dateString).getTime();
        return Math.max(0, Math.floor(diff / (1000 * 3600 * 24)));
    }
    
    const cardContainer = "bg-white dark:bg-slate-800 rounded-2xl animate-fade-in-up shadow-md";


    return (
        <div className={cardContainer}>
            <h3 className="text-lg font-semibold p-4 border-b dark:border-slate-700 text-yellow-600 dark:text-yellow-400 flex items-center">
                <i className="fas fa-exclamation-triangle mr-3"></i>
                {t('dashboard.alerts.title')}
            </h3>
            <ul className="divide-y dark:divide-slate-700 max-h-80 overflow-y-auto">
                {overdueMaintenance.map(task => {
                    const daysOverdue = getDaysOverdue(task.dueDate!);
                    return (
                        <li key={`task-${task.id}`} className="p-4 flex items-center space-x-3 rtl:space-x-reverse">
                             <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-red-100 dark:bg-red-900">
                                <i className="fas fa-tools text-red-500"></i>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">{t('dashboard.alerts.maintenanceOverdue', { problem: task.problemType })}</p>
                                <p className="text-xs text-red-500 font-bold">
                                    {t('dashboard.alerts.daysOverdue', { count: daysOverdue })}
                                </p>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default AlertsPanel;
