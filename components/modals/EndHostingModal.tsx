
import React, { useState, useEffect } from 'react';
import { EmployeeHosting, Room } from '../../types';
import { employeeHostingApi, roomApi, housingHistoryApi } from '../../services/apiService';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';

interface EndHostingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    hosting: EmployeeHosting | null;
}

const toDatetimeLocal = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
};

const EndHostingModal: React.FC<EndHostingModalProps> = ({ isOpen, onClose, onSuccess, hosting }) => {
    const { t, language } = useLanguage();
    const { showToast } = useToast();
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [endDateInput, setEndDateInput] = useState(toDatetimeLocal(new Date().toISOString()));
    
    useEffect(() => {
        if (isOpen) {
            setEndDateInput(toDatetimeLocal(new Date().toISOString()));
        }
    }, [isOpen]);

    const handleSubmit = async () => {
        if (!hosting) return;
        setIsSubmitting(true);
        try {
            const checkoutTime = new Date(endDateInput).toISOString();
            
            // 1. Update Hosting Record Status
            await employeeHostingApi.update(hosting.id, { 
                status: 'COMPLETED',
                actualCheckOut: checkoutTime 
            });

            // 2. Update Occupancy if SEPARATE_ROOM
            if (hosting.hostingType === 'SEPARATE_ROOM' && hosting.roomId) {
                const room = await roomApi.getById(hosting.roomId);
                if (room) {
                    const newOcc = Math.max(0, room.currentOccupancy - 1);
                    await roomApi.update(room.id, { 
                        currentOccupancy: newOcc, 
                        status: newOcc === 0 ? 'available' : room.status 
                    });
                }
            }

            // 3. Log to History
            await housingHistoryApi.log(
                hosting.employeeId, 
                hosting.roomId || 0, 
                'HOSTING_END', 
                `Family hosting session ended on ${new Date(checkoutTime).toLocaleDateString()}`,
                user?.username || 'system'
            );

            showToast(language === 'ar' ? 'تم إنهاء الاستضافة وإخلاء الوحدة' : 'Hosting ended and unit cleared', 'success');
            onSuccess();
        } catch(e) {
            showToast(t('errors.generic'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 w-full max-w-md animate-fade-in-up">
                <div className="text-center space-y-4 mb-8">
                    <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 text-2xl mx-auto shadow-inner"><i className="fas fa-door-open"></i></div>
                    <h2 className="text-xl font-black uppercase tracking-widest text-hotel-navy dark:text-white">
                        {language === 'ar' ? 'إنهاء الاستضافة العائلية' : 'End Family Hosting'}
                    </h2>
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">
                        {language === 'ar' ? 'سيتم تسجيل المغادرة وإخلاء السرير المخصص.' : 'Checkout will be recorded and bed will be vacated.'}
                    </p>
                </div>
                <div className="mb-6">
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-widest">{t('reservations.checkOutDate')}</label>
                    <input type="datetime-local" value={endDateInput} onChange={e => setEndDateInput(e.target.value)} required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-hotel-gold outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white transition-all shadow-inner"/>
                </div>
                <div className="flex flex-col gap-2">
                    <button onClick={handleSubmit} disabled={isSubmitting} className="w-full py-3 bg-rose-600 text-white rounded-xl font-black text-xs uppercase shadow-lg hover:bg-rose-700 transition-all">
                        {isSubmitting ? <i className="fas fa-spinner fa-spin"></i> : (language === 'ar' ? 'تأكيد المغادرة النهائية' : 'Confirm Final Departure')}
                    </button>
                    <button onClick={onClose} className="w-full py-3 text-slate-400 font-black uppercase text-[10px] tracking-widest">{t('cancel')}</button>
                </div>
            </div>
        </div>
    );
};

export default EndHostingModal;
