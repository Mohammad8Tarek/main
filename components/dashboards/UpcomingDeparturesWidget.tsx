
import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Assignment, Employee, Room } from '../../types';
import { assignmentApi, roomApi, logActivity } from '../../services/apiService';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';

interface DepartureAlert {
    assignment: Assignment;
    employee: Employee;
    room: Room;
    daysRemaining: number;
    status: 'overdue' | 'today' | 'soon';
}

interface UpcomingDeparturesWidgetProps {
    alerts: DepartureAlert[];
    onActionComplete: () => void;
}

const UpcomingDeparturesWidget: React.FC<UpcomingDeparturesWidgetProps> = ({ alerts, onActionComplete }) => {
    const { t, language } = useLanguage();
    const { showToast } = useToast();
    const { user } = useAuth();
    const [processingId, setProcessingId] = useState<number | null>(null);

    // Modal states
    const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
    const [activeAlert, setActiveAlert] = useState<DepartureAlert | null>(null);
    const [extensionData, setExtensionData] = useState({ date: '', notes: '' });

    const handleQuickCheckout = async (alert: DepartureAlert) => {
        if (!window.confirm(t('reservations.checkoutMessage', { name: `${alert.employee.firstName} ${alert.employee.lastName}` }))) return;
        setProcessingId(alert.assignment.id);
        try {
            const checkOutDate = new Date().toISOString();
            await assignmentApi.update(alert.assignment.id, { 
                checkOutDate, 
                notes: `System Quick Checkout: Done on ${new Date().toLocaleDateString()}` 
            });
            
            // Free up room occupancy
            if (alert.room) {
                const newOcc = Math.max(0, alert.room.currentOccupancy - 1);
                await roomApi.update(alert.room.id, { 
                    currentOccupancy: newOcc, 
                    status: newOcc === 0 ? 'available' : alert.room.status 
                });
            }
            
            logActivity(user!.username, `Quick checked out ${alert.employee.firstName} via Dashboard`);
            showToast(t('reservations.checkedOut'), 'success');
            onActionComplete();
        } catch (e) {
            showToast(t('errors.generic'), 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const openExtendModal = (alert: DepartureAlert) => {
        setActiveAlert(alert);
        const currentExp = alert.assignment.expectedCheckOutDate ? new Date(alert.assignment.expectedCheckOutDate) : new Date();
        const nextWeek = new Date(currentExp);
        nextWeek.setDate(nextWeek.getDate() + 7);
        setExtensionData({ 
            date: nextWeek.toISOString().split('T')[0], 
            notes: `Stay extended from ${currentExp.toLocaleDateString()}` 
        });
        setIsExtendModalOpen(true);
    };

    const handleExtensionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeAlert) return;
        setProcessingId(activeAlert.assignment.id);
        try {
            await assignmentApi.update(activeAlert.assignment.id, {
                expectedCheckOutDate: new Date(extensionData.date).toISOString(),
                notes: extensionData.notes
            });
            logActivity(user!.username, `Extended stay for ${activeAlert.employee.firstName} until ${extensionData.date}`);
            showToast(t('settings.saved'), 'success');
            setIsExtendModalOpen(false);
            onActionComplete();
        } catch (e) {
            showToast(t('errors.generic'), 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'overdue': return 'bg-rose-500';
            case 'today': return 'bg-amber-500';
            default: return 'bg-blue-500';
        }
    };

    if (alerts.length === 0) return null;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-fade-in-up">
            <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                        <i className="fas fa-plane-departure text-sm"></i>
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">Upcoming Departures</h3>
                </div>
                <span className="text-[10px] font-black bg-rose-50 text-rose-600 px-2.5 py-1 rounded-full">{alerts.length} Action Items</span>
            </div>
            
            <div className="max-h-96 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left rtl:text-right border-collapse">
                    <thead className="text-[9px] font-black uppercase text-slate-400 bg-white dark:bg-slate-800 sticky top-0 z-10">
                        <tr>
                            <th className="px-5 py-3">Staff / Room</th>
                            <th className="px-5 py-3">End Date</th>
                            <th className="px-5 py-3">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                        {alerts.map((alert) => (
                            <tr key={alert.assignment.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                <td className="px-5 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[120px]">
                                            {alert.employee.firstName} {alert.employee.lastName}
                                        </span>
                                        <span className="text-[10px] font-bold text-primary-600 uppercase">Room {alert.room?.roomNumber || 'N/A'}</span>
                                    </div>
                                </td>
                                <td className="px-5 py-4">
                                    <div className="flex flex-col">
                                        <span className={`text-[10px] font-black uppercase flex items-center gap-1.5 ${alert.status === 'overdue' ? 'text-rose-600' : 'text-slate-500'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(alert.status)}`}></span>
                                            {alert.assignment.expectedCheckOutDate ? new Date(alert.assignment.expectedCheckOutDate).toLocaleDateString() : 'None'}
                                        </span>
                                        <span className="text-[9px] text-slate-400">
                                            {alert.status === 'overdue' ? `${Math.abs(alert.daysRemaining)} days late` : `${alert.daysRemaining} days left`}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-5 py-4">
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => openExtendModal(alert)}
                                            disabled={processingId === alert.assignment.id}
                                            className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all shadow-sm"
                                            title="Extend Stay"
                                        >
                                            <i className="fas fa-calendar-plus text-[10px]"></i>
                                        </button>
                                        <button 
                                            onClick={() => handleQuickCheckout(alert)}
                                            disabled={processingId === alert.assignment.id}
                                            className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-all shadow-sm"
                                            title="Confirm Checkout"
                                        >
                                            <i className={`fas ${processingId === alert.assignment.id ? 'fa-spinner fa-spin' : 'fa-check'} text-[10px]`}></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Extension Modal */}
            {isExtendModalOpen && activeAlert && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up">
                        <div className="p-5 border-b dark:border-slate-700 bg-slate-50/50 flex justify-between items-center">
                            <h3 className="font-black text-xs uppercase tracking-widest">Extend Stay</h3>
                            <button onClick={() => setIsExtendModalOpen(false)}><i className="fas fa-times text-slate-400"></i></button>
                        </div>
                        <form onSubmit={handleExtensionSubmit} className="p-5 space-y-4">
                            <div>
                                <label className="block text-[9px] font-black uppercase text-slate-500 mb-1.5">New End Date</label>
                                <input 
                                    type="date" 
                                    value={extensionData.date} 
                                    onChange={e => setExtensionData(p => ({...p, date: e.target.value}))}
                                    required 
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 dark:bg-slate-900 dark:border-slate-700"
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-black uppercase text-slate-500 mb-1.5">Justification / Notes</label>
                                <textarea 
                                    value={extensionData.notes} 
                                    onChange={e => setExtensionData(p => ({...p, notes: e.target.value}))}
                                    rows={3}
                                    placeholder="Reason for extension..."
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-hotel-gold transition-all"
                                ></textarea>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setIsExtendModalOpen(false)} className="px-5 py-2 text-[10px] font-black uppercase text-slate-500">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-hotel-navy text-white rounded-lg text-[10px] font-black uppercase shadow-lg hover:brightness-110">Confirm Extension</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UpcomingDeparturesWidget;
