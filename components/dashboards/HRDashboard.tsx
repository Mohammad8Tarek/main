
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardData } from '../../hooks/useDashboardData';
import StatCard from './StatCard';
import { useLanguage } from '../../context/LanguageContext';
import DistributionPieChart from './charts/DistributionPieChart';
import AlertsPanel from './AlertsPanel';
import { useDashboardSettings } from '../../context/DashboardSettingsContext';

interface HRDashboardProps {
    data: DashboardData;
}

const HRDashboard: React.FC<HRDashboardProps> = ({ data }) => {
    const { t } = useLanguage();
    const { settings } = useDashboardSettings();
    const navigate = useNavigate();

    const employeeDistribution = data.charts.employeeDistributionByDept.map(d => ({
        ...d,
        name: t(`departments.${d.name}`) || d.name
    }));

    const cardContainer = "bg-white dark:bg-slate-800 rounded-2xl p-4 animate-fade-in-up shadow-md";

    return (
        <div className="space-y-6">
            {settings.stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <StatCard icon="fa-users" title={t('dashboard.hr.activeEmployees')} value={data.stats.activeEmployees} gradient="bg-gradient-to-br from-green-400 to-green-600" onClick={() => navigate('/employees')} />
                    <StatCard icon="fa-user-plus" title={t('dashboard.hr.unhoused')} value={data.stats.unhousedEmployees} gradient="bg-gradient-to-br from-blue-400 to-blue-600" onClick={() => navigate('/employees')} />
                    <StatCard icon="fa-user-times" title={t('dashboard.hr.left')} value={data.employees.length - data.stats.activeEmployees} gradient="bg-gradient-to-br from-slate-400 to-slate-600" onClick={() => navigate('/employees')} />
                </div>
            )}
            
            {settings.alerts && <AlertsPanel overdueMaintenance={[]} />}

            {settings.distributionChart && (
                <div className={cardContainer}>
                    <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200 px-2">{t('dashboard.charts.employeesByDept')}</h3>
                    <DistributionPieChart data={employeeDistribution} />
                </div>
            )}
        </div>
    );
};

export default HRDashboard;
