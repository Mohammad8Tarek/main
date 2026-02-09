
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MaintenanceRequest, Room, Building, Floor } from '../types';
import { maintenanceApi, roomApi, buildingApi, floorApi, logActivity } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { exportToPdf, exportToExcel } from '../services/exportService';
import ExportOptionsModal from '../components/ExportOptionsModal';

type StatusFilter = 'all' | MaintenanceRequest['status'];
type SortConfig = {
    key: keyof MaintenanceRequest | null;
    direction: 'ascending' | 'descending';
};

const MAINTENANCE_TEMPLATES = [
    'plumbing_leak',
    'electrical_socket',
    'ac_not_cooling',
    'broken_door_lock',
    'light_bulb_change',
    'carpentry_furniture',
    'pest_control',
    'clogged_drain'
];

const MaintenancePage: React.FC = () => {
    const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [floors, setFloors] = useState<Floor[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user } = useAuth();
    const { language, t } = useLanguage();
    const { showToast } = useToast();
    const canManage = user?.roles?.some(r => ['super_admin', 'admin', 'supervisor', 'maintenance'].includes(r));
    const { settings: appSettings } = useSettings();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRequest, setEditingRequest] = useState<MaintenanceRequest | null>(null);
    
    // Form States
    const [formData, setFormData] = useState({
        roomId: '', 
        problemType: '', 
        description: '', 
        status: 'open' as MaintenanceRequest['status'], 
        priority: 'medium' as MaintenanceRequest['priority'],
        dueDate: ''
    });

    const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
    const [selectedFloorId, setSelectedFloorId] = useState<string>('');

    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'reportedAt', direction: 'descending' });
    const [updatingRequestId, setUpdatingRequestId] = useState<number | null>(null);
    const [isOtherProblem, setIsOtherProblem] = useState(false);

    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isPdfExporting, setIsPdfExporting] = useState(false);
    const [isExcelExporting, setIsExcelExporting] = useState(false);

    const fetchData = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const [requestsData, roomsData, bData, fData] = await Promise.all([ 
                maintenanceApi.getAll(), 
                roomApi.getAll(),
                buildingApi.getAll(),
                floorApi.getAll()
            ]);
            setRequests(requestsData);
            setRooms(roomsData);
            setBuildings(bData);
            setFloors(fData);
        } catch (error) {
            showToast(t('errors.fetchFailed'), 'error');
        } finally { if (showLoading) setLoading(false); }
    }, [t, showToast]);

    useEffect(() => { 
        fetchData(); 
        const handleDataChange = (e: any) => {
            if (!e.detail || e.detail.table === 'MaintenanceRequests' || e.detail.table === 'Rooms') {
                fetchData(false); 
            }
        };
        window.addEventListener('datachanged' as any, handleDataChange);
        return () => window.removeEventListener('datachanged' as any, handleDataChange);
    }, [fetchData]);

    const filteredFloors = useMemo(() => {
        if (!selectedBuildingId) return [];
        return floors.filter(f => f.buildingId === parseInt(selectedBuildingId));
    }, [floors, selectedBuildingId]);

    const filteredRooms = useMemo(() => {
        if (!selectedFloorId) return [];
        return rooms.filter(r => r.floorId === parseInt(selectedFloorId));
    }, [rooms, selectedFloorId]);

    const sortedAndFilteredRequests = useMemo(() => {
        let sortableItems = [...requests];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key as keyof MaintenanceRequest];
                const bValue = b[sortConfig.key as keyof MaintenanceRequest];
                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;
                const aDate = new Date(aValue as string).getTime();
                const bDate = new Date(bValue as string).getTime();
                return sortConfig.direction === 'ascending' ? aDate - bDate : bDate - aDate;
            });
        }
        if (statusFilter === 'all') return sortableItems;
        return sortableItems.filter(r => r.status === statusFilter);
    }, [requests, statusFilter, sortConfig]);
    
    const openAddModal = () => {
        setEditingRequest(null);
        setSelectedBuildingId('');
        setSelectedFloorId('');
        setFormData({ 
            roomId: '', 
            problemType: MAINTENANCE_TEMPLATES[0], 
            description: '', 
            status: 'open', 
            priority: 'medium',
            dueDate: '' 
        });
        setIsOtherProblem(false);
        setIsModalOpen(true);
    };

    const openEditModal = (request: MaintenanceRequest) => {
        setEditingRequest(request);
        const room = rooms.find(r => r.id === request.roomId);
        if (room) {
            const floor = floors.find(f => f.id === room.floorId);
            if (floor) {
                setSelectedBuildingId(String(floor.buildingId));
                setSelectedFloorId(String(floor.id));
            }
        }
        const dueDateForInput = request.dueDate ? request.dueDate.split('T')[0] : '';
        const isTemplate = MAINTENANCE_TEMPLATES.some(temp => t(`maintenance.templates.${temp}`) === request.problemType);
        setIsOtherProblem(!isTemplate);
        setFormData({ ...request, roomId: String(request.roomId), dueDate: dueDateForInput });
        setIsModalOpen(true);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'problemType' && value === 'other') {
            setIsOtherProblem(true);
            setFormData(prev => ({ ...prev, problemType: '' }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const dueDateISO = formData.dueDate ? new Date(formData.dueDate).toISOString() : null;
        let finalProblemType = formData.problemType;
        if (!isOtherProblem) {
            const template = MAINTENANCE_TEMPLATES.find(temp => temp === formData.problemType);
            if (template) finalProblemType = t(`maintenance.templates.${template}`);
        }
        const submissionData = { ...formData, problemType: finalProblemType, roomId: parseInt(formData.roomId, 10), dueDate: dueDateISO };
        try {
            if (editingRequest) {
                await maintenanceApi.update(editingRequest.id, submissionData);
                showToast(t('maintenance.updated'), 'success');
            } else {
                await maintenanceApi.create({ ...submissionData, reportedAt: new Date().toISOString() });
                showToast(t('maintenance.added'), 'success');
            }
            setIsModalOpen(false);
            await fetchData();
        } catch (error) {
            showToast(t('errors.generic'), 'error');
        } finally { setIsSubmitting(false); }
    };

    const handleStatusChange = async (request: MaintenanceRequest, newStatus: MaintenanceRequest['status']) => {
        setUpdatingRequestId(request.id);
        try {
            await maintenanceApi.update(request.id, { status: newStatus });
            showToast(t('maintenance.statusUpdated'), 'success');
            await fetchData(false); 
        } catch (error) { showToast(t('errors.generic'), 'error'); } 
        finally { setUpdatingRequestId(null); }
    };

    const handleDelete = async (request: MaintenanceRequest) => {
        if (!window.confirm(t('maintenance.deleteConfirm'))) return;
        try {
            await maintenanceApi.delete(request.id);
            showToast(t('maintenance.deleted'), 'success');
            await fetchData();
        } catch (error) { showToast(t('errors.generic'), 'error'); }
    };
    
    const getStatusBadge = (status: MaintenanceRequest['status']) => {
        switch (status) {
            case 'open': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
            case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300';
            case 'resolved': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
            default: return 'bg-slate-100 dark:bg-slate-700';
        }
    };

    const getPriorityBadge = (prio: string) => {
        switch (prio) {
            case 'high': return 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20';
            case 'medium': return 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20';
            case 'low': return 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20';
            default: return 'bg-slate-50 text-slate-500';
        }
    };

    const inputClass = "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-hotel-gold outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white transition-all shadow-inner placeholder-slate-400";
    const labelClass = "block text-[9px] font-black uppercase text-slate-500 mb-1.5 tracking-widest";

    return (
        <>
            <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-200 pb-3 dark:border-slate-700">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">{t('maintenance.title')}</h1>
                        <p className="text-hotel-muted dark:text-slate-400 text-xs mt-0.5 font-bold uppercase tracking-widest">Track and resolve unit issues instantly.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsExportModalOpen(true)} className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1.5 dark:bg-slate-800 dark:border-slate-700 dark:text-white transition-all">
                            <i className="fas fa-download text-hotel-gold"></i> {t('export')}
                        </button>
                        {canManage && (
                            <button onClick={openAddModal} className="px-4 py-2 bg-primary-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5">
                                <i className="fas fa-plus"></i> {t('maintenance.newRequest')}
                            </button>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                    <div className="p-4 flex flex-col sm:flex-row justify-between items-center border-b dark:border-slate-700 gap-4 bg-slate-50/50">
                        <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
                            {(['all', 'open', 'in_progress', 'resolved'] as StatusFilter[]).map(status => (
                                <button key={status} onClick={() => setStatusFilter(status)} className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${statusFilter === status ? 'bg-hotel-navy text-white shadow-md' : 'text-slate-400 hover:text-hotel-navy dark:hover:text-white'}`}>
                                    {t(`statuses.${status.replace('_', '')}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
                            <thead className="text-[9px] font-black uppercase text-slate-500 bg-slate-50 dark:bg-slate-700 tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">{t('maintenance.building')}</th>
                                    <th className="px-6 py-4">{t('maintenance.floor')}</th>
                                    <th className="px-6 py-4">{t('maintenance.room')}</th>
                                    <th className="px-6 py-4">{t('maintenance.problem')}</th>
                                    <th className="px-6 py-4">{t('maintenance.priority')}</th>
                                    <th className="px-6 py-4 cursor-pointer" onClick={() => setSortConfig({ key: 'reportedAt', direction: sortConfig.direction === 'ascending' ? 'descending' : 'ascending' })}>
                                        {t('maintenance.reported')} <i className="fas fa-sort ml-1"></i>
                                    </th>
                                    <th className="px-6 py-4">{t('maintenance.status')}</th>
                                    {canManage && <th className="px-6 py-4 text-center">{t('actions')}</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {sortedAndFilteredRequests.map(req => {
                                    const room = rooms.find(r => r.id === req.roomId);
                                    const floor = floors.find(f => f.id === room?.floorId);
                                    const building = buildings.find(b => b.id === floor?.buildingId);

                                    return (
                                        <tr key={req.id} className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="px-6 py-4 text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">{building?.name || '—'}</td>
                                            <td className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400">{floor?.floorNumber || '—'}</td>
                                            <td className="px-6 py-4 font-black text-primary-600">{room?.roomNumber || '—'}</td>
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-slate-900 dark:text-white uppercase text-xs">{req.problemType}</p>
                                                <p className="text-[10px] text-slate-400 truncate max-w-xs">{req.description}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${getPriorityBadge(req.priority)}`}>
                                                    {t(`maintenance.priorities.${req.priority || 'medium'}`)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-[10px] font-mono">{new Date(req.reportedAt).toLocaleString()}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-full ${getStatusBadge(req.status)}`}>
                                                    {t(`statuses.${req.status.replace('_', '')}`)}
                                                </span>
                                            </td>
                                            {canManage && (
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center gap-2">
                                                        {req.status === 'open' && <button onClick={() => handleStatusChange(req, 'in_progress')} className="w-7 h-7 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-600 hover:text-white flex items-center justify-center transition-all"><i className="fas fa-play text-[9px]"></i></button>}
                                                        {req.status === 'in_progress' && <button onClick={() => handleStatusChange(req, 'resolved')} className="w-7 h-7 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-all"><i className="fas fa-check text-[9px]"></i></button>}
                                                        <button onClick={() => openEditModal(req)} className="text-primary-600 hover:bg-primary-50 p-1 rounded-md transition-all"><i className="fas fa-edit text-xs"></i></button>
                                                        <button onClick={() => handleDelete(req)} className="text-rose-600 hover:bg-rose-50 p-1 rounded-md transition-all"><i className="fas fa-trash-alt text-xs"></i></button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
                        <div className="p-6 border-b dark:border-slate-700 bg-hotel-navy text-white flex justify-between items-center">
                            <h2 className="text-xl font-black uppercase tracking-widest">{editingRequest ? t('maintenance.editRequest') : t('maintenance.newRequest')}</h2>
                            <button onClick={() => setIsModalOpen(false)}><i className="fas fa-times"></i></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 md:col-span-1">
                                    <label className={labelClass}>{t('maintenance.building')}</label>
                                    <select value={selectedBuildingId} onChange={e => { setSelectedBuildingId(e.target.value); setSelectedFloorId(''); setFormData(p=>({...p, roomId: ''})) }} required className={inputClass}>
                                        <option value="">-- {t('select')} --</option>
                                        {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className={labelClass}>{t('maintenance.floor')}</label>
                                    <select value={selectedFloorId} onChange={e => { setSelectedFloorId(e.target.value); setFormData(p=>({...p, roomId: ''})) }} disabled={!selectedBuildingId} required className={inputClass}>
                                        <option value="">-- {t('select')} --</option>
                                        {filteredFloors.map(f => <option key={f.id} value={f.id}>{f.floorNumber}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className={labelClass}>{t('maintenance.room')}</label>
                                    <select name="roomId" value={formData.roomId} onChange={handleFormChange} disabled={!selectedFloorId} required className={inputClass}>
                                        <option value="">-- {t('select')} --</option>
                                        {filteredRooms.map(r => <option key={r.id} value={r.id}>{r.roomNumber}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className={labelClass}>{t('maintenance.priority')}</label>
                                    <select name="priority" value={formData.priority} onChange={handleFormChange} required className={inputClass}>
                                        <option value="low">{t('maintenance.priorities.low')}</option>
                                        <option value="medium">{t('maintenance.priorities.medium')}</option>
                                        <option value="high">{t('maintenance.priorities.high')}</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className={labelClass}>{t('maintenance.problemType')}</label>
                                    {!isOtherProblem ? (
                                        <select name="problemType" value={formData.problemType} onChange={handleFormChange} required className={inputClass}>
                                            {MAINTENANCE_TEMPLATES.map(temp => <option key={temp} value={temp}>{t(`maintenance.templates.${temp}`)}</option>)}
                                            <option value="other">--- {t('maintenance.other')} ---</option>
                                        </select>
                                    ) : (
                                        <div className="flex gap-2">
                                            <input type="text" name="problemType" value={formData.problemType} onChange={handleFormChange} required placeholder="Problem type..." className={inputClass} autoFocus />
                                            <button type="button" onClick={() => setIsOtherProblem(false)} className="px-3 bg-slate-200 dark:bg-slate-700 rounded-xl transition-colors hover:bg-slate-300"><i className="fas fa-undo"></i></button>
                                        </div>
                                    )}
                                </div>
                                <div className="col-span-2">
                                    <label className={labelClass}>{t('maintenance.description')}</label>
                                    <textarea name="description" value={formData.description} onChange={handleFormChange} rows={3} className={inputClass} placeholder="Add more details if needed..."></textarea>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-slate-500 font-black uppercase text-[10px] tracking-widest">{t('cancel')}</button>
                                <button type="submit" disabled={isSubmitting} className="px-10 py-2.5 bg-hotel-navy text-white rounded-xl font-black text-xs uppercase shadow-xl hover:brightness-110 active:scale-95 transition-all">
                                    {isSubmitting ? <><i className="fas fa-spinner fa-spin me-2"></i>{t('saving')}</> : <><i className="fas fa-save me-2"></i>{t('save')}</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default MaintenancePage;
