
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useLanguage } from '../../../context/LanguageContext';

interface OccupancyData {
    name: string;
    occupancy: number;
    total: number;
}

interface OccupancyChartProps {
    data: OccupancyData[];
}

const OccupancyChart: React.FC<OccupancyChartProps> = ({ data }) => {
    const { t } = useLanguage();
    const chartData = data.map(item => ({
        name: item.name,
        [t('dashboard.charts.occupied')]: item.occupancy,
        [t('dashboard.charts.available')]: item.total - item.occupancy,
    }));
    
    const theme = localStorage.getItem('theme') || 'light';
    const tooltipStyle = theme === 'dark' 
        ? {
            backgroundColor: 'rgba(30, 41, 59, 0.9)',
            borderColor: '#475569',
            borderRadius: '0.5rem',
          }
        : {
            backgroundColor: '#ffffff',
            borderColor: '#e2e8f0',
            borderRadius: '0.5rem',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          };
    const labelStyle = theme === 'dark' ? { color: '#F8FAFC' } : { color: '#334155' };

    return (
        <ResponsiveContainer width="100%" height={220}>
            <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.5} />
                <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={labelStyle}
                    cursor={{fill: 'rgba(100, 116, 139, 0.1)'}}
                />
                <Legend wrapperStyle={{fontSize: '10px', fontWeight: 'bold', paddingTop: '10px'}} />
                <Bar dataKey={t('dashboard.charts.occupied')} stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} />
                <Bar dataKey={t('dashboard.charts.available')} stackId="a" fill="#E2E8F0" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
};

export default OccupancyChart;
