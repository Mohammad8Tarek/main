
import React, { useState, useMemo, useEffect } from 'react';
import { Reservation, Room, Building, Floor, Property, Employee, DEPARTMENTS, departmentJobTitles, RoomTypeConfig } from '../../types';
import { reservationApi, employeeApi, roomApi } from '../../services/apiService';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';

const toDatetimeLocal = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
};

interface ReserveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editingItem: Reservation | null;
    rooms: Room[];
    buildings: Building[];
    floors: Floor[];
    allProperties: Property[];
    getRoomLocation: (roomId: number) => { buildingId: number, floorId: number };
}

const ReserveModal: React.FC<ReserveModalProps> = (props) => {
    const { isOpen, onClose, onSuccess, editingItem, rooms, buildings, floors, allProperties, getRoomLocation } = props;
    const { t, language } = useLanguage();
    const { showToast } = useToast();
    const { settings: appSettings } = useSettings();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const combinedDepartments = useMemo(() => {
        const taxonomy = appSettings.customTaxonomy || { departments: [], hiddenDepartments: [] };
        const combined = Array.from(new Set([...DEPARTMENTS, ...(taxonomy.departments || [])]));
        return combined.filter(d => !(taxonomy.hiddenDepartments || []).includes(d));
    }, [appSettings.customTaxonomy]);

    const getJobTitlesForDept = (dept: string) => {
        const taxonomy = appSettings.customTaxonomy || { jobTitles: {}, hiddenJobTitles: {} };
        const defaults = departmentJobTitles[dept] || [];
        const customs = taxonomy.jobTitles?.[dept] || [];
        return Array.from(new Set([...defaults, ...customs])).filter(t => !(taxonomy.hiddenJobTitles?.[dept] || []).includes(t));
    };
    
    const [reserveForm, setReserveForm] = useState({ 
        firstName: '', 
        lastName: '', 
        guestIdCardNumber: '', 
        guestPhone: '', 
        roomId: '', 
        employeeId: undefined as number | undefined, // Added trackable employeeId
        checkInDate: toDatetimeLocal(new Date().toISOString()), 
        checkOutDate: '', 
        department: combinedDepartments[0] || 'reception', 
        jobTitle: getJobTitlesForDept(combinedDepartments[0] || 'reception')[0] || '', 
        notes: '' 
    });
    
    // Filter & Search
    const [selectedBuildId, setSelectedBuildId] = useState<string>('');
    const [selectedFloorId, setSelectedFloorId] = useState<string>('');
    const [selectedRoomType, setSelectedRoomType] = useState<string>('');
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
            if (editingItem) {
                setReserveForm({
                    firstName: editingItem.firstName,
                    lastName: editingItem.lastName,
                    guestIdCardNumber: editingItem.guestIdCardNumber,
                    guestPhone: editingItem.guestPhone,
                    department: editingItem.department,
                    jobTitle: editingItem.jobTitle,
                    employeeId: editingItem.employeeId,
                    notes: editingItem.notes || '',
                    checkInDate: toDatetimeLocal(editingItem.checkInDate),
                    checkOutDate: editingItem.checkOutDate ? toDatetimeLocal(editingItem.checkOutDate) : '',
                    roomId: String(editingItem.roomId)
                });
                const loc = getRoomLocation(editingItem.roomId);
                setSelectedBuildId(String(loc.buildingId));
                setSelectedFloorId(String(loc.floorId));
            } else {
                setReserveForm({ firstName: '', lastName: '', guestIdCardNumber: '', guestPhone: '', roomId: '', employeeId: undefined, checkInDate: toDatetimeLocal(new Date().toISOString()), checkOutDate: '', department: combinedDepartments[0] || 'reception', jobTitle: '', notes: '' });
                setSelectedBuildId('');
                setSelectedFloorId('');
                setSelectedRoomType('');
            }
            setGlobalSearchQuery('');
            setGlobalResults([]);
        }
    }, [isOpen, editingItem]);

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
        if (!emp) return;
        setReserveForm(p => ({ 
            ...p, 
            firstName: emp.firstName, 
            lastName: emp.lastName, 
            guestIdCardNumber: emp.nationalId, 
            guestPhone: emp.phone, 
            department: emp.department, 
            jobTitle: emp.jobTitle,
            employeeId: emp.id // Link the ID
        }));
        setGlobalResults([]);
        setGlobalSearchQuery('');
        showToast(`${emp.firstName} selected and linked`, "success");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); 
        setIsSubmitting(true);
        try {
            const data = { 
                ...reserveForm, 
                roomId: parseInt(reserveForm.roomId), 
                checkInDate: new Date(reserveForm.checkInDate).toISOString(), 
                checkOutDate: reserveForm.checkOutDate ? new Date(reserveForm.checkOutDate).toISOString() : null, 
                guests: '[]' 
            };
            if (editingItem) {
                await reservationApi.update(editingItem.id, data as any);
            } else { 
                await reservationApi.create(data as any); 
                await roomApi.update(data.roomId, { status: 'reserved' }); 
            }
            showToast(t(editingItem ? 'employees.updated' : 'reservations.resAdded'), 'success'); 
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
                    <h2 className="text-xl font-black uppercase tracking-widest">{editingItem ? (language === 'ar' ? 'تعديل حجز' : 'Edit Booking') : t('reservations.newRes')}</h2>
                    <button onClick={onClose} className="text-white/60 hover:text-white"><i className="fas fa-times"></i></button>
                </div>
                <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                    <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                        <label className={labelClass}>{language === 'ar' ? 'بحث عن موظف (من كافة الفروع)' : 'Link to Staff Member (Global Search)'}</label>
                        <div className="flex flex-col sm:flex-row gap-2 mb-4">
                            <select value={selectedSearchPropertyId} onChange={e => setSelectedSearchPropertyId(e.target.value)} className="w-full sm:w-48 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-hotel-gold shadow-sm">
                                <option value="all">{language === 'ar' ? 'كل الفروع' : 'All Branches'}</option>
                                {allProperties.map(p => <option key={p.id} value={p.id}>{p.code} - {p.displayName || p.name}</option>)}
                            </select>
                            <input placeholder={language === 'ar' ? 'الاسم، الهوية، أو الرقم الوظيفي...' : 'Name, ID, or Staff ID...'} value={globalSearchQuery} onChange={e => setGlobalSearchQuery(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleGlobalSearch()} className={inputClass + " flex-1"} />
                            <button onClick={handleGlobalSearch} disabled={isSearchingGlobal} className="bg-hotel-gold text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-lg">
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
                        {reserveForm.employeeId && (
                            <div className="mt-2 text-[10px] font-black text-emerald-600 uppercase flex items-center gap-2">
                                <i className="fas fa-link"></i> Linked to Employee Profile ID: {reserveForm.employeeId}
                            </div>
                        )}
                    </div>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div><label className={labelClass}>First Name</label><input value={reserveForm.firstName} onChange={e => setReserveForm(p=>({...p, firstName: e.target.value}))} required className={inputClass} /></div>
                        <div><label className={labelClass}>Last Name</label><input value={reserveForm.lastName} onChange={e => setReserveForm(p=>({...p, lastName: e.target.value}))} required className={inputClass} /></div>
                        <div><label className={labelClass}>ID / Passport</label><input value={reserveForm.guestIdCardNumber} onChange={e => setReserveForm(p=>({...p, guestIdCardNumber: e.target.value}))} required className={inputClass} /></div>
                        <div><label className={labelClass}>Phone</label><input value={reserveForm.guestPhone} onChange={e => setReserveForm(p=>({...p, guestPhone: e.target.value}))} className={inputClass} /></div>
                        <div><label className={labelClass}>Department</label><select value={reserveForm.department} onChange={e => setReserveForm(p=>({...p, department: e.target.value, jobTitle: getJobTitlesForDept(e.target.value)[0]}))} className={inputClass}>{combinedDepartments.map(d => <option key={d} value={d}>{t(`departments.${d}`)}</option>)}</select></div>
                        <div><label className={labelClass}>Job Title</label><select value={reserveForm.jobTitle} onChange={e => setReserveForm(p=>({...p, jobTitle: e.target.value}))} className={inputClass}>{getJobTitlesForDept(reserveForm.department).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                        <div className="col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                            <div className="col-span-3 pb-1 border-b mb-1 flex justify-between items-center"><h4 className="text-[9px] font-black uppercase text-hotel-gold tracking-[0.2em]">Unit Selection</h4></div>
                            <div><label className={labelClass}>Building</label><select value={selectedBuildId} onChange={e => { setSelectedBuildId(e.target.value); setSelectedFloorId(''); setReserveForm(p=>({...p, roomId: ''}))}} className={inputClass}><option value="">-- Select --</option>{buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                            <div><label className={labelClass}>Floor</label><select value={selectedFloorId} onChange={e => { setSelectedFloorId(e.target.value); setReserveForm(p=>({...p, roomId: ''}))}} disabled={!selectedBuildId} className={inputClass}><option value="">-- Select --</option>{modalFloors.map(f => <option key={f.id} value={f.id}>{f.floorNumber}</option>)}</select></div>
                            <div><label className={labelClass}>Room Type</label><select value={selectedRoomType} onChange={e => { setSelectedRoomType(e.target.value); setReserveForm(p=>({...p, roomId: ''}))}} disabled={!selectedFloorId} className={inputClass}><option value="">-- All --</option>{roomTypes.map(rt => <option key={rt.name} value={rt.name}>{rt.name}</option>)}</select></div>
                            <div className="col-span-3"><label className={labelClass}>Room</label><select value={reserveForm.roomId} onChange={e => setReserveForm(p=>({...p, roomId: e.target.value}))} disabled={!selectedFloorId} required className={inputClass}><option value="">-- Choose Assigned Room --</option>{modalRooms.map(r => <option key={r.id} value={r.id}>{r.roomNumber} ({r.roomType})</option>)}</select></div>
                        </div>
                        <div><label className={labelClass}>Arrival Date</label><input type="datetime-local" value={reserveForm.checkInDate} onChange={e => setReserveForm(p=>({...p, checkInDate: e.target.value}))} required className={inputClass} /></div>
                        <div><label className={labelClass}>Departure Date</label><input type="datetime-local" value={reserveForm.checkOutDate} onChange={e => setReserveForm(p=>({...p, checkOutDate: e.target.value}))} className={inputClass} /></div>
                    </form>
                </div>
                <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50/50">
                    <button type="button" onClick={onClose} className="px-6 py-2 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancel</button>
                    <button onClick={handleSubmit} disabled={isSubmitting} className="px-12 py-3 bg-hotel-navy text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:brightness-110">{isSubmitting ? t('saving') : t('save')}</button>
                </div>
            </div>
        </div>
    );
};

export default ReserveModal;
