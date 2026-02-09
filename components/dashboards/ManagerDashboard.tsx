
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardData } from '../../hooks/useDashboardData';
import StatCard from './StatCard';
import { useLanguage } from '../../context/LanguageContext';
import DistributionPieChart from './charts/DistributionPieChart';
import OccupancyChart from './charts/OccupancyChart';
import AlertsPanel from './AlertsPanel';
import { useDashboardSettings } from '../../context/DashboardSettingsContext';
import OccupancyRadialChart from './charts/OccupancyRadialChart';
import UpcomingDeparturesWidget from './UpcomingDeparturesWidget';
import UpcomingArrivalsWidget from './UpcomingArrivalsWidget';

interface ManagerDashboardProps {
    data: DashboardData;
}

const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ data }) => {
    const { t } = useLanguage();
    const { settings } = useDashboardSettings();
    const navigate = useNavigate();

    const employeeDistribution = data.charts.employeeDistributionByDept.map(d => ({
        ...d,
        name: t(`departments.${d.name}`) || d.name
    }));
    
    const cardContainer = "bg-white dark:bg-slate-800 rounded-2xl p-5 animate-fade-in-up shadow-sm border border-slate-100 dark:border-slate-700";

    return (
        <div className="space-y-6">
            {/* Top Management Stats */}
            {settings.stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <StatCard icon="fa-door-open" title={t('dashboard.manager.availableRooms')} value={data.stats.availableRooms} gradient="bg-green-400" onClick={() => navigate('/housing')} />
                    <StatCard icon="fa-wrench" title={t('dashboard.manager.openTickets')} value={data.stats.openMaintenance} gradient="bg-yellow-400" onClick={() => navigate('/maintenance')} />
                    <StatCard icon="fa-calendar-times" title={t('dashboard.manager.overdueTasks')} value={data.stats.overdueMaintenance.length} gradient="bg-orange-400" onClick={() => navigate('/maintenance')} />
                </div>
            )}

            {/* Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Main Content (Charts) */}
                <div className="lg:col-span-8 space-y-6">
                    {settings.occupancyChart && (
                        <div className={cardContainer}>
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 mb-4">{t('dashboard.charts.occupancyByBuilding')}</h3>
                            <OccupancyChart data={data.charts.occupancyByBuilding} />
                        </div>
                    )}
                    
                    {settings.distributionChart && (
                        <div className={cardContainer}>
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 mb-4">{t('dashboard.charts.employeesByDept')}</h3>
                            <DistributionPieChart data={employeeDistribution} />
                        </div>
                    )}
                </div>

                {/* Sidebar (Live Metrics) */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Fixed Occupancy Radial for Manager */}
                    {settings.occupancyChart && (
                        <div key={`occ-radial-${data.stats.occupancyRate}`}>
                            <OccupancyRadialChart occupancyRate={data.stats.occupancyRate} />
                        </div>
                    )}
                    
                    {/* Interactive Alerts */}
                    {settings.alerts && (
                        <div className="space-y-6">
                            <UpcomingArrivalsWidget alerts={data.arrivalAlerts} />
                            <UpcomingDeparturesWidget 
                                alerts={data.departureAlerts} 
                                onActionComplete={() => window.dispatchEvent(new CustomEvent('datachanged'))} 
                            />
                            <AlertsPanel overdueMaintenance={data.stats.overdueMaintenance} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManagerDashboard;
