
import React from 'react';
import { EmployeeHosting, ReservationGuest, Employee, Room } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

interface GuestManifestModalProps {
    isOpen: boolean;
    onClose: () => void;
    hosting: EmployeeHosting | null;
    host: Employee | undefined;
    room: Room | undefined;
}

const GuestManifestModal: React.FC<GuestManifestModalProps> = ({ isOpen, onClose, hosting, host, room }) => {
    const { language } = useLanguage();
    if (!isOpen || !hosting) return null;

    const guests: ReservationGuest[] = JSON.parse(hosting.guests || '[]');
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh] print:shadow-none print:rounded-none print:max-h-none print:relative print:w-full">
                
                {/* Header - Hidden in Print if needed, but useful for context */}
                <div className="p-6 border-b dark:border-slate-700 bg-hotel-navy text-white flex justify-between items-center print:bg-white print:text-black print:border-black">
                    <div className="flex items-center gap-3">
                        <i className="fas fa-id-card-alt text-hotel-gold print:text-black"></i>
                        <h2 className="text-xl font-black uppercase tracking-widest">Guest Manifest</h2>
                    </div>
                    <div className="flex gap-2 print:hidden">
                        <button onClick={handlePrint} className="px-4 py-1.5 bg-hotel-gold text-white rounded-lg text-[10px] font-black uppercase shadow-lg hover:brightness-110">
                            <i className="fas fa-print mr-2"></i> Print
                        </button>
                        <button onClick={onClose} className="text-white/60 hover:text-white transition-colors"><i className="fas fa-times"></i></button>
                    </div>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6 print:overflow-visible">
                    {/* Summary Info */}
                    <div className="grid grid-cols-2 gap-8 border-b pb-6 dark:border-slate-700 print:border-black">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Host Employee</p>
                            <p className="text-sm font-black text-hotel-navy dark:text-white uppercase">{host?.firstName} {host?.lastName}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase">{host?.jobTitle} • ID: {host?.employeeId}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Accommodation</p>
                            <p className="text-sm font-black text-hotel-gold uppercase">{room ? `Room ${room.roomNumber}` : 'Shared with Host'}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase">Status: {hosting.status}</p>
                        </div>
                    </div>

                    {/* Guest List Table */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-widest flex items-center gap-2">
                            <i className="fas fa-users text-hotel-gold"></i> Registered Occupants ({guests.length})
                        </h3>
                        <div className="overflow-hidden border rounded-2xl dark:border-slate-700 print:border-black">
                            <table className="w-full text-left rtl:text-right">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 print:bg-slate-100">
                                    <tr>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500 border-b dark:border-slate-700 print:border-black">Full Name</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500 border-b dark:border-slate-700 print:border-black">Type</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500 border-b dark:border-slate-700 print:border-black">ID / Age</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-slate-700 print:divide-black">
                                    {guests.map((g, idx) => (
                                        <tr key={idx} className="bg-white dark:bg-slate-800">
                                            <td className="px-4 py-3 text-xs font-black text-slate-700 dark:text-slate-200 uppercase">{g.firstName} {g.lastName}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${g.guestType === 'child' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                                    {g.guestType}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs font-mono text-slate-500 dark:text-slate-400">
                                                {g.guestType === 'child' ? `${g.guestIdCardNumber} Years Old` : g.guestIdCardNumber}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="pt-6 text-[9px] text-slate-400 font-bold uppercase tracking-widest italic text-center border-t dark:border-slate-700 print:text-black print:border-black">
                        Document generated from Sunrise Staff Housing Management System
                        <br />
                        Date: {new Date().toLocaleString()}
                    </div>
                </div>

                <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50/50 print:hidden">
                    <button onClick={onClose} className="px-8 py-2.5 bg-hotel-navy text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl">Close View</button>
                </div>
            </div>
        </div>
    );
};

export default GuestManifestModal;
