
import React, { useState, useMemo, useEffect } from 'react';
import { Employee, Room, Building, Floor, Property, RoomTypeConfig, Assignment } from '../../types';
import { assignmentApi, employeeApi, roomApi, getApiPropertyId } from '../../services/apiService';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';

interface AssignModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    employees: Employee[];
    rooms: Room[];
    buildings: Building[];
    floors: Floor[];
    allProperties: Property[];
}

const toDatetimeLocal = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
};

const AssignModal: React.FC<AssignModalProps> = ({ isOpen, onClose, onSuccess, employees, rooms, buildings, floors, allProperties }) => {
    const { t, language } = useLanguage();
    const { showToast } = useToast();
    const { settings: appSettings } = useSettings();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [assignForm, setAssignForm] = useState({ employeeId: '', roomId: '', checkInDate: toDatetimeLocal(new Date().toISOString()), expectedCheckOutDate: '' });
    
    // Filter Logic
    const [selectedBuildId, setSelectedBuildId] = useState<string>('');
    const [selectedFloorId, setSelectedFloorId] = useState<string>('');
    const [selectedRoomType, setSelectedRoomType] = useState<string>('');

    // Global Search Logic
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [globalResults, setGlobalResults] = useState<Employee[]>([]);
    const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
    const [selectedSearchPropertyId, setSelectedSearchPropertyId] = useState<string>('all');
    
    const roomTypes = useMemo(() => {
        const tax = appSettings.customTaxonomy?.roomTypes || [];
        return tax.map(rt => typeof rt === 'string' ? { name: rt, description: '', defaultCapacity: 1 } : rt);
    }, [appSettings.customTaxonomy]);

    useEffect(() => {
        if (isOpen) {
            setAssignForm({ employeeId: '', roomId: '', checkInDate: toDatetimeLocal(new Date().toISOString()), expectedCheckOutDate: '' });
            setSelectedBuildId('');
            setSelectedFloorId('');
            setSelectedRoomType('');
            setGlobalSearchQuery('');
            setGlobalResults([]);
        }
    }, [isOpen]);

    const handleGlobalSearch = async () => {
        if (!globalSearchQuery.trim()) return;
        setIsSearchingGlobal(true);
        try {
            const propId = selectedSearchPropertyId === 'all' ? undefined : parseInt(selectedSearchPropertyId);
            const results = await employeeApi.searchGlobal(globalSearchQuery, propId);
            setGlobalResults(results);
        } catch (e) { showToast(t('errors.generic'), 'error'); } 
        finally { setIsSearchingGlobal(false); }
    };

    const selectGlobalEmployee = (emp: Employee) => {
        if (!emp || !emp.id) return;
        setAssignForm(p => ({ ...p, employeeId: String(emp.id) }));
        setGlobalResults([]);
        setGlobalSearchQuery('');
        showToast(`${emp.firstName} selected`, "success");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assignForm.employeeId || !assignForm.roomId) return;
        setIsSubmitting(true);
        try {
            // FIX: Explicitly typed data to Omit<Assignment, 'id'> and provided missing required properties 'propertyId' and 'checkOutDate'.
            const data: Omit<Assignment, 'id'> = { 
                employeeId: parseInt(assignForm.employeeId), 
                roomId: parseInt(assignForm.roomId), 
                checkInDate: new Date(assignForm.checkInDate).toISOString(), 
                expectedCheckOutDate: assignForm.expectedCheckOutDate ? new Date(assignForm.expectedCheckOutDate).toISOString() : null,
                propertyId: getApiPropertyId(),
                checkOutDate: null,
                notes: ''
            };
            await assignmentApi.create(data);
            const room = rooms.find(r => r.id === data.roomId);
            if (room) {
                const newOcc = room.currentOccupancy + 1;
                await roomApi.update(room.id, { 
                    currentOccupancy: newOcc, 
                    status: newOcc >= room.capacity ? 'occupied' : 'available' 
                });
            }
            showToast(t('reservations.added'), 'success');
            onSuccess();
        } catch(e) {
            showToast(t('errors.generic'), 'error');
        } finally { 
            setIsSubmitting(false); 
        }
    };

    const modalFloors = useMemo(() => floors.filter(f => f.buildingId === parseInt(selectedBuildId)), [floors, selectedBuildId]);
    const modalRooms = useMemo(() => {
        let filtered = rooms.filter(r => r.floorId === parseInt(selectedFloorId) && (r.status === 'available' || r.currentOccupancy < r.capacity));
        if (selectedRoomType) filtered = filtered.filter(r => r.roomType === selectedRoomType);
        return filtered;
    }, [rooms, selectedFloorId, selectedRoomType]);

    const inputClass = "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-hotel-gold outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white transition-all shadow-inner placeholder-slate-400";
    const labelClass = "block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-widest";

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
                <div className="p-6 border-b dark:border-slate-700 bg-hotel-navy text-white flex justify-between items-center">
                    <h2 className="text-xl font-black uppercase tracking-widest">{t('reservations.new')}</h2>
                    <button onClick={onClose} className="text-white/60 hover:text-white"><i className="fas fa-times"></i></button>
                </div>
                <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                    <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                        <label className={labelClass}>{language === 'ar' ? 'البحث العالمي عن موظف' : 'Staff Search (Any Branch)'}</label>
                        <div className="flex flex-col sm:flex-row gap-2 mb-4">
                            <select value={selectedSearchPropertyId} onChange={e => setSelectedSearchPropertyId(e.target.value)} className="w-full sm:w-48 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase outline-none shadow-sm">
                                <option value="all">{language === 'ar' ? 'كل الفروع' : 'All Branches'}</option>
                                {allProperties.map(p => <option key={p.id} value={p.id}>{p.code} - {p.displayName || p.name}</option>)}
                            </select>
                            <input placeholder="Name, National ID, or Staff ID..." value={globalSearchQuery} onChange={e => setGlobalSearchQuery(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleGlobalSearch()} className={inputClass + " flex-1"} />
                            <button onClick={handleGlobalSearch} disabled={isSearchingGlobal} className="bg-hotel-gold text-white px-6 rounded-xl font-black text-[10px] uppercase shadow-lg">
                                {isSearchingGlobal ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-search"></i>}
                            </button>
                        </div>
                        {globalResults.length > 0 && (
                            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                {globalResults.map(emp => (
                                    <div key={emp.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border flex justify-between items-center group">
                                        <div className="flex flex-col"><span className="text-xs font-black text-slate-800 dark:text-white uppercase">{emp.firstName} {emp.lastName} {emp.employeeId ? `(${emp.employeeId})` : ''}</span><span className="text-[9px] text-slate-400 font-bold uppercase">{emp.jobTitle} • {allProperties.find(p=>p.id===emp.propertyId)?.code || 'EXT'}</span></div>
                                        <button onClick={() => selectGlobalEmployee(emp)} className="px-4 py-1.5 bg-hotel-navy text-white rounded-lg text-[9px] font-black uppercase shadow-md transition-all">Select</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className={labelClass}>Select Local Profile</label>
                            <select value={assignForm.employeeId} onChange={e => setAssignForm(p=>({...p, employeeId: e.target.value}))} required className={inputClass}>
                                <option value="">-- Choose Profile --</option>
                                {employees.filter(e=>e.status === 'active').map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeId})</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                            <div className="col-span-3 pb-1 border-b mb-1"><h4 className="text-[9px] font-black uppercase text-hotel-gold tracking-[0.2em]">Housing Allocation</h4></div>
                            <div><label className={labelClass}>Building</label><select value={selectedBuildId} onChange={e => { setSelectedBuildId(e.target.value); setSelectedFloorId(''); setAssignForm(p=>({...p, roomId: ''}))}} className={inputClass}><option value="">-- Select --</option>{buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                            <div><label className={labelClass}>Floor</label><select value={selectedFloorId} onChange={e => { setSelectedFloorId(e.target.value); setAssignForm(p=>({...p, roomId: ''}))}} disabled={!selectedBuildId} className={inputClass}><option value="">-- Select --</option>{modalFloors.map(f => <option key={f.id} value={f.id}>{f.floorNumber}</option>)}</select></div>
                            <div><label className={labelClass}>Room Type</label><select value={selectedRoomType} onChange={e => { setSelectedRoomType(e.target.value); setAssignForm(p=>({...p, roomId: ''}))}} disabled={!selectedFloorId} className={inputClass}><option value="">-- All --</option>{roomTypes.map(rt => <option key={rt.name} value={rt.name}>{rt.name}</option>)}</select></div>
                            <div className="col-span-3"><label className={labelClass}>Room</label><select value={assignForm.roomId} onChange={e => setAssignForm(p=>({...p, roomId: e.target.value}))} disabled={!selectedFloorId} required className={inputClass}><option value="">-- Select Room --</option>{modalRooms.map(r => <option key={r.id} value={r.id}>{r.roomNumber} ({r.roomType} - {r.capacity - r.currentOccupancy} Beds Available)</option>)}</select></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className={labelClass}>Check-In Date</label><input type="datetime-local" value={assignForm.checkInDate} onChange={e => setAssignForm(p=>({...p, checkInDate: e.target.value}))} required className={inputClass} /></div>
                            <div><label className={labelClass}>Expected Checkout</label><input type="datetime-local" value={assignForm.expectedCheckOutDate} onChange={e => setAssignForm(p=>({...p, expectedCheckOutDate: e.target.value}))} className={inputClass} /></div>
                        </div>
                    </form>
                </div>
                <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50/50">
                    <button type="button" onClick={onClose} className="px-6 py-2 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancel</button>
                    <button onClick={handleSubmit} disabled={isSubmitting} className="px-12 py-3 bg-hotel-navy text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:brightness-110 transition-all">{isSubmitting ? t('saving') : "Confirm Arrival"}</button>
                </div>
            </div>
        </div>
    );
};

export default AssignModal;
