
import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { useLanguage } from '../../context/LanguageContext';
import { DashboardData } from '../../hooks/useDashboardData';

const SmartIntelligence: React.FC<{ data: DashboardData }> = ({ data }) => {
    const { t } = useLanguage();
    const [insight, setInsight] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const generateInsight = async () => {
        setLoading(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `
                Analyze this housing data and provide 3 key strategic insights or risks:
                - Occupancy Rate: ${data.stats.occupancyRate}%
                - Available Beds: ${data.stats.availableRooms}
                - Open Maintenance: ${data.stats.openMaintenance}
                - Staff Count: ${data.stats.activeEmployees}
                - Overdue Maintenance: ${data.stats.overdueMaintenance.length}
                - Upcoming Departures: ${data.departureAlerts.length}
                Format the answer in clear bullet points.
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: prompt,
                config: {
                    thinkingConfig: { thinkingBudget: 32768 }
                },
            });

            setInsight(response.text || "Unable to generate insights at this time.");
        } catch (error) {
            console.error("AI Insight error:", error);
            setInsight("Error connecting to AI service.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gradient-to-br from-hotel-navy to-slate-900 text-white rounded-2xl p-6 shadow-2xl relative overflow-hidden border border-white/10 group">
            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:scale-125 transition-transform">
                <i className="fas fa-brain text-5xl"></i>
            </div>
            <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-hotel-gold animate-ping"></span>
                AI System Intelligence
            </h3>
            
            {insight ? (
                <div className="space-y-4 animate-fade-in-up">
                    <div className="text-xs leading-relaxed opacity-90 prose prose-invert max-w-none">
                        {insight.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                    </div>
                    <button onClick={() => setInsight(null)} className="text-[9px] font-black uppercase tracking-widest text-hotel-gold hover:underline">Recalculate Insight</button>
                </div>
            ) : (
                <div className="space-y-4">
                    <p className="text-xs opacity-70">Analyze complex patterns in occupancy and maintenance to predict risks.</p>
                    <button 
                        onClick={generateInsight} 
                        disabled={loading}
                        className="px-6 py-2.5 bg-hotel-gold text-hotel-navy rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:brightness-110 transition-all disabled:opacity-50"
                    >
                        {loading ? <><i className="fas fa-spinner fa-spin mr-2"></i> Thinking...</> : "Generate Deep Analysis"}
                    </button>
                </div>
            )}
        </div>
    );
};

export default SmartIntelligence;
