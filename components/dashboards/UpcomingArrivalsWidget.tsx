
import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Reservation, Room } from '../../types';
import { useNavigate } from 'react-router-dom';

interface ArrivalAlert {
    reservation: Reservation;
    room: Room;
    daysUntilArrival: number;
    status: 'overdue' | 'today' | 'soon';
}

interface UpcomingArrivalsWidgetProps {
    alerts: ArrivalAlert[];
}

const UpcomingArrivalsWidget: React.FC<UpcomingArrivalsWidgetProps> = ({ alerts }) => {
    const { t, language } = useLanguage();
    const navigate = useNavigate();

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'overdue': return 'bg-rose-500';
            case 'today': return 'bg-amber-500';
            default: return 'bg-emerald-500';
        }
    };

    if (alerts.length === 0) return null;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-fade-in-up">
            <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <i className="fas fa-plane-arrival text-sm"></i>
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">
                        {language === 'ar' ? 'وصول قادم' : 'Upcoming Arrivals'}
                    </h3>
                </div>
                <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full">{alerts.length} Reservations</span>
            </div>
            
            <div className="max-h-96 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left rtl:text-right border-collapse">
                    <thead className="text-[9px] font-black uppercase text-slate-400 bg-white dark:bg-slate-800 sticky top-0 z-10">
                        <tr>
                            <th className="px-5 py-3">Staff / Room</th>
                            <th className="px-5 py-3">Arrival Date</th>
                            <th className="px-5 py-3">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                        {alerts.map((alert) => (
                            <tr key={alert.reservation.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                <td className="px-5 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[120px]">
                                            {alert.reservation.firstName} {alert.reservation.lastName}
                                        </span>
                                        <span className="text-[10px] font-bold text-emerald-600 uppercase">Room {alert.room?.roomNumber || 'N/A'}</span>
                                    </div>
                                </td>
                                <td className="px-5 py-4">
                                    <div className="flex flex-col">
                                        <span className={`text-[10px] font-black uppercase flex items-center gap-1.5 ${alert.status === 'overdue' ? 'text-rose-600' : 'text-slate-500'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(alert.status)}`}></span>
                                            {new Date(alert.reservation.checkInDate).toLocaleDateString()}
                                        </span>
                                        <span className="text-[9px] text-slate-400">
                                            {alert.daysUntilArrival === 0 ? 'Arriving today' : alert.daysUntilArrival < 0 ? `${Math.abs(alert.daysUntilArrival)} days late` : `${alert.daysUntilArrival} days left`}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-5 py-4">
                                    <button 
                                        onClick={() => navigate('/reservations')}
                                        className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-all shadow-sm"
                                        title="View Details"
                                    >
                                        <i className="fas fa-eye text-[10px]"></i>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UpcomingArrivalsWidget;
