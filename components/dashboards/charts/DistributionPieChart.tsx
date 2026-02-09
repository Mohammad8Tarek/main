import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PieChartData {
    name: string;
    value: number;
}

interface DistributionPieChartProps {
    data: PieChartData[];
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const DistributionPieChart: React.FC<DistributionPieChartProps> = ({ data }) => {
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
        <ResponsiveContainer width="100%" height={300}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={labelStyle}
                />
                <Legend />
            </PieChart>
        </ResponsiveContainer>
    );
};

export default DistributionPieChart;