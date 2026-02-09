
import React, { useState, useEffect } from 'react';
import { Assignment, Room } from '../../types';
import { assignmentApi, roomApi, housingHistoryApi } from '../../services/apiService';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';

interface CheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    assignment: Assignment | null;
    rooms: Room[];
}

const toDatetimeLocal = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
};

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, onSuccess, assignment, rooms }) => {
    const { t, language } = useLanguage();
    const { showToast } = useToast();
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [checkOutDateInput, setCheckOutDateInput] = useState(toDatetimeLocal(new Date().toISOString()));

    useEffect(() => {
        if (isOpen) {
            setCheckOutDateInput(toDatetimeLocal(new Date().toISOString()));
        }
    }, [isOpen]);

    const handleSubmit = async () => {
        if (!assignment) return;
        setIsSubmitting(true);
        try {
            const checkoutISO = new Date(checkOutDateInput).toISOString();
            
            // 1. Update Assignment
            await assignmentApi.update(assignment.id, { 
                checkOutDate: checkoutISO,
                notes: (assignment.notes || '') + ` | Checkout by ${user?.username} at ${new Date().toLocaleString()}`
            });

            // 2. Log to Housing History (CRITICAL FIX)
            await housingHistoryApi.log(
                assignment.employeeId,
                assignment.roomId,
                'CHECKOUT',
                language === 'ar' ? 'تم تسجيل مغادرة السكن المعتاد' : 'Regular housing checkout registered',
                user?.username || 'system'
            );

            // 3. Update Room Occupancy
            const room = rooms.find(r => r.id === assignment.roomId);
            if (room) {
                const newOcc = Math.max(0, room.currentOccupancy - 1);
                await roomApi.update(room.id, { 
                    currentOccupancy: newOcc, 
                    status: newOcc === 0 ? 'available' : room.status 
                });
            }

            showToast(t('reservations.checkedOut'), 'success');
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
                    <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 text-2xl mx-auto shadow-inner"><i className="fas fa-sign-out-alt"></i></div>
                    <h2 className="text-xl font-black uppercase tracking-widest text-hotel-navy dark:text-white">{t('reservations.checkoutTitle')}</h2>
                </div>
                <div className="mb-6">
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-widest">{t('reservations.checkOutDate')}</label>
                    <input type="datetime-local" value={checkOutDateInput} onChange={e => setCheckOutDateInput(e.target.value)} required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-hotel-gold outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white transition-all shadow-inner" />
                </div>
                <div className="flex flex-col gap-2">
                    <button onClick={handleSubmit} disabled={isSubmitting} className="w-full py-3 bg-rose-600 text-white rounded-xl font-black text-xs uppercase shadow-lg hover:bg-rose-700 transition-all">
                        {isSubmitting ? <i className="fas fa-spinner fa-spin"></i> : t('reservations.confirmCheckout')}
                    </button>
                    <button onClick={onClose} className="w-full py-3 text-slate-400 font-black uppercase text-[10px] tracking-widest">{t('cancel')}</button>
                </div>
            </div>
        </div>
    );
};

export default CheckoutModal;
