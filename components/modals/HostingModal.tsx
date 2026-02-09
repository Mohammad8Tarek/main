
import React, { useState, useMemo, useEffect } from 'react';
import { Employee, Room, Building, Floor, ReservationGuest, Property, RoomTypeConfig, EmployeeHosting } from '../../types';
import { employeeApi, employeeHostingApi, getApiPropertyId } from '../../services/apiService';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../hooks/useAuth';

const EMPTY_GUEST: ReservationGuest = { 
    firstName: '', lastName: '', guestIdCardNumber: '', guestPhone: '', jobTitle: '', department: '', guestType: 'adult', age: ''
};

const toDatetimeLocal = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
};

interface HostingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editingItem: EmployeeHosting | null;
    employees: Employee[];
    rooms: Room[];
    buildings: Building[];
    floors: Floor[];
    allProperties: Property[];
    getRoomLocation: (roomId: number) => { buildingId: number, floorId: number };
}

const HostingModal: React.FC<HostingModalProps> = (props) => {
    const { isOpen, onClose, onSuccess, editingItem, employees, rooms, buildings, floors, allProperties, getRoomLocation } = props;
    const { t, language } = useLanguage();
    const { showToast } = useToast();
    const { settings: appSettings } = useSettings();
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [hostingForm, setHostingForm] = useState({ 
        employeeId: '', 
        roomId: '', 
        startDate: toDatetimeLocal(new Date().toISOString()), 
        endDate: '', 
        guests: [{ ...EMPTY_GUEST }] as ReservationGuest[], 
        notes: '', 
        hostingType: 'SAME_ROOM' as 'SAME_ROOM' | 'SEPARATE_ROOM' 
    });
    
    // UI Filter States
    const [selectedBuildId, setSelectedBuildId] = useState<string>('');
    const [selectedFloorId, setSelectedFloorId] = useState<string>('');
    const [selectedRoomType, setSelectedRoomType] = useState<string>('');

    // Host Global Search
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
                setHostingForm({
                    employeeId: String(editingItem.employeeId),
                    roomId: editingItem.roomId ? String(editingItem.roomId) : '',
                    startDate: toDatetimeLocal(editingItem.expectedFrom),
                    endDate: editingItem.expectedTo ? toDatetimeLocal(editingItem.expectedTo) : '',
                    guests: JSON.parse(editingItem.guests || '[]'),
                    notes: editingItem.notes || '',
                    hostingType: editingItem.hostingType
                });
                if (editingItem.roomId) {
                    const loc = getRoomLocation(editingItem.roomId);
                    setSelectedBuildId(String(loc.buildingId));
                    setSelectedFloorId(String(loc.floorId));
                }
            } else {
                setHostingForm({ 
                    employeeId: '', 
                    roomId: '', 
                    startDate: toDatetimeLocal(new Date().toISOString()), 
                    endDate: '', 
                    guests: [{ ...EMPTY_GUEST }], 
                    notes: '', 
                    hostingType: 'SAME_ROOM' 
                });
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

    const selectGlobalHost = (emp: Employee) => {
        setHostingForm(p => ({ ...p, employeeId: String(emp.id) }));
        setGlobalResults([]);
        setGlobalSearchQuery('');
        showToast(`${emp.firstName} ${emp.lastName} selected as Host`, "success");
    };

    const handleGuestUpdate = (index: number, field: keyof ReservationGuest, value: any) => {
        const updatedGuests = [...hostingForm.guests];
        updatedGuests[index] = { ...updatedGuests[index], [field]: value };
        setHostingForm(p => ({ ...p, guests: updatedGuests }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); 
        if (!hostingForm.employeeId) {
            showToast(language === 'ar' ? 'يرجى اختيار الموظف المضيف' : 'Please select the host employee', 'error');
            return;
        }
        if (hostingForm.guests.some(g => !g.firstName)) {
            showToast(language === 'ar' ? 'يرجى إكمال بيانات الضيوف' : 'Please complete guest names', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload: Omit<EmployeeHosting, 'id'> = {
                employeeId: parseInt(hostingForm.employeeId),
                propertyId: getApiPropertyId(),
                hostingType: hostingForm.hostingType,
                guestsCount: hostingForm.guests.length,
                expectedFrom: new Date(hostingForm.startDate).toISOString(),
                expectedTo: hostingForm.endDate ? new Date(hostingForm.endDate).toISOString() : new Date(new Date(hostingForm.startDate).getTime() + 86400000).toISOString(),
                actualCheckIn: editingItem?.actualCheckIn || null,
                actualCheckOut: editingItem?.actualCheckOut || null,
                roomId: hostingForm.hostingType === 'SEPARATE_ROOM' ? parseInt(hostingForm.roomId) : null,
                status: editingItem?.status || 'UPCOMING',
                notes: hostingForm.notes,
                createdBy: user?.username || 'system',
                createdAt: editingItem?.createdAt || new Date().toISOString(),
                guests: JSON.stringify(hostingForm.guests)
            };

            if (editingItem) {
                await employeeHostingApi.update(editingItem.id, payload);
                showToast(t('employees.updated'), 'success');
            } else {
                await employeeHostingApi.create(payload);
                showToast(language === 'ar' ? 'تم تسجيل الاستضافة بنجاح' : 'Hosting registered successfully', 'success');
            }
            onSuccess();
        } catch (e) {
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

    const selectedHost = employees.find(e => String(e.id) === hostingForm.employeeId);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
                <div className="p-6 border-b dark:border-slate-700 bg-hotel-navy text-white flex justify-between items-center">
                    <h2 className="text-xl font-black uppercase tracking-widest">
                        {editingItem ? (language === 'ar' ? 'تعديل استضافة' : 'Edit Hosting') : (language === 'ar' ? 'استضافة جديدة' : 'New Guest Hosting')}
                    </h2>
                    <button onClick={onClose} className="text-white/60 hover:text-white"><i className="fas fa-times"></i></button>
                </div>
                
                <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                    {/* 1. HOST SELECTION */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                        <label className={labelClass}>{language === 'ar' ? 'البحث عن الموظف المضيف' : 'Find Host Employee'}</label>
                        <div className="flex flex-col sm:flex-row gap-2 mb-4">
                            <select value={selectedSearchPropertyId} onChange={e => setSelectedSearchPropertyId(e.target.value)} className="w-full sm:w-48 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase outline-none shadow-sm">
                                <option value="all">{language === 'ar' ? 'جميع المواقع' : 'All Properties'}</option>
                                {allProperties.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
                            </select>
                            <input 
                                placeholder={language === 'ar' ? 'بحث بالاسم أو الرقم الوظيفي...' : 'Search by Name or ID...'} 
                                value={globalSearchQuery} 
                                onChange={e => setGlobalSearchQuery(e.target.value)} 
                                onKeyPress={e => e.key === 'Enter' && handleGlobalSearch()} 
                                className={inputClass + " flex-1"} 
                            />
                            <button onClick={handleGlobalSearch} disabled={isSearchingGlobal} className="bg-hotel-gold text-white px-6 rounded-xl font-black text-[10px] uppercase shadow-lg">
                                {isSearchingGlobal ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-search"></i>}
                            </button>
                        </div>

                        {globalResults.length > 0 && (
                            <div className="space-y-2 mb-4 max-h-40 overflow-y-auto custom-scrollbar">
                                {globalResults.map(emp => (
                                    <div key={emp.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border flex justify-between items-center group hover:border-hotel-gold transition-colors">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-slate-800 dark:text-white uppercase">{emp.firstName} {emp.lastName}</span>
                                            <span className="text-[9px] text-slate-400 font-bold uppercase">{emp.jobTitle} • {allProperties.find(p=>p.id===emp.propertyId)?.code}</span>
                                        </div>
                                        <button onClick={() => selectGlobalHost(emp)} className="px-4 py-1.5 bg-hotel-navy text-white rounded-lg text-[9px] font-black uppercase shadow-md">Select</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedHost && (
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white"><i className="fas fa-user-check"></i></div>
                                <div>
                                    <p className="text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-tight">Host: {selectedHost.firstName} {selectedHost.lastName}</p>
                                    <p className="text-[9px] text-emerald-600/70 font-bold uppercase">{selectedHost.jobTitle} • {selectedHost.employeeId}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 2. LOGISTICS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="col-span-1">
                            <label className={labelClass}>Hosting Type</label>
                            <div className="grid grid-cols-1 gap-2">
                                <button type="button" onClick={() => setHostingForm(p => ({...p, hostingType: 'SAME_ROOM'}))} className={`p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${hostingForm.hostingType === 'SAME_ROOM' ? 'border-hotel-gold bg-hotel-gold/5' : 'border-slate-100 dark:border-slate-700'}`}>
                                    <i className={`fas fa-bed ${hostingForm.hostingType === 'SAME_ROOM' ? 'text-hotel-gold' : 'text-slate-300'}`}></i>
                                    <span className="text-[10px] font-black uppercase">Shared Room</span>
                                </button>
                                <button type="button" onClick={() => setHostingForm(p => ({...p, hostingType: 'SEPARATE_ROOM'}))} className={`p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${hostingForm.hostingType === 'SEPARATE_ROOM' ? 'border-hotel-navy bg-hotel-navy/5' : 'border-slate-100 dark:border-slate-700'}`}>
                                    <i className={`fas fa-door-closed ${hostingForm.hostingType === 'SEPARATE_ROOM' ? 'text-hotel-navy' : 'text-slate-300'}`}></i>
                                    <span className="text-[10px] font-black uppercase">Private Room</span>
                                </button>
                            </div>
                        </div>

                        {hostingForm.hostingType === 'SEPARATE_ROOM' && (
                            <div className="col-span-2 grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100">
                                <div><label className={labelClass}>Building</label><select value={selectedBuildId} onChange={e => { setSelectedBuildId(e.target.value); setSelectedFloorId(''); setHostingForm(p=>({...p, roomId: ''}))}} className={inputClass}><option value="">Select</option>{buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                                <div><label className={labelClass}>Floor</label><select value={selectedFloorId} onChange={e => { setSelectedFloorId(e.target.value); setHostingForm(p=>({...p, roomId: ''}))}} disabled={!selectedBuildId} className={inputClass}><option value="">Select</option>{modalFloors.map(f => <option key={f.id} value={f.id}>{f.floorNumber}</option>)}</select></div>
                                <div><label className={labelClass}>Room</label><select value={hostingForm.roomId} onChange={e => setHostingForm(p=>({...p, roomId: e.target.value}))} disabled={!selectedFloorId} className={inputClass}><option value="">Choose</option>{modalRooms.map(r => <option key={r.id} value={r.id}>{r.roomNumber}</option>)}</select></div>
                            </div>
                        )}
                        
                        <div className={`${hostingForm.hostingType === 'SAME_ROOM' ? 'col-span-2' : 'col-span-3'} grid grid-cols-2 gap-4`}>
                            <div><label className={labelClass}>Expected Arrival</label><input type="datetime-local" value={hostingForm.startDate} onChange={e => setHostingForm(p=>({...p, startDate: e.target.value}))} required className={inputClass} /></div>
                            <div><label className={labelClass}>Expected End</label><input type="datetime-local" value={hostingForm.endDate} onChange={e => setHostingForm(p=>({...p, endDate: e.target.value}))} required className={inputClass} /></div>
                        </div>
                    </div>

                    {/* 3. MULTI-GUEST ENTRY */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b dark:border-slate-700 pb-2">
                            <h3 className="text-xs font-black uppercase text-hotel-navy dark:text-white tracking-widest flex items-center gap-2">
                                <i className="fas fa-users text-hotel-gold"></i> Guest Group Details
                            </h3>
                            <button type="button" onClick={() => setHostingForm(p => ({ ...p, guests: [...p.guests, { ...EMPTY_GUEST }] }))} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:brightness-110 transition-all flex items-center gap-2">
                                <i className="fas fa-plus"></i> Add Person
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {hostingForm.guests.map((g, idx) => (
                                <div key={idx} className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm relative group animate-fade-in-up">
                                    {hostingForm.guests.length > 1 && (
                                        <button type="button" onClick={() => setHostingForm(p => ({ ...p, guests: p.guests.filter((_, i) => i !== idx) }))} className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-all shadow-lg">
                                            <i className="fas fa-times"></i>
                                        </button>
                                    )}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4 mb-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" checked={g.guestType === 'adult'} onChange={() => handleGuestUpdate(idx, 'guestType', 'adult')} className="w-3 h-3 text-hotel-navy" />
                                                <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400">Adult</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" checked={g.guestType === 'child'} onChange={() => handleGuestUpdate(idx, 'guestType', 'child')} className="w-3 h-3 text-hotel-gold" />
                                                <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400">Child</span>
                                            </label>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><label className={labelClass}>First Name</label><input value={g.firstName} onChange={e => handleGuestUpdate(idx, 'firstName', e.target.value)} required className={inputClass} /></div>
                                            <div><label className={labelClass}>Last Name</label><input value={g.lastName} onChange={e => handleGuestUpdate(idx, 'lastName', e.target.value)} required className={inputClass} /></div>
                                            <div className="col-span-2">
                                                <label className={labelClass}>{g.guestType === 'child' ? 'Age (Years)' : 'National ID / Passport'}</label>
                                                <input 
                                                    type={g.guestType === 'child' ? 'number' : 'text'} 
                                                    value={g.guestIdCardNumber} 
                                                    onChange={e => handleGuestUpdate(idx, 'guestIdCardNumber', e.target.value)} 
                                                    required 
                                                    className={inputClass} 
                                                    placeholder={g.guestType === 'child' ? 'e.g. 8' : 'Enter ID Number'}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50/50">
                    <button type="button" onClick={onClose} className="px-6 py-2 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancel</button>
                    <button onClick={handleSubmit} disabled={isSubmitting} className="px-12 py-3 bg-hotel-navy text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:brightness-110 transition-all">
                        {isSubmitting ? <i className="fas fa-spinner fa-spin mr-2"></i> : (editingItem ? 'Update Session' : 'Create Session')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HostingModal;
