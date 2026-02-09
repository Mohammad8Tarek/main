import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardData } from '../../hooks/useDashboardData';
import StatCard from './StatCard';
import { useLanguage } from '../../context/LanguageContext';
import { MaintenanceRequest } from '../../types';
import { useDashboardSettings } from '../../context/DashboardSettingsContext';

interface MaintenanceDashboardProps {
    data: DashboardData;
}

const MaintenanceDashboard: React.FC<MaintenanceDashboardProps> = ({ data }) => {
    const { t } = useLanguage();
    const { settings } = useDashboardSettings();
    const navigate = useNavigate();
    
    const openRequests = data.maintenanceRequests.filter(r => r.status === 'open');
    const inProgressRequests = data.maintenanceRequests.filter(r => r.status === 'in_progress');
    const roomMap = new Map(data.rooms.map(r => [r.id, r.roomNumber]));
    const cardContainer = "bg-white dark:bg-slate-800 rounded-2xl animate-fade-in-up shadow-md";

    const getStatusBadge = (status: MaintenanceRequest['status']) => {
        switch (status) {
            case 'open': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
            case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
            default: return '';
        }
    };

    return (
        <div className="space-y-6">
            {settings.stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard icon="fa-folder-open" title={t('dashboard.maintenance.newTickets')} value={openRequests.length} gradient="bg-gradient-to-br from-red-400 to-red-600" onClick={() => navigate('/maintenance')} />
                    <StatCard icon="fa-tasks" title={t('dashboard.maintenance.inProgress')} value={inProgressRequests.length} gradient="bg-gradient-to-br from-yellow-400 to-orange-600" onClick={() => navigate('/maintenance')} />
                    <StatCard icon="fa-check-circle" title={t('dashboard.maintenance.resolved')} value={data.maintenanceRequests.filter(r=>r.status === 'resolved').length} gradient="bg-gradient-to-br from-green-400 to-green-600" onClick={() => navigate('/maintenance')} />
                    <StatCard icon="fa-calendar-times" title={t('dashboard.manager.overdueTasks')} value={data.stats.overdueMaintenance.length} gradient="bg-gradient-to-br from-orange-400 to-red-600" onClick={() => navigate('/maintenance')} />
                </div>
            )}

            {settings.maintenanceList && (
                <div className={cardContainer}>
                    <h3 className="text-lg font-semibold p-4 border-b dark:border-slate-700 text-slate-800 dark:text-slate-200">{t('dashboard.maintenance.activeTickets')}</h3>
                    <div className="overflow-y-auto max-h-96">
                        {[...openRequests, ...inProgressRequests].length > 0 ? (
                            <ul className="divide-y dark:divide-slate-700">
                                {[...openRequests, ...inProgressRequests].map((req: MaintenanceRequest) => (
                                    <li key={req.id} className="p-4 flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-white">{req.problemType} - Room {roomMap.get(req.roomId)}</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{req.description}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(req.status)}`}>{t(`statuses.${req.status.replace('_', '')}`)}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="p-4 text-slate-500 dark:text-slate-400">{t('dashboard.maintenance.noActiveTickets')}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaintenanceDashboard;