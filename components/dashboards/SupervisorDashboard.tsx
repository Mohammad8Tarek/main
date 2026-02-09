import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardData } from '../../hooks/useDashboardData';
import StatCard from './StatCard';
import { useLanguage } from '../../context/LanguageContext';
import { Room } from '../../types';
import { useDashboardSettings } from '../../context/DashboardSettingsContext';

interface SupervisorDashboardProps {
    data: DashboardData;
}

const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({ data }) => {
    const { t } = useLanguage();
    const { settings } = useDashboardSettings();
    const navigate = useNavigate();

    const availableRooms = data.rooms.filter(r => r.status === 'available' && r.currentOccupancy < r.capacity);
    const cardContainer = "bg-white dark:bg-slate-800 rounded-2xl animate-fade-in-up shadow-md";

    return (
        <div className="space-y-6">
            {settings.stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard icon="fa-door-open" title={t('dashboard.supervisor.availableRooms')} value={data.stats.availableRooms} gradient="bg-gradient-to-br from-green-400 to-green-600" onClick={() => navigate('/housing')} />
                    <StatCard icon="fa-wrench" title={t('dashboard.supervisor.openTickets')} value={data.stats.openMaintenance} gradient="bg-gradient-to-br from-yellow-400 to-orange-600" onClick={() => navigate('/maintenance')} />
                    <StatCard icon="fa-user-plus" title={t('dashboard.supervisor.unhousedEmployees')} value={data.stats.unhousedEmployees} gradient="bg-gradient-to-br from-blue-400 to-blue-600" onClick={() => navigate('/employees')} />
                    <StatCard icon="fa-calendar-times" title={t('dashboard.manager.overdueTasks')} value={data.stats.overdueMaintenance.length} gradient="bg-gradient-to-br from-orange-400 to-red-600" onClick={() => navigate('/maintenance')} />
                </div>
            )}
            
            {settings.availableRooms && (
                <div className={cardContainer}>
                    <h3 className="text-lg font-semibold p-4 border-b dark:border-slate-700 text-slate-800 dark:text-slate-200">{t('dashboard.supervisor.availableRoomsList')}</h3>
                    <div className="overflow-y-auto max-h-96">
                        {availableRooms.length > 0 ? (
                            <ul className="divide-y dark:divide-slate-700">
                            {availableRooms.map((room: Room) => {
                                return (
                                    <li key={room.id} className="p-4 flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-white">{room.roomNumber}</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{t('housing.capacity')}: {room.currentOccupancy} / {room.capacity}</p>
                                        </div>
                                    </li>
                                );
                            })}
                            </ul>
                        ) : (
                            <p className="p-4 text-slate-500 dark:text-slate-400">{t('dashboard.supervisor.noAvailableRooms')}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SupervisorDashboard;