
import React, { useState, useEffect, useMemo } from 'react';
import { Building, Room, Floor, RoomTypeConfig } from '../types';
import { buildingApi, roomApi, floorApi, logActivity } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { usePermissions } from '../hooks/usePermissions';
import { useSettings } from '../context/SettingsContext';

const BuildingsAndRoomsPage: React.FC = () => {
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [floors, setFloors] = useState<Floor[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user } = useAuth();
    const { t } = useLanguage();
    const { showToast } = useToast();
    const perms = usePermissions();
    const { settings: appSettings } = useSettings();
    const [activeTab, setActiveTab] = useState<'buildings' | 'floors' | 'rooms'>('buildings');

    // Room Types Taxonomy with Default Data normalization
    const roomTypes = useMemo(() => {
        const tax = appSettings.customTaxonomy?.roomTypes || [];
        return tax.map(rt => typeof rt === 'string' ? { name: rt, description: '', defaultCapacity: 1 } : rt);
    }, [appSettings.customTaxonomy]);

    // Building Modal States
    const [isBuildingModalOpen, setIsBuildingModalOpen] = useState(false);
    const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
    const [buildingFormData, setBuildingFormData] = useState({ name: '', location: '', capacity: '100', status: 'active' as Building['status'] });

    // Floor Modal States
    const [isFloorModalOpen, setIsFloorModalOpen] = useState(false);
    const [editingFloor, setEditingFloor] = useState<Floor | null>(null);
    const [floorFormData, setFloorFormData] = useState({ floorNumber: '', description: '', buildingId: '' });

    // Room Modal States
    const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
    const [editingRoom, setEditingRoom] = useState<Room | null>(null);
    const [roomFormData, setRoomFormData] = useState({ floorId: '', roomNumber: '', roomType: '', capacity: '2' });
    
    // Selection States
    const [selectedBuildingIds, setSelectedBuildingIds] = useState<number[]>([]);
    const [selectedFloorIds, setSelectedFloorIds] = useState<number[]>([]);
    const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>([]);

    // Bulk Status Modal States
    const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
    const [bulkStatusType, setBulkStatusType] = useState<'buildings' | 'rooms'>('rooms');
    const [newBulkStatus, setNewBulkStatus] = useState<string>('');

    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [buildingsData, floorsData, roomsData] = await Promise.all([buildingApi.getAll(), floorApi.getAll(), roomApi.getAll()]);
            setBuildings(buildingsData);
            setFloors(floorsData);
            setRooms(roomsData);
        } catch (error) { showToast(t('errors.fetchFailed'), 'error'); } finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const handleSort = (key: string) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    const renderSortIcon = (key: string) => sortConfig.key !== key ? <i className="fas fa-sort text-slate-300 ml-1 text-[10px]"></i> : (sortConfig.direction === 'asc' ? <i className="fas fa-sort-up ml-1 text-primary-500"></i> : <i className="fas fa-sort-down ml-1 text-primary-500"></i>);

    const sortedRooms = useMemo(() => {
        const sortableItems = [...rooms];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                const valA = (a as any)[sortConfig.key];
                const valB = (b as any)[sortConfig.key];
                
                if (valA === null || valA === undefined) return 1;
                if (valB === null || valB === undefined) return -1;
                
                if (valA < valB) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (valA > valB) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [rooms, sortConfig]);

    const handleBulkDelete = async (type: 'buildings' | 'floors' | 'rooms') => {
        if (!perms.canDeleteHousing) return;
        const ids = type === 'buildings' ? selectedBuildingIds : type === 'floors' ? selectedFloorIds : selectedRoomIds;
        if (ids.length === 0) return;
        if (!window.confirm(t('confirmBulkDelete', { count: ids.length }))) return;
        setIsSubmitting(true);
        try {
            const api = type === 'buildings' ? buildingApi : type === 'floors' ? floorApi : roomApi;
            await api.deleteMany(ids);
            logActivity(user!.username, `Bulk deleted ${ids.length} ${type}`);
            showToast(t('statuses.resolved'), 'success');
            if (type === 'buildings') setSelectedBuildingIds([]);
            else if (type === 'floors') setSelectedFloorIds([]);
            else setSelectedRoomIds([]);
            fetchData();
        } catch (err) { showToast(t('errors.generic'), 'error'); } finally { setIsSubmitting(false); }
    };

    const handleBulkStatusChange = async () => {
        if (!perms.canManageHousing || !newBulkStatus) return;
        const ids = bulkStatusType === 'buildings' ? selectedBuildingIds : selectedRoomIds;
        if (ids.length === 0) return;
        
        setIsSubmitting(true);
        try {
            if (bulkStatusType === 'buildings') {
                await buildingApi.updateMany(ids, { status: newBulkStatus as any });
            } else {
                await roomApi.updateMany(ids, { status: newBulkStatus as any });
            }
            logActivity(user!.username, `Bulk updated status to ${newBulkStatus} for ${ids.length} ${bulkStatusType}`);
            showToast(t('housing.bulkStatusUpdated', { count: ids.length }), 'success');
            setIsBulkStatusModalOpen(false);
            if (bulkStatusType === 'buildings') setSelectedBuildingIds([]);
            else setSelectedRoomIds([]);
            fetchData();
        } catch (err) { showToast(t('errors.generic'), 'error'); } finally { setIsSubmitting(false); }
    };

    const handleSingleDelete = async (type: 'buildings' | 'floors' | 'rooms', id: number, name: string) => {
        if (!perms.canDeleteHousing) return;
        if (!window.confirm(t('users.deleteConfirm', { name }))) return;
        setIsSubmitting(true);
        try {
            const api = type === 'buildings' ? buildingApi : type === 'floors' ? floorApi : roomApi;
            await api.delete(id);
            logActivity(user!.username, `Deleted ${type.slice(0, -1)}: ${name}`);
            showToast(t('statuses.resolved'), 'success');
            fetchData();
        } catch (err) { showToast(t('errors.generic'), 'error'); } finally { setIsSubmitting(false); }
    };

    const handleRoomTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const typeName = e.target.value;
        const config = roomTypes.find(rt => rt.name === typeName);
        setRoomFormData(p => ({
            ...p,
            roomType: typeName,
            capacity: config ? String(config.defaultCapacity) : p.capacity
        }));
    };

    const formInputClass = "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-hotel-gold outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white transition-all shadow-inner placeholder-slate-400";
    const labelClass = "block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-widest";

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-6 uppercase tracking-tight">{t('layout.housing')}</h1>
            
            <div className="mb-4 border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex space-x-8 rtl:space-x-reverse">
                    {(['buildings', 'floors', 'rooms'] as const).map(tab => (
                        <button key={tab} onClick={() => { setActiveTab(tab); setSelectedBuildingIds([]); setSelectedFloorIds([]); setSelectedRoomIds([]); }}
                            className={`${tab === activeTab ? 'border-hotel-gold text-hotel-navy dark:text-hotel-gold' : 'border-transparent text-gray-400 hover:text-gray-700'} whitespace-nowrap pb-3 pt-4 px-2 border-b-4 font-black text-sm uppercase tracking-widest transition-all`}>
                            {t(`housing.tabs.${tab}`)}
                        </button>
                    ))}
                </nav>
            </div>

            {loading ? (
                <div className="p-20 text-center flex flex-col items-center">
                    <div className="w-10 h-10 border-4 border-hotel-navy border-t-hotel-gold rounded-full animate-spin mb-4"></div>
                    <p className="text-hotel-muted font-bold text-xs uppercase tracking-widest">{t('loading')}</p>
                </div>
            ) : (
                <div className="animate-fade-in-up">
                    {activeTab === 'buildings' && (
                        <BuildingsView 
                            buildings={buildings} 
                            onAdd={() => { setEditingBuilding(null); setBuildingFormData({ name: '', location: '', capacity: '100', status: 'active' }); setIsBuildingModalOpen(true); }} 
                            onEdit={(b:any) => { setEditingBuilding(b); setBuildingFormData({ ...b, capacity: String(b.capacity) }); setIsBuildingModalOpen(true); }} 
                            onDelete={(id:any, name:any) => handleSingleDelete('buildings', id, name)} 
                            perms={perms} t={t} onSort={handleSort} renderSortIcon={renderSortIcon} 
                            selectedIds={selectedBuildingIds} setSelectedIds={setSelectedBuildingIds} onBulkDelete={() => handleBulkDelete('buildings')} 
                            onBulkStatus={() => { setBulkStatusType('buildings'); setNewBulkStatus('active'); setIsBulkStatusModalOpen(true); }}
                        />
                    )}
                    {activeTab === 'floors' && (
                        <FloorsView 
                            buildings={buildings} floors={floors} 
                            onAdd={() => { setEditingFloor(null); setFloorFormData({ floorNumber: '', description: '', buildingId: buildings[0]?.id.toString() || '' }); setIsFloorModalOpen(true); }} 
                            onEdit={(f:any) => { setEditingFloor(f); setFloorFormData({ ...f, buildingId: String(f.buildingId) }); setIsFloorModalOpen(true); }} 
                            onDelete={(id:any, name:any) => handleSingleDelete('floors', id, name)} 
                            perms={perms} t={t} onSort={handleSort} renderSortIcon={renderSortIcon} 
                            selectedIds={selectedFloorIds} setSelectedIds={setSelectedFloorIds} onBulkDelete={() => handleBulkDelete('floors')} 
                        />
                    )}
                    {activeTab === 'rooms' && (
                        <RoomsView 
                            buildings={buildings} floors={floors} rooms={sortedRooms} 
                            onAdd={() => { setEditingRoom(null); setRoomFormData({ floorId: floors[0]?.id.toString() || '', roomNumber: '', roomType: roomTypes[0]?.name || '', capacity: roomTypes[0]?.defaultCapacity.toString() || '2' }); setIsRoomModalOpen(true); }} 
                            onEdit={(r:any) => { setEditingRoom(r); setRoomFormData({ floorId: String(r.floorId), roomNumber: r.roomNumber, roomType: r.roomType || '', capacity: String(r.capacity) }); setIsRoomModalOpen(true); }} 
                            onDelete={(id:any, name:any) => handleSingleDelete('rooms', id, name)} 
                            perms={perms} t={t} onSort={handleSort} renderSortIcon={renderSortIcon} 
                            selectedIds={selectedRoomIds} setSelectedIds={setSelectedRoomIds} onBulkDelete={() => handleBulkDelete('rooms')} 
                            onBulkStatus={() => { setBulkStatusType('rooms'); setNewBulkStatus('available'); setIsBulkStatusModalOpen(true); }}
                        />
                    )}
                </div>
            )}
            
            {/* Modal for Room */}
            {isRoomModalOpen && perms.canManageHousing && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 w-full max-w-md animate-fade-in-up">
                        <h2 className="text-xl font-black mb-6 dark:text-white uppercase tracking-widest">{editingRoom ? t('housing.editRoom') : t('housing.addRoom')}</h2>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            setIsSubmitting(true);
                            try {
                                const data = { 
                                    ...roomFormData, 
                                    floorId: parseInt(roomFormData.floorId), 
                                    capacity: parseInt(roomFormData.capacity) 
                                };
                                if (editingRoom) await roomApi.update(editingRoom.id, data);
                                else await roomApi.create({ ...data, currentOccupancy: 0, status: 'available' });
                                setIsRoomModalOpen(false); fetchData();
                                showToast(t('housing.statusUpdated'), 'success');
                            } catch (err) { showToast(t('errors.generic'), 'error'); } finally { setIsSubmitting(false); }
                        }}>
                             <div className="space-y-4">
                                <div>
                                    <label className={labelClass}>{t('housing.selectFloor')}</label>
                                    <select value={roomFormData.floorId} onChange={e => setRoomFormData(p => ({...p, floorId: e.target.value}))} required className={formInputClass}>
                                        <option value="" disabled>-- {t('select')} --</option>
                                        {floors.map(f => {
                                            const b = buildings.find(b => b.id === f.buildingId);
                                            return <option key={f.id} value={f.id}>{b?.name} - {f.floorNumber}</option>
                                        })}
                                    </select>
                                </div>
                                <div><label className={labelClass}>{t('housing.roomNumber')}</label><input type="text" value={roomFormData.roomNumber} onChange={e => setRoomFormData(p => ({...p, roomNumber: e.target.value}))} required className={formInputClass} placeholder="e.g. 101" /></div>
                                <div>
                                    <label className={labelClass}>{t('housing.roomType')}</label>
                                    <select value={roomFormData.roomType} onChange={handleRoomTypeChange} required className={formInputClass}>
                                        <option value="" disabled>-- {t('select')} --</option>
                                        {roomTypes.map(rt => <option key={rt.name} value={rt.name}>{rt.name}</option>)}
                                    </select>
                                </div>
                                <div><label className={labelClass}>{t('housing.capacity')} (Beds)</label><input type="number" min="1" value={roomFormData.capacity} onChange={e => setRoomFormData(p => ({...p, capacity: e.target.value}))} required className={formInputClass}/></div>
                             </div>
                             <div className="flex justify-end gap-3 mt-8 pt-4 border-t dark:border-slate-700">
                                <button type="button" onClick={() => setIsRoomModalOpen(false)} className="px-6 py-2 text-slate-400 font-black uppercase text-[10px] tracking-widest">{t('cancel')}</button>
                                <button type="submit" disabled={isSubmitting} className="px-10 py-2.5 bg-hotel-navy text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:brightness-110 disabled:opacity-50 transition-all">{isSubmitting ? t('saving') : t('save')}</button>
                             </div>
                        </form>
                    </div>
                </div>
            )}

            {isBuildingModalOpen && perms.canManageHousing && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 w-full max-w-md animate-fade-in-up">
                        <h2 className="text-xl font-black mb-6 dark:text-white uppercase tracking-widest">{editingBuilding ? t('housing.editBuilding') : t('housing.addBuilding')}</h2>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            setIsSubmitting(true);
                            try {
                                if (editingBuilding) await buildingApi.update(editingBuilding.id, { ...buildingFormData, capacity: parseInt(buildingFormData.capacity) });
                                else await buildingApi.create({ ...buildingFormData, capacity: parseInt(buildingFormData.capacity) });
                                setIsBuildingModalOpen(false); fetchData();
                                showToast(editingBuilding ? t('housing.buildingUpdated') : t('housing.buildingAdded'), 'success');
                            } catch (err) { showToast(t('errors.generic'), 'error'); } finally { setIsSubmitting(false); }
                        }}>
                             <div className="space-y-4">
                                <div><label className={labelClass}>{t('housing.buildingName')}</label><input type="text" value={buildingFormData.name} onChange={e => setBuildingFormData(p => ({...p, name: e.target.value}))} required className={formInputClass} placeholder="e.g. Block A" /></div>
                                <div><label className={labelClass}>{t('housing.location')}</label><input type="text" value={buildingFormData.location} onChange={e => setBuildingFormData(p => ({...p, location: e.target.value}))} required className={formInputClass} placeholder="e.g. North Side" /></div>
                                <div><label className={labelClass}>{t('housing.capacity')}</label><input type="number" value={buildingFormData.capacity} onChange={e => setBuildingFormData(p => ({...p, capacity: e.target.value}))} required className={formInputClass}/></div>
                                <div>
                                    <label className={labelClass}>{t('housing.buildingStatus')}</label>
                                    <select value={buildingFormData.status} onChange={e => setBuildingFormData(p => ({...p, status: e.target.value as any}))} className={formInputClass}>
                                        <option value="active">{t('statuses.active')}</option>
                                        <option value="inactive">{t('statuses.inactive')}</option>
                                    </select>
                                </div>
                             </div>
                             <div className="flex justify-end gap-3 mt-8 pt-4 border-t dark:border-slate-700">
                                <button type="button" onClick={() => setIsBuildingModalOpen(false)} className="px-6 py-2 text-slate-400 font-black uppercase text-[10px] tracking-widest">{t('cancel')}</button>
                                <button type="submit" disabled={isSubmitting} className="px-10 py-2.5 bg-hotel-navy text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:brightness-110 disabled:opacity-50 transition-all">{isSubmitting ? t('saving') : t('save')}</button>
                             </div>
                        </form>
                    </div>
                </div>
            )}

            {isFloorModalOpen && perms.canManageHousing && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 w-full max-w-md animate-fade-in-up">
                        <h2 className="text-xl font-black mb-6 dark:text-white uppercase tracking-widest">{editingFloor ? t('housing.editFloor') : t('housing.addFloor')}</h2>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            setIsSubmitting(true);
                            try {
                                const data = { ...floorFormData, buildingId: parseInt(floorFormData.buildingId) };
                                if (editingFloor) await floorApi.update(editingFloor.id, data);
                                else await floorApi.create(data);
                                setIsFloorModalOpen(false); fetchData();
                                showToast(editingFloor ? t('housing.floorUpdated') : t('housing.floorAdded'), 'success');
                            } catch (err) { showToast(t('errors.generic'), 'error'); } finally { setIsSubmitting(false); }
                        }}>
                             <div className="space-y-4">
                                <div>
                                    <label className={labelClass}>{t('housing.selectBuilding')}</label>
                                    <select value={floorFormData.buildingId} onChange={e => setFloorFormData(p => ({...p, buildingId: e.target.value}))} required className={formInputClass}>
                                        <option value="" disabled>-- {t('select')} --</option>
                                        {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                                <div><label className={labelClass}>{t('housing.floorNumber')}</label><input type="text" value={floorFormData.floorNumber} onChange={e => setFloorFormData(p => ({...p, floorNumber: e.target.value}))} required className={formInputClass} placeholder="e.g. 1st Floor" /></div>
                                <div><label className={labelClass}>{t('housing.description')}</label><input type="text" value={floorFormData.description} onChange={e => setFloorFormData(p => ({...p, description: e.target.value}))} className={formInputClass} placeholder="Additional info..." /></div>
                             </div>
                             <div className="flex justify-end gap-3 mt-8 pt-4 border-t dark:border-slate-700">
                                <button type="button" onClick={() => setIsFloorModalOpen(false)} className="px-6 py-2 text-slate-400 font-black uppercase text-[10px] tracking-widest">{t('cancel')}</button>
                                <button type="submit" disabled={isSubmitting} className="px-10 py-2.5 bg-hotel-navy text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:brightness-110 disabled:opacity-50 transition-all">{isSubmitting ? t('saving') : t('save')}</button>
                             </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const BuildingsView = ({ buildings, onAdd, onEdit, onDelete, perms, t, onSort, renderSortIcon, selectedIds, setSelectedIds, onBulkDelete, onBulkStatus }: any) => {
    const toggleSelect = (id: number) => setSelectedIds((prev: any) => prev.includes(id) ? prev.filter((x: any) => x !== id) : [...prev, id]);
    const toggleAll = () => setSelectedIds(selectedIds.length === buildings.length && buildings.length > 0 ? [] : buildings.map((b: any) => b.id));
    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
                <div className="flex items-center gap-3">
                    <h2 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest text-xs">{t('housing.tabs.buildings')}</h2>
                    {selectedIds.length > 0 && perms.canDeleteHousing && (
                        <div className="flex items-center gap-2 animate-fade-in-up">
                            <button onClick={onBulkDelete} className="px-3 py-1 bg-rose-600 text-white rounded text-[10px] font-black uppercase shadow hover:bg-rose-700 transition-colors">
                                <i className="fas fa-trash me-1"></i> {t('bulkDelete')} ({selectedIds.length})
                            </button>
                            <button onClick={onBulkStatus} className="px-3 py-1 bg-amber-600 text-white rounded text-[10px] font-black uppercase shadow hover:bg-amber-700 transition-colors">
                                <i className="fas fa-sync-alt me-1"></i> {t('housing.changeStatus')}
                            </button>
                        </div>
                    )}
                </div>
                {perms.canManageHousing && <button onClick={onAdd} className="px-4 py-2 bg-primary-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg tracking-widest"><i className="fas fa-plus me-2"></i>{t('housing.addBuilding')}</button>}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
                    <thead className="text-[10px] text-slate-500 font-black bg-slate-50 dark:bg-slate-700 uppercase tracking-wider">
                        <tr>
                            {perms.canManageHousing && <th className="px-6 py-4 w-10"><input type="checkbox" checked={selectedIds.length === buildings.length && buildings.length > 0} onChange={toggleAll} className="w-4 h-4 rounded border-slate-300" /></th>}
                            <th className="px-6 py-4 cursor-pointer" onClick={() => onSort('name')}>{t('housing.buildingName')} {renderSortIcon('name')}</th>
                            <th className="px-6 py-4 cursor-pointer" onClick={() => onSort('location')}>{t('housing.location')} {renderSortIcon('location')}</th>
                            <th className="px-6 py-4 cursor-pointer" onClick={() => onSort('capacity')}>{t('housing.capacity')} {renderSortIcon('capacity')}</th>
                            <th className="px-6 py-4 cursor-pointer" onClick={() => onSort('status')}>{t('housing.buildingStatus')} {renderSortIcon('status')}</th>
                            {perms.canManageHousing && <th className="px-6 py-4 text-center">{t('actions')}</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-700">
                        {buildings.map((b: Building) => (
                            <tr key={b.id} className={`bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${selectedIds.includes(b.id) ? 'bg-primary-50/50' : ''}`}>
                                {perms.canManageHousing && <td className="px-6 py-4"><input type="checkbox" checked={selectedIds.includes(b.id)} onChange={() => toggleSelect(b.id)} className="w-4 h-4 rounded border-slate-300" /></td>}
                                <td className="px-6 py-4 font-black text-slate-900 dark:text-white uppercase tracking-tight">{b.name}</td>
                                <td className="px-6 py-4 text-xs font-bold text-slate-500">{b.location}</td>
                                <td className="px-6 py-4 font-mono font-black">{b.capacity}</td>
                                <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${b.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{t(`statuses.${b.status}`)}</span></td>
                                {perms.canManageHousing && (
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => onEdit(b)} className="text-primary-600 dark:text-primary-400 p-2 rounded-lg hover:bg-primary-50 dark:hover:bg-slate-700 transition-all"><i className="fas fa-edit"></i></button>
                                            {perms.canDeleteHousing && <button onClick={() => onDelete(b.id, b.name)} className="text-rose-600 dark:text-rose-400 p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-slate-700 transition-all"><i className="fas fa-trash-alt"></i></button>}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const FloorsView = ({ buildings, floors, onAdd, onEdit, onDelete, perms, t, onSort, renderSortIcon, selectedIds, setSelectedIds, onBulkDelete }: any) => {
    const toggleSelect = (id: number) => setSelectedIds((prev: any) => prev.includes(id) ? prev.filter((x: any) => x !== id) : [...prev, id]);
    const toggleAll = () => setSelectedIds(selectedIds.length === floors.length && floors.length > 0 ? [] : floors.map((f: any) => f.id));
    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
                <div className="flex items-center gap-3">
                    <h2 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest text-xs">{t('housing.tabs.floors')}</h2>
                    {selectedIds.length > 0 && perms.canDeleteHousing && (
                        <button onClick={onBulkDelete} className="px-3 py-1 bg-rose-600 text-white rounded text-[10px] font-black uppercase shadow hover:bg-rose-700 transition-colors animate-fade-in-up">
                            <i className="fas fa-trash me-1"></i> {t('bulkDelete')} ({selectedIds.length})
                        </button>
                    )}
                </div>
                {perms.canManageHousing && <button onClick={onAdd} className="px-4 py-2 bg-primary-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg"><i className="fas fa-plus me-2"></i>{t('housing.addFloor')}</button>}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
                    <thead className="text-[10px] text-slate-500 font-black bg-slate-50 dark:bg-slate-700 uppercase tracking-wider">
                        <tr>
                            {perms.canManageHousing && <th className="px-6 py-4 w-10"><input type="checkbox" checked={selectedIds.length === floors.length && floors.length > 0} onChange={toggleAll} className="w-4 h-4 rounded border-slate-300" /></th>}
                            <th className="px-6 py-4">{t('housing.building')}</th>
                            <th className="px-6 py-4 cursor-pointer" onClick={() => onSort('floorNumber')}>{t('housing.floorNumber')} {renderSortIcon('floorNumber')}</th>
                            <th className="px-6 py-4">{t('housing.description')}</th>
                            {perms.canManageHousing && <th className="px-6 py-4 text-center">{t('actions')}</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-700">
                        {floors.map((f: Floor) => {
                            const b = buildings.find((b: Building) => b.id === f.buildingId);
                            return (
                                <tr key={f.id} className={`bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${selectedIds.includes(f.id) ? 'bg-primary-50/50' : ''}`}>
                                    {perms.canManageHousing && <td className="px-6 py-4"><input type="checkbox" checked={selectedIds.includes(f.id)} onChange={() => toggleSelect(f.id)} className="w-4 h-4 rounded border-slate-300" /></td>}
                                    <td className="px-6 py-4 font-black text-hotel-navy dark:text-hotel-gold uppercase text-xs">{b?.name || t('unknown')}</td>
                                    <td className="px-6 py-4 font-mono font-bold">{f.floorNumber}</td>
                                    <td className="px-6 py-4 text-xs font-medium text-slate-400">{f.description}</td>
                                    {perms.canManageHousing && (
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => onEdit(f)} className="text-primary-600 dark:text-primary-400 p-2 rounded-lg hover:bg-primary-50 dark:hover:bg-slate-700 transition-all"><i className="fas fa-edit"></i></button>
                                                {perms.canDeleteHousing && <button onClick={() => onDelete(f.id, f.floorNumber)} className="text-rose-600 dark:text-rose-400 p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-slate-700 transition-all"><i className="fas fa-trash-alt"></i></button>}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const RoomsView = ({ buildings, floors, rooms, onAdd, onEdit, onDelete, perms, t, onSort, renderSortIcon, selectedIds, setSelectedIds, onBulkDelete, onBulkStatus }: any) => {
    const toggleSelect = (id: number) => setSelectedIds((prev: any) => prev.includes(id) ? prev.filter((x: any) => x !== id) : [...prev, id]);
    const toggleAll = () => setSelectedIds(selectedIds.length === rooms.length && rooms.length > 0 ? [] : rooms.map((r: any) => r.id));
    
    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
                <div className="flex items-center gap-3">
                    <h2 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest text-xs">{t('housing.tabs.rooms')}</h2>
                    {selectedIds.length > 0 && perms.canDeleteHousing && (
                        <div className="flex items-center gap-2 animate-fade-in-up">
                            <button onClick={onBulkDelete} className="px-3 py-1 bg-rose-600 text-white rounded text-[10px] font-black uppercase shadow hover:bg-rose-700 transition-colors">
                                <i className="fas fa-trash me-1"></i> {t('bulkDelete')} ({selectedIds.length})
                            </button>
                            <button onClick={onBulkStatus} className="px-3 py-1 bg-amber-600 text-white rounded text-[10px] font-black uppercase shadow hover:bg-amber-700 transition-colors">
                                <i className="fas fa-sync-alt me-1"></i> {t('housing.changeStatus')}
                            </button>
                        </div>
                    )}
                </div>
                {perms.canManageHousing && <button onClick={onAdd} className="px-4 py-2 bg-primary-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg tracking-widest"><i className="fas fa-plus me-2"></i>{t('housing.addRoom')}</button>}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
                    <thead className="text-[10px] text-slate-500 font-black bg-slate-50 dark:bg-slate-700 uppercase tracking-wider">
                        <tr>
                            {perms.canManageHousing && <th className="px-6 py-4 w-10"><input type="checkbox" checked={selectedIds.length === rooms.length && rooms.length > 0} onChange={toggleAll} className="w-4 h-4 rounded border-slate-300" /></th>}
                            <th className="px-6 py-4">{t('housing.building')} / {t('housing.tabs.floors')}</th>
                            <th className="px-6 py-4 cursor-pointer" onClick={() => onSort('roomNumber')}>{t('housing.roomNumber')} {renderSortIcon('roomNumber')}</th>
                            <th className="px-6 py-4 cursor-pointer" onClick={() => onSort('roomType')}>{t('housing.roomType')} {renderSortIcon('roomType')}</th>
                            <th className="px-6 py-4 text-center">{t('housing.occupancy')}</th>
                            <th className="px-6 py-4">{t('maintenance.status')}</th>
                            {perms.canManageHousing && <th className="px-6 py-4 text-center">{t('actions')}</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-700">
                        {rooms.map((r: Room) => {
                            const f = floors.find((f: Floor) => f.id === r.floorId);
                            const b = buildings.find((b: Building) => b.id === f?.buildingId);
                            const occPerc = (r.currentOccupancy / r.capacity) * 100;
                            
                            return (
                                <tr key={r.id} className={`bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${selectedIds.includes(r.id) ? 'bg-primary-50/50' : ''}`}>
                                    {perms.canManageHousing && <td className="px-6 py-4"><input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggleSelect(r.id)} className="w-4 h-4 rounded border-slate-300" /></td>}
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-black text-slate-900 dark:text-white uppercase text-xs">{b?.name || t('unknown')}</span>
                                            <span className="text-[9px] uppercase text-slate-400 font-black tracking-widest">{t('housing.tabs.floors')}: {f?.floorNumber || '?'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono font-black text-primary-600 dark:text-primary-400">{r.roomNumber}</td>
                                    <td className="px-6 py-4"><span className="text-[9px] font-black uppercase text-hotel-gold bg-hotel-navy/5 dark:bg-hotel-gold/10 px-2.5 py-1 rounded-lg border border-hotel-gold/10">{r.roomType || 'Standard'}</span></td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1.5 items-center min-w-[120px]">
                                            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 shadow-inner">
                                                <div className={`h-2 rounded-full transition-all duration-500 ${occPerc >= 100 ? 'bg-rose-500' : occPerc > 0 ? 'bg-hotel-gold' : 'bg-emerald-500'}`} style={{ width: `${occPerc}%` }}></div>
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{r.currentOccupancy} / {r.capacity} Beds</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border ${
                                            r.status === 'available' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                            r.status === 'occupied' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                                            r.status === 'maintenance' ? 'bg-rose-50 text-rose-700 border-rose-100' : 
                                            'bg-amber-50 text-amber-700 border-amber-100'
                                        }`}>
                                            {t(`statuses.${r.status}`)}
                                        </span>
                                    </td>
                                    {perms.canManageHousing && (
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => onEdit(r)} className="p-2 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-600 hover:text-white transition-all shadow-sm"><i className="fas fa-edit text-[12px]"></i></button>
                                                {perms.canDeleteHousing && <button onClick={() => onDelete(r.id, r.roomNumber)} className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm"><i className="fas fa-trash-alt text-[12px]"></i></button>}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BuildingsAndRoomsPage;