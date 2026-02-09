
import React, { useState, useEffect, useMemo } from 'react';
import { ActivityLog, LogSeverity, LogActionType, ModuleType, AVAILABLE_MODULES } from '../types';
import { activityLogApi } from '../services/apiService';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../context/SettingsContext';
import { usePermissions } from '../hooks/usePermissions';
import { useProperty } from '../context/PropertyContext'; 
import { exportToPdf, exportToExcel } from '../services/exportService';
import ExportOptionsModal from '../components/ExportOptionsModal';
import { Navigate } from 'react-router-dom';

const SEVERITIES: LogSeverity[] = ['info', 'warning', 'critical'];
const ACTION_TYPES: LogActionType[] = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'APPROVE', 'REJECT', 'ERROR'];

const ActivityLogPage: React.FC = () => {
    const { t, language } = useLanguage();
    const { showToast } = useToast();
    const { user } = useAuth();
    const { settings: appSettings } = useSettings();
    const { allProperties, currentProperty } = useProperty();
    const perms = usePermissions();

    if (!perms.canViewActivityLog) return <Navigate to="/" />;

    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

    // Filters
    const [filterSeverity, setFilterSeverity] = useState<LogSeverity | 'all'>('all');
    const [filterModule, setFilterModule] = useState<ModuleType | 'all'>('all');
    const [filterAction, setFilterAction] = useState<LogActionType | 'all'>('all');
    const [userFilter, setUserFilter] = useState<string>('all');
    const [propertyFilter, setPropertyFilter] = useState<string>('all');
    const [crossPropertyOnly, setCrossPropertyOnly] = useState(false);

    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isPdfExporting, setIsPdfExporting] = useState(false);
    const [isExcelExporting, setIsExcelExporting] = useState(false);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await activityLogApi.getAll(perms.isSuperAdmin);
            setLogs(data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        } catch (error) { 
            showToast(t('errors.fetchFailed'), 'error'); 
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [perms.isSuperAdmin, currentProperty?.id]);
    
    const users = useMemo(() => ['all', ...Array.from(new Set(logs.map(log => log.username))).sort()], [logs]);

    const filteredLogs = useMemo(() => logs.filter(log => {
        const userMatch = userFilter === 'all' || log.username === userFilter;
        const propertyMatch = propertyFilter === 'all' || log.propertyId === parseInt(propertyFilter);
        const severityMatch = filterSeverity === 'all' || log.severity === filterSeverity;
        const moduleMatch = filterModule === 'all' || log.module === filterModule;
        const actionMatch = filterAction === 'all' || log.actionType === filterAction;
        const crossMatch = !crossPropertyOnly || (!!log.sourcePropertyId && log.sourcePropertyId !== log.propertyId);
        
        const searchStr = `${log.action} ${log.username} ${log.entityType || ''} ${log.entityId || ''}`.toLowerCase();
        const searchMatch = !searchTerm || searchStr.includes(searchTerm.toLowerCase());

        return userMatch && propertyMatch && severityMatch && moduleMatch && actionMatch && searchMatch && crossMatch;
    }), [logs, searchTerm, userFilter, propertyFilter, filterSeverity, filterModule, filterAction, crossPropertyOnly]);

    const handlePdfExport = async () => {
        setIsPdfExporting(true);
        try {
            const headers = [t('activityLog.timestamp'), t('activityLog.user'), 'Module', 'Action Type', 'Description', 'Severity'];
            if (perms.isSuperAdmin) headers.push('Property');
            
            const data = filteredLogs.map(log => {
                const row = [
                    new Date(log.timestamp).toLocaleString(), 
                    log.username, 
                    log.module?.toUpperCase() || 'SYS',
                    log.actionType || 'INFO',
                    log.action,
                    log.severity?.toUpperCase() || 'INFO'
                ];
                if (perms.isSuperAdmin) {
                    const prop = allProperties.find(p => p.id === log.propertyId);
                    row.push(prop?.displayName || prop?.name || 'Unknown');
                }
                return row;
            });
            
            exportToPdf({ headers, data, title: t('activityLog.reportTitle'), filename: `deep_audit_log.pdf`, settings: appSettings, language });
        } finally { 
            setIsPdfExporting(false); 
            setIsExportModalOpen(false); 
        }
    };

    const getSeverityStyles = (severity: LogSeverity) => {
        switch (severity) {
            case 'critical': return 'bg-rose-50 text-rose-600 border-rose-100';
            case 'warning': return 'bg-amber-50 text-amber-600 border-amber-100';
            default: return 'bg-blue-50 text-blue-600 border-blue-100';
        }
    };

    const getModuleIcon = (module: string) => {
        switch (module) {
            case 'housing': return 'fa-building';
            case 'employees': return 'fa-user-tie';
            case 'maintenance': return 'fa-wrench';
            case 'auth': return 'fa-lock';
            default: return 'fa-circle-info';
        }
    };

    const selectClass = "bg-white border border-slate-200 text-[10px] font-black uppercase rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:ring-1 focus:ring-hotel-gold outline-none transition-all cursor-pointer";

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-200 pb-6 dark:border-slate-700">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Enterprise Audit Log</h1>
                    <p className="text-hotel-muted dark:text-slate-400 text-xs mt-0.5 font-bold uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        {perms.isSuperAdmin ? "Global System Audit - Multi Property Visibility" : "Property Audit Trail - Local Scope"}
                    </p>
                </div>
                <div className="flex gap-2 w-full lg:w-auto">
                    <div className="relative flex-1 lg:w-80">
                        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input 
                            type="text" 
                            placeholder="Deep Search Logs..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-white outline-none focus:ring-1 focus:ring-hotel-gold transition-all shadow-sm" 
                        />
                    </div>
                    <button onClick={() => setIsExportModalOpen(true)} className="px-5 py-2.5 bg-hotel-navy text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-2">
                        <i className="fas fa-download"></i> {t('export')}
                    </button>
                </div>
            </div>

            {/* Advanced Filters */}
            <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black uppercase text-slate-400 px-1">Severity</label>
                    <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value as any)} className={selectClass}>
                        <option value="all">All Severities</option>
                        {SEVERITIES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black uppercase text-slate-400 px-1">Module</label>
                    <select value={filterModule} onChange={e => setFilterModule(e.target.value as any)} className={selectClass}>
                        <option value="all">All Modules</option>
                        <option value="auth">AUTHENTICATION</option>
                        <option value="system">SYSTEM</option>
                        {AVAILABLE_MODULES.map(m => <option key={m.key} value={m.key}>{m.label.toUpperCase()}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black uppercase text-slate-400 px-1">Action Type</label>
                    <select value={filterAction} onChange={e => setFilterAction(e.target.value as any)} className={selectClass}>
                        <option value="all">All Actions</option>
                        {ACTION_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black uppercase text-slate-400 px-1">Triggered By</label>
                    <select value={userFilter} onChange={e => setUserFilter(e.target.value)} className={selectClass}>
                        {users.map(u => <option key={u} value={u}>{u === 'all' ? 'ANY USER' : u.toUpperCase()}</option>)}
                    </select>
                </div>
                {perms.isSuperAdmin && (
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-black uppercase text-slate-400 px-1">Target Property</label>
                        <select value={propertyFilter} onChange={e => setPropertyFilter(e.target.value)} className={selectClass}>
                            <option value="all">EVERYWHERE</option>
                            {allProperties.map(p => <option key={p.id} value={p.id}>{p.displayName?.toUpperCase() || p.name.toUpperCase()}</option>)}
                        </select>
                    </div>
                )}
                <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 transition-colors">
                        <input type="checkbox" checked={crossPropertyOnly} onChange={e => setCrossPropertyOnly(e.target.checked)} className="w-3.5 h-3.5 text-hotel-gold rounded" />
                        <span className="text-[9px] font-black uppercase text-slate-600 dark:text-slate-300">Cross-Property</span>
                    </label>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-700">
                {loading ? (
                    <div className="p-32 text-center flex flex-col items-center">
                        <div className="w-12 h-12 border-4 border-hotel-navy border-t-hotel-gold rounded-full animate-spin mb-4"></div>
                        <p className="text-hotel-muted font-bold text-xs uppercase tracking-widest">{t('loading')}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
                            <thead className="text-[10px] font-black uppercase text-slate-500 bg-slate-50 dark:bg-slate-700/50 tracking-wider">
                                <tr>
                                    <th className="px-6 py-5">Timestamp</th>
                                    <th className="px-6 py-5">Initiator</th>
                                    <th className="px-6 py-5">Context</th>
                                    <th className="px-6 py-5">Action & Description</th>
                                    <th className="px-6 py-5">Severity</th>
                                    <th className="px-6 py-5 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {filteredLogs.slice(0, 100).map(log => {
                                    const prop = allProperties.find(p => p.id === log.propertyId);
                                    const sourceProp = log.sourcePropertyId ? allProperties.find(p => p.id === log.sourcePropertyId) : null;
                                    const isExpanded = expandedLogId === log.id;
                                    const isCrossProperty = !!log.sourcePropertyId && log.sourcePropertyId !== log.propertyId;

                                    return (
                                        <React.Fragment key={log.id}>
                                            <tr 
                                                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                                className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-all cursor-pointer group ${isExpanded ? 'bg-slate-50 dark:bg-slate-700/50' : ''}`}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col leading-tight">
                                                        <span className="text-[11px] font-bold text-slate-900 dark:text-white">{new Date(log.timestamp).toLocaleDateString()}</span>
                                                        <span className="text-[10px] font-mono text-slate-400">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-hotel-navy/5 flex items-center justify-center text-xs font-black uppercase text-hotel-gold border border-hotel-navy/10 group-hover:scale-110 transition-transform">
                                                            {log.username.substring(0, 1)}
                                                        </div>
                                                        <div className="flex flex-col leading-tight">
                                                            <span className="font-black text-[12px] text-slate-900 dark:text-white">{log.username}</span>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{log.userRole || 'Initiator'}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[10px] font-black uppercase text-hotel-gold bg-hotel-navy/5 dark:bg-hotel-gold/10 px-2 py-0.5 rounded w-fit">
                                                            {prop?.code || 'HQ'}
                                                        </span>
                                                        {isCrossProperty && (
                                                            <span className="text-[8px] font-black uppercase text-rose-500 flex items-center gap-1">
                                                                <i className="fas fa-exchange-alt"></i> FROM {sourceProp?.code || 'EXT'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 text-[10px]">
                                                            <i className={`fas ${getModuleIcon(log.module)}`}></i>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-black uppercase text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded tracking-tighter">{log.actionType || 'INFO'}</span>
                                                                <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">{log.module?.replace('_', ' ')}</span>
                                                            </div>
                                                            <span className="text-[12px] text-slate-600 dark:text-slate-400 mt-0.5 font-medium line-clamp-1">{log.action}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border transition-all ${getSeverityStyles(log.severity)}`}>
                                                        {log.severity}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-slate-300 group-hover:text-hotel-gold transition-colors`}></i>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-slate-50/80 dark:bg-slate-900/50 border-x-2 border-hotel-gold/20 animate-fade-in-up">
                                                    <td colSpan={6} className="p-8">
                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                            {/* Detailed Metadata */}
                                                            <div className="space-y-6">
                                                                <div>
                                                                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-3">Audit Details</h4>
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                                                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Entity Reference</p>
                                                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                                                                {log.entityType ? `${log.entityType} #${log.entityId || 'N/A'}` : 'Global Action'}
                                                                            </p>
                                                                        </div>
                                                                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                                                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Context Property</p>
                                                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                                                                {prop?.displayName || 'System Level'}
                                                                            </p>
                                                                        </div>
                                                                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                                                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Full Description</p>
                                                                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic">
                                                                                "{log.action}"
                                                                            </p>
                                                                        </div>
                                                                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                                                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Security Flag</p>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className={`w-2 h-2 rounded-full ${log.severity === 'critical' ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                                                                                <p className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">
                                                                                    {log.severity === 'critical' ? 'Requires Attention' : 'Secure Transaction'}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* State Tracking (Old vs New Values) */}
                                                            <div className="space-y-4">
                                                                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1">Data Evolution (Diff)</h4>
                                                                {(log.oldValues || log.newValues) ? (
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                        <div className="space-y-1">
                                                                            <span className="text-[9px] font-bold text-rose-500 uppercase ml-2">Previous State</span>
                                                                            <div className="p-4 bg-rose-50/50 dark:bg-rose-900/10 rounded-2xl border border-rose-100 dark:border-rose-900/30 max-h-48 overflow-y-auto custom-scrollbar">
                                                                                <pre className="text-[10px] font-mono text-rose-700 dark:text-rose-400 whitespace-pre-wrap">
                                                                                    {log.oldValues ? JSON.stringify(JSON.parse(log.oldValues), null, 2) : 'No prior data recorded'}
                                                                                </pre>
                                                                            </div>
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <span className="text-[9px] font-bold text-emerald-600 uppercase ml-2">Updated State</span>
                                                                            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 max-h-48 overflow-y-auto custom-scrollbar">
                                                                                <pre className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap">
                                                                                    {log.newValues ? JSON.stringify(JSON.parse(log.newValues), null, 2) : 'Final state immutable'}
                                                                                </pre>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                                                                        <i className="fas fa-ghost text-slate-200 text-3xl mb-3"></i>
                                                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">No state differences recorded for this event type</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                                {filteredLogs.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-24 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-200 text-3xl">
                                                    <i className="fas fa-filter"></i>
                                                </div>
                                                <p className="text-sm font-bold text-slate-400 italic">No activity records match your deep-filter criteria.</p>
                                                <button 
                                                    onClick={() => {
                                                        setFilterSeverity('all'); setFilterModule('all'); setFilterAction('all');
                                                        setUserFilter('all'); setPropertyFilter('all'); setSearchTerm('');
                                                    }}
                                                    className="text-[10px] font-black uppercase text-hotel-gold hover:underline"
                                                >
                                                    Clear All Filters
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border-t dark:border-slate-700 flex justify-between items-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        Showing {filteredLogs.length > 100 ? 'first 100' : filteredLogs.length} of {filteredLogs.length} total ledger entries
                    </p>
                    <div className="flex items-center gap-4">
                        <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                        <span className="text-[9px] font-black uppercase text-slate-400">Ledger is Append-Only & Immutable</span>
                    </div>
                </div>
            </div>
            <ExportOptionsModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} onExportPdf={handlePdfExport} onExportExcel={() => {}} isPdfExporting={isPdfExporting} isExcelExporting={false} />
        </div>
    );
};

export default ActivityLogPage;
