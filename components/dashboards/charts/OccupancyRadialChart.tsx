
import React from 'react';
import { RadialBarChart, RadialBar, Legend, ResponsiveContainer, PolarAngleAxis } from 'recharts';
import { useLanguage } from '../../../context/LanguageContext';

interface OccupancyRadialChartProps {
    occupancyRate: number;
}

const OccupancyRadialChart: React.FC<OccupancyRadialChartProps> = ({ occupancyRate }) => {
    const { t } = useLanguage();
    const data = [{ name: t('dashboard.admin.occupancy'), value: occupancyRate }];
    
    const theme = localStorage.getItem('theme') || 'light';
    const fill = '#C9A24D'; // Gold for luxury gauge
    const textColor = theme === 'dark' ? '#cbd5e1' : '#0F2A44';

    const cardContainer = "bg-white dark:bg-slate-800 rounded-xl p-5 flex flex-col items-center justify-center animate-fade-in-up shadow-sm border border-slate-100 dark:border-slate-700";

    return (
        <div className={cardContainer}>
            <h3 className="text-[11px] font-black uppercase tracking-widest text-hotel-muted dark:text-slate-400 mb-4">{t('dashboard.admin.occupancy')}</h3>
            <ResponsiveContainer width="100%" height={160}>
                <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="85%"
                    outerRadius="100%"
                    barSize={10}
                    data={data}
                    startAngle={90}
                    endAngle={-270}
                >
                    <PolarAngleAxis
                        type="number"
                        domain={[0, 100]}
                        angleAxisId={0}
                        tick={false}
                    />
                    <RadialBar
                        background={{ fill: theme === 'dark' ? '#1e293b' : '#F1F5F9' }}
                        dataKey="value"
                        cornerRadius={10}
                        angleAxisId={0}
                        fill={fill}
                    />
                    <text
                        x="50%"
                        y="50%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="text-3xl font-black fill-current"
                        style={{ fill: textColor }}
                    >
                        {`${occupancyRate}%`}
                    </text>
                </RadialBarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default OccupancyRadialChart;
