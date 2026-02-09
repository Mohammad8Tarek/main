
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardData } from '../../hooks/useDashboardData';
import StatCard from './StatCard';
import { useLanguage } from '../../context/LanguageContext';
import OccupancyChart from './charts/OccupancyChart';
import { useDashboardSettings } from '../../context/DashboardSettingsContext';
import OccupancyRadialChart from './charts/OccupancyRadialChart';
import UpcomingDeparturesWidget from './UpcomingDeparturesWidget';
import UpcomingArrivalsWidget from './UpcomingArrivalsWidget';
import RecentActivity from './RecentActivity';

interface AdminDashboardProps {
    data: DashboardData;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ data }) => {
    const { t } = useLanguage();
    const { settings } = useDashboardSettings();
    const navigate = useNavigate();

    const cardContainer = "bg-white dark:bg-slate-800 rounded-2xl p-5 animate-fade-in-up shadow-sm border border-slate-100 dark:border-slate-700";

    return (
        <div className="space-y-6">
            {/* Top Statistics Row */}
            {settings.stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    <StatCard icon="fa-users" title={t('employees.title')} value={data.stats.totalEmployees} gradient="bg-blue-400" onClick={() => navigate('/employees')} />
                    <StatCard icon="fa-building" title={t('housing.buildings')} value={data.stats.totalBuildings} gradient="bg-green-400" onClick={() => navigate('/housing')} />
                    <StatCard icon="fa-door-closed" title={t('housing.tabs.rooms')} value={data.stats.totalRooms} gradient="bg-indigo-400" onClick={() => navigate('/housing')} />
                    <StatCard icon="fa-users-cog" title={t('dashboard.admin.totalUsers')} value={data.users.length} gradient="bg-purple-400" onClick={() => navigate('/users')} />
                    <StatCard icon="fa-history" title={t('dashboard.admin.totalLogs')} value={data.activityLogs.length} gradient="bg-slate-400" onClick={() => navigate('/activity-log')} />
                </div>
            )}

            {/* Main Content Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Column */}
                <div className="lg:col-span-8 space-y-6">
                    {settings.occupancyChart && (
                        <div className={cardContainer}>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">{t('dashboard.charts.occupancyByBuilding')}</h3>
                                <div className="flex gap-3">
                                    <span className="flex items-center gap-1.5 text-[9px] font-bold text-blue-500 uppercase"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> {t('dashboard.charts.occupied')}</span>
                                    <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-300 uppercase"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> {t('dashboard.charts.available')}</span>
                                </div>
                            </div>
                            <OccupancyChart data={data.charts.occupancyByBuilding} />
                        </div>
                    )}
                    
                    {settings.recentActivity && (
                        <RecentActivity logs={data.activityLogs} />
                    )}
                </div>
                
                {/* Right Column (Widgets) */}
                <div className="lg:col-span-4 space-y-6">
                    {settings.occupancyChart && (
                        <div key={`occupancy-${data.stats.occupancyRate}`}>
                            <OccupancyRadialChart occupancyRate={data.stats.occupancyRate} />
                        </div>
                    )}
                    
                    {settings.alerts && (
                        <div className="space-y-6">
                            <UpcomingArrivalsWidget alerts={data.arrivalAlerts} />
                            <UpcomingDeparturesWidget 
                                alerts={data.departureAlerts} 
                                onActionComplete={() => window.dispatchEvent(new CustomEvent('datachanged'))} 
                            />
                        </div>
                    )}
                    
                    {/* Quick Summary Card */}
                    <div className="bg-hotel-navy text-white rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                        <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
                            <i className="fas fa-hotel text-8xl"></i>
                        </div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-70">Property Status</h4>
                        <div className="space-y-4 relative z-10">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold opacity-80">Maintenance Tickets</span>
                                <span className="text-xl font-black text-hotel-gold">{data.stats.openMaintenance}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold opacity-80">Available Beds</span>
                                <span className="text-xl font-black text-emerald-400">{data.stats.availableRooms}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
