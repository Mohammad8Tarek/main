
import React, { useState, useEffect, useMemo } from 'react';
import { reportsApi, buildingApi, employeeHostingApi, housingHistoryApi, employeeApi, roomApi } from '../services/apiService';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { useProperty } from '../context/PropertyContext';
import { exportToPdf, exportToExcel } from '../services/exportService';
import { Building, DEPARTMENTS } from '../types';

type ReportType = 'occupancy' | 'employee' | 'maintenance' | 'hosting' | 'history';

const ReportsPage: React.FC = () => {
    const { t, language } = useLanguage();
    const { showToast } = useToast();
    const { settings: appSettings } = useSettings();
    const { currentProperty } = useProperty();
    
    const [reportType, setReportType] = useState<ReportType>('occupancy');
    const [rawData, setRawData] = useState<any[]>([]);
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Comprehensive Filters
    const [filters, setFilters] = useState({
        building: 'all',
        department: 'all',
        gender: 'all',
        status: 'all',
        nationality: 'all'
    });

    const loadData = async () => {
        if (!currentProperty) return;
        setLoading(true);
        try {
            const [bData, eData, rData] = await Promise.all([
                buildingApi.getAll(false), 
                employeeApi.getAll(false),
                roomApi.getAll(false)
            ]);

            setBuildings(bData);

            let result: any[] = [];
            if (reportType === 'occupancy') {
                result = await reportsApi.getOccupancyReport(currentProperty.id);
            } else if (reportType === 'employee') {
                result = await reportsApi.getEmployeeHousingReport(currentProperty.id);
            } else if (reportType === 'maintenance') {
                result = await reportsApi.getMaintenanceStatusReport(currentProperty.id);
            } else if (reportType === 'hosting') {
                const hostData = await employeeHostingApi.getAll(false);
                const empMap = new Map(eData.map(e => [e.id, e]));
                result = hostData.map(h => {
                    const emp = empMap.get(h.employeeId);
                    return {
                        'Host Name': `${emp?.firstName} ${emp?.lastName}`,
                        'Clock ID': emp?.employeeId || '—',
                        'Gender': emp?.gender?.toUpperCase() || '—',
                        'Guests': h.guestsCount,
                        'Type': h.hostingType,
                        'From': new Date(h.expectedFrom).toLocaleDateString(),
                        'To': new Date(h.expectedTo).toLocaleDateString(),
                        'Status': h.status
                    };
                });
            } else if (reportType === 'history') {
                const hist = await housingHistoryApi.getAll(false);
                const empMap = new Map(eData.map(e => [e.id, e]));
                const rmMap = new Map(rData.map(r => [r.id, r]));
                result = hist.map(h => {
                    const emp = empMap.get(h.employeeId);
                    const rm = rmMap.get(h.roomId);
                    return {
                        'Timestamp': new Date(h.timestamp).toLocaleString(),
                        'Clock ID': emp?.employeeId || '—',
                        'Target Name': `${emp?.firstName} ${emp?.lastName}`,
                        'Room': rm?.roomNumber || '—',
                        'Event Type': h.eventType,
                        'Author': h.createdBy
                    };
                });
            }
            setRawData(result);
        } catch (e) { showToast(t('errors.fetchFailed'), 'error'); } 
        finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, [reportType, currentProperty?.id]);

    const filteredData = useMemo(() => {
        let data = rawData;
        
        if (filters.building !== 'all') data = data.filter(i => i.Building === filters.building || i.buildingName === filters.building);
        if (filters.department !== 'all') data = data.filter(i => i.Department === filters.department || i.Dept === filters.department);
        if (filters.gender !== 'all') data = data.filter(i => i.Gender === filters.gender);
        if (filters.nationality !== 'all') data = data.filter(i => i.Nationality === filters.nationality);
        if (filters.status !== 'all') data = data.filter(i => String(i.Status).toLowerCase() === filters.status.toLowerCase());
        
        if (searchTerm) {
            const low = searchTerm.toLowerCase();
            data = data.filter(i => Object.values(i).some(v => String(v).toLowerCase().includes(low)));
        }

        return data;
    }, [rawData, filters, searchTerm]);

    // Data Analytics Summaries
    const aggregates = useMemo(() => {
        if (reportType === 'occupancy') {
            const totalCapacity = filteredData.reduce((sum, r) => sum + (r.Capacity || 0), 0);
            const totalOccupants = filteredData.reduce((sum, r) => sum + (r.Occupants || 0), 0);
            const emptyRooms = filteredData.filter(r => r.Empty === 'YES').length;
            const fullRooms = filteredData.filter(r => r.Full === 'YES').length;
            return { totalCapacity, totalOccupants, emptyRooms, fullRooms };
        }
        if (reportType === 'employee') {
            const males = filteredData.filter(e => e.Gender === 'MALE').length;
            const females = filteredData.filter(e => e.Gender === 'FEMALE').length;
            return { totalResidents: filteredData.length, males, females };
        }
        return null;
    }, [filteredData, reportType]);

    const handleExport = (format: 'pdf' | 'excel') => {
        if (filteredData.length === 0 || !currentProperty) return;
        
        const title = `${currentProperty.displayName || currentProperty.name} - ${reportType.toUpperCase()} LEDGER`;
        const headers = Object.keys(filteredData[0]).map(h => h.toUpperCase());
        const body = filteredData.map(row => Object.values(row).map(v => String(v || '—')));

        const exportSettings = {
            ...appSettings,
            systemName: currentProperty.displayName || appSettings.systemName,
            systemLogo: currentProperty.logo || appSettings.systemLogo,
            pdfOrientation: 'l' // Landscape for exact column display
        };

        if (format === 'pdf') {
            exportToPdf({ headers, data: body, title, filename: `${reportType}_audit.pdf`, settings: exportSettings as any, language });
        } else {
            exportToExcel({ headers, data: body, filename: `${reportType}_ledger.xlsx`, settings: exportSettings });
        }
    };

    const inputClass = "w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-hotel-gold outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white transition-all shadow-sm";
    const labelClass = "block text-[9px] font-black text-slate-400 uppercase mb-1.5 tracking-widest";

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-hotel-navy dark:text-white tracking-tighter uppercase">Analytical Reports</h1>
                    <p className="text-hotel-muted dark:text-slate-400 text-xs mt-1 font-bold uppercase tracking-widest opacity-60">
                        Operational Scope: <span className="text-hotel-gold">{currentProperty?.displayName || currentProperty?.name}</span>
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => handleExport('excel')} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"><i className="fas fa-file-excel"></i> EXCEL</button>
                    <button onClick={() => handleExport('pdf')} className="bg-rose-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"><i className="fas fa-file-pdf"></i> PDF (LANDSCAPE)</button>
                </div>
            </div>

            {/* Report Type Selector */}
            <div className="flex flex-wrap gap-2">
                {(['occupancy', 'employee', 'maintenance', 'hosting', 'history'] as const).map(type => (
                    <button key={type} onClick={() => { setReportType(type); setFilters({ building: 'all', department: 'all', gender: 'all', status: 'all', nationality: 'all' }); }} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${reportType === type ? 'bg-hotel-navy text-white shadow-lg' : 'text-slate-500 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700'}`}>
                        {type}
                    </button>
                ))}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col min-h-[600px]">
                {/* Advanced Filters */}
                <div className="p-6 bg-slate-50/50 border-b dark:border-slate-700">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {(reportType === 'occupancy' || reportType === 'employee') && (
                            <div>
                                <label className={labelClass}>Building Focus</label>
                                <select value={filters.building} onChange={e => setFilters(p => ({...p, building: e.target.value}))} className={inputClass}>
                                    <option value="all">GLOBAL BLOCKS</option>
                                    {buildings.map(b => <option key={b.id} value={b.name}>{b.name.toUpperCase()}</option>)}
                                </select>
                            </div>
                        )}
                        {(reportType === 'employee') && (
                            <>
                                <div>
                                    <label className={labelClass}>Dept Scope</label>
                                    <select value={filters.department} onChange={e => setFilters(p => ({...p, department: e.target.value}))} className={inputClass}>
                                        <option value="all">ALL DEPTS</option>
                                        {DEPARTMENTS.map(d => <option key={d} value={d.toUpperCase()}>{t(`departments.${d}`).toUpperCase()}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Gender</label>
                                    <select value={filters.gender} onChange={e => setFilters(p => ({...p, gender: e.target.value}))} className={inputClass}>
                                        <option value="all">ANY</option>
                                        <option value="MALE">MALE</option>
                                        <option value="FEMALE">FEMALE</option>
                                    </select>
                                </div>
                            </>
                        )}
                        <div>
                            <label className={labelClass}>Record Search (ID / Name)</label>
                            <div className="relative">
                                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                                <input placeholder="Deep scan..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={inputClass + " pl-10"} />
                            </div>
                        </div>
                        {reportType === 'occupancy' && (
                            <div>
                                <label className={labelClass}>Unit Status</label>
                                <select value={filters.status} onChange={e => setFilters(p => ({...p, status: e.target.value}))} className={inputClass}>
                                    <option value="all">ANY STATUS</option>
                                    <option value="AVAILABLE">AVAILABLE</option>
                                    <option value="OCCUPIED">OCCUPIED</option>
                                    <option value="MAINTENANCE">MAINTENANCE</option>
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* Analytical Table */}
                <div className="flex-1 overflow-x-auto custom-scrollbar">
                    {loading ? (
                        <div className="p-32 text-center flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-hotel-navy border-t-hotel-gold rounded-full animate-spin"></div>
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Compiling System Ledger...</p>
                        </div>
                    ) : (
                        <table className="w-full text-left rtl:text-right border-collapse min-w-[1400px]">
                            <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b dark:border-slate-700">
                                <tr>
                                    {filteredData.length > 0 && Object.keys(filteredData[0]).map(key => (
                                        <th key={key} className="px-6 py-5 whitespace-nowrap">{key}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {filteredData.map((row, i) => (
                                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                        {Object.values(row).map((val, j) => (
                                            <td key={j} className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-slate-300">
                                                {String(val || '—')}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Analytical Summary Footer */}
                {!loading && filteredData.length > 0 && (
                    <div className="p-8 bg-hotel-navy text-white border-t border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 shadow-2xl">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-hotel-gold flex items-center justify-center text-hotel-navy text-2xl shadow-2xl">
                                <i className="fas fa-chart-pie"></i>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50 mb-1">Global Summary</p>
                                <p className="text-3xl font-black">{filteredData.length} <span className="text-xs font-bold opacity-60">Total Ledger Entries</span></p>
                            </div>
                        </div>
                        
                        {aggregates && reportType === 'occupancy' && (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 border-l border-white/10 pl-8">
                                <div className="text-left">
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Total Bed Capacity</p>
                                    <p className="text-xl font-black text-hotel-gold">{aggregates.totalCapacity}</p>
                                </div>
                                <div className="text-left">
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Active Occupants</p>
                                    <p className="text-xl font-black text-emerald-400">{aggregates.totalOccupants}</p>
                                </div>
                                <div className="text-left">
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Empty Units</p>
                                    <p className="text-xl font-black text-blue-400">{aggregates.emptyRooms}</p>
                                </div>
                                <div className="text-left">
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Units at Capacity</p>
                                    <p className="text-xl font-black text-rose-400">{aggregates.fullRooms}</p>
                                </div>
                            </div>
                        )}

                        {aggregates && reportType === 'employee' && (
                            <div className="grid grid-cols-3 gap-8 border-l border-white/10 pl-8">
                                <div className="text-left">
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Total Residents</p>
                                    <p className="text-xl font-black text-hotel-gold">{aggregates.totalResidents}</p>
                                </div>
                                <div className="text-left">
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Male Distribution</p>
                                    <p className="text-xl font-black text-blue-400">{aggregates.males}</p>
                                </div>
                                <div className="text-left">
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Female Distribution</p>
                                    <p className="text-xl font-black text-pink-400">{aggregates.females}</p>
                                </div>
                            </div>
                        )}

                        <div className="hidden xl:block text-right">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">System Timestamp</p>
                            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">{new Date().toLocaleString()}</p>
                        </div>
                    </div>
                )}

                {!loading && filteredData.length === 0 && (
                    <div className="p-32 text-center text-slate-400 font-black uppercase text-[10px] tracking-widest italic opacity-50">No datasets found matching current filters.</div>
                )}
            </div>
        </div>
    );
};

export default ReportsPage;
