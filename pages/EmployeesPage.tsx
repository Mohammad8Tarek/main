
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Employee, DEPARTMENTS, departmentJobTitles } from '../types';
import { employeeApi, logActivity } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { usePermissions } from '../hooks/usePermissions';
import { exportToPdf, exportToExcel, downloadEmployeeTemplate } from '../services/exportService';
import ExportOptionsModal from '../components/ExportOptionsModal';
import * as XLSX from 'xlsx';

const EmployeesPage: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | Employee['status']>('all');
    const [departmentFilter, setDepartmentFilter] = useState<string>('all');
    
    const { user } = useAuth();
    const { language, t } = useLanguage();
    const { showToast } = useToast();
    const { settings: appSettings } = useSettings();
    const perms = usePermissions();
    const importInputRef = useRef<HTMLInputElement>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [formData, setFormData] = useState({
        employeeId: '', firstName: '', lastName: '', nationalId: '', nationality: '', address: '', 
        jobTitle: '', level: '', phone: '', department: '', status: 'active' as Employee['status'], 
        hireDate: '', idImage: null as string | null, gender: 'male' as Employee['gender']
    });

    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isPdfExporting, setIsPdfExporting] = useState(false);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const data = await employeeApi.getAll();
            setEmployees(data);
        } catch (error) { showToast(t('errors.fetchFailed'), 'error'); } finally { setLoading(false); }
    };

    useEffect(() => { fetchEmployees(); }, []);

    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            const full = `${emp.firstName} ${emp.lastName}`.toLowerCase();
            const matchesSearch = full.includes(searchTerm.toLowerCase()) || 
                                 emp.nationalId.includes(searchTerm) || 
                                 emp.employeeId.includes(searchTerm);
            const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
            const matchesDept = departmentFilter === 'all' || emp.department === departmentFilter;
            return matchesSearch && matchesStatus && matchesDept;
        });
    }, [employees, searchTerm, statusFilter, departmentFilter]);

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data: any[] = XLSX.utils.sheet_to_json(ws);
                
                let successCount = 0;
                for (const row of data) {
                    const empPayload: Omit<Employee, 'id'> = {
                        employeeId: String(row.employeeId || ''),
                        firstName: row.firstName || 'Imported',
                        lastName: row.lastName || 'Staff',
                        nationalId: String(row.nationalId || ''),
                        nationality: row.nationality || '',
                        address: row.address || '',
                        jobTitle: row.jobTitle || 'Staff',
                        level: String(row.level || ''),
                        phone: String(row.phone || ''),
                        department: row.department || 'it',
                        gender: (row.gender?.toLowerCase() === 'female' ? 'female' : 'male'),
                        status: 'active',
                        hireDate: row.hireDate ? new Date(row.hireDate).toISOString() : new Date().toISOString(),
                        propertyId: appSettings.systemName === 'Sunrise Staff Housing' ? 1 : 1, 
                    };
                    await employeeApi.create(empPayload);
                    successCount++;
                }
                
                showToast(`Successfully imported ${successCount} employees`, 'success');
                logActivity(user!.username, `Imported ${successCount} employees from Excel`, 'IMPORT', 'employees');
                fetchEmployees();
            } catch (err) {
                showToast('Failed to parse Excel file. Ensure it matches the template.', 'error');
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editingEmployee) {
                await employeeApi.update(editingEmployee.id, formData);
                showToast(t('employees.updated'), 'success');
            } else {
                await employeeApi.create(formData);
                showToast(t('employees.added'), 'success');
            }
            setIsModalOpen(false);
            fetchEmployees();
        } catch (e) { showToast(t('errors.generic'), 'error'); } finally { setIsSubmitting(false); }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => setFormData(p => ({ ...p, idImage: reader.result as string }));
            reader.readAsDataURL(file);
        }
    };

    const thClass = "px-6 py-5 text-[10px] font-black uppercase text-slate-500 tracking-widest bg-slate-50 dark:bg-slate-700/50 sticky top-0 z-10 whitespace-nowrap border-b dark:border-slate-700";
    const tdClass = "px-6 py-4 text-[11px] font-bold text-slate-700 dark:text-slate-300 border-b dark:border-slate-700/50";
    const labelClass = "block text-[9px] font-black uppercase text-slate-500 mb-1.5 tracking-widest";
    const inputClass = "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-hotel-gold outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white transition-all shadow-inner";

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <h1 className="text-3xl font-black text-hotel-navy dark:text-white uppercase tracking-tighter">Staff Directory</h1>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => downloadEmployeeTemplate(t)} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white"><i className="fas fa-file-excel me-2 text-emerald-600"></i> Template</button>
                    <button onClick={() => importInputRef.current?.click()} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white"><i className="fas fa-upload me-2 text-primary-600"></i> Import</button>
                    <button onClick={() => setIsExportModalOpen(true)} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white"><i className="fas fa-download me-2"></i> {t('export')}</button>
                    {perms.canManageEmployees && (
                        <button onClick={() => { setEditingEmployee(null); setFormData({ employeeId: '', firstName: '', lastName: '', nationalId: '', nationality: '', address: '', jobTitle: '', level: '', phone: '', department: DEPARTMENTS[0], status: 'active', hireDate: new Date().toISOString().split('T')[0], idImage: null, gender: 'male' }); setIsModalOpen(true); }} className="px-6 py-2.5 bg-hotel-navy text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:brightness-110 active:scale-95 transition-all"><i className="fas fa-user-plus me-2"></i> Add Record</button>
                    )}
                    <input type="file" ref={importInputRef} onChange={handleImport} accept=".xlsx,.xls" className="hidden" />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 relative">
                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input placeholder="Scan by Clock ID or Name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={inputClass + " pl-10"} />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className={inputClass}><option value="all">Status: All</option><option value="active">Active</option><option value="left">Leaver</option></select>
                <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} className={inputClass}><option value="all">Dept: All</option>{DEPARTMENTS.map(d => <option key={d} value={d}>{t(`departments.${d}`)}</option>)}</select>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left rtl:text-right border-collapse min-w-[1200px]">
                        <thead>
                            <tr>
                                <th className={thClass}>Identity</th>
                                <th className={thClass}>Clock ID</th>
                                <th className={thClass}>Full Name</th>
                                <th className={thClass}>Nationality</th>
                                <th className={thClass}>National ID</th>
                                <th className={thClass}>Gender</th>
                                <th className={thClass}>Dept / Position</th>
                                <th className={thClass}>Phone</th>
                                <th className={thClass}>Level</th>
                                <th className={thClass}>Hired</th>
                                <th className={thClass}>Status</th>
                                <th className={thClass + " text-center"}>Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {filteredEmployees.map(emp => (
                                <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                    <td className={tdClass}>
                                        <div className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-600 shadow-md flex items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-900">
                                            {emp.idImage ? <img src={emp.idImage} className="w-full h-full object-cover" /> : <i className="fas fa-user text-slate-300"></i>}
                                        </div>
                                    </td>
                                    <td className={tdClass + " font-mono text-hotel-gold"}>{emp.employeeId || '—'}</td>
                                    <td className={tdClass + " uppercase font-black"}>{emp.firstName} {emp.lastName}</td>
                                    <td className={tdClass + " uppercase text-slate-500 font-bold"}>{emp.nationality || '—'}</td>
                                    <td className={tdClass + " text-slate-500 font-mono"}>{emp.nationalId}</td>
                                    <td className={tdClass}><span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${emp.gender === 'female' ? 'bg-pink-50 text-pink-600 border-pink-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{emp.gender}</span></td>
                                    <td className={tdClass}>
                                        <div className="flex flex-col leading-tight"><span className="text-[9px] uppercase text-slate-400 font-black tracking-widest">{t(`departments.${emp.department}`)}</span><span className="text-[10px] text-slate-800 dark:text-white uppercase">{emp.jobTitle}</span></div>
                                    </td>
                                    <td className={tdClass + " font-mono"}>{emp.phone || '—'}</td>
                                    <td className={tdClass + " text-center font-black"}>{emp.level || '—'}</td>
                                    <td className={tdClass + " whitespace-nowrap"}>{new Date(emp.hireDate).toLocaleDateString()}</td>
                                    <td className={tdClass}><span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${emp.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{emp.status}</span></td>
                                    <td className={tdClass}>
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => { setEditingEmployee(emp); setFormData({ ...emp, hireDate: emp.hireDate.split('T')[0] }); setIsModalOpen(true); }} className="text-primary-600 hover:bg-primary-50 p-2 rounded-lg transition-all"><i className="fas fa-edit"></i></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-700 flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em]">
                    <span className="text-slate-400">Ledger Count: {filteredEmployees.length} Records</span>
                    <span className="text-hotel-gold">Verified Profile Data</span>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b dark:border-slate-700 bg-hotel-navy text-white flex justify-between items-center">
                            <h2 className="text-xl font-black uppercase tracking-widest">{editingEmployee ? 'Update Profile' : 'New Staff Enrollment'}</h2>
                            <button onClick={() => setIsModalOpen(false)}><i className="fas fa-times"></i></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                            <div className="flex flex-col md:flex-row gap-8 items-start">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-32 h-32 rounded-3xl border-4 border-slate-50 dark:border-slate-700 overflow-hidden shadow-2xl bg-slate-100 flex items-center justify-center">
                                        {formData.idImage ? <img src={formData.idImage} className="w-full h-full object-cover" /> : <i className="fas fa-user-circle text-5xl text-slate-200"></i>}
                                    </div>
                                    <label className="cursor-pointer bg-hotel-navy text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-md">
                                        Upload Photo <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                    </label>
                                </div>
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-1"><label className={labelClass}>Clock / Staff ID</label><input value={formData.employeeId} onChange={e => setFormData(p=>({...p, employeeId: e.target.value}))} required className={inputClass} /></div>
                                    <div className="md:col-span-1"><label className={labelClass}>Hire Date</label><input type="date" value={formData.hireDate} onChange={e => setFormData(p=>({...p, hireDate: e.target.value}))} required className={inputClass} /></div>
                                    <div className="md:col-span-1"><label className={labelClass}>Level / Grade</label><input value={formData.level} onChange={e => setFormData(p=>({...p, level: e.target.value}))} className={inputClass} /></div>
                                    <div><label className={labelClass}>First Name</label><input value={formData.firstName} onChange={e => setFormData(p=>({...p, firstName: e.target.value}))} required className={inputClass} /></div>
                                    <div><label className={labelClass}>Last Name</label><input value={formData.lastName} onChange={e => setFormData(p=>({...p, lastName: e.target.value}))} required className={inputClass} /></div>
                                    <div><label className={labelClass}>Gender</label><select value={formData.gender} onChange={e => setFormData(p=>({...p, gender: e.target.value as any}))} className={inputClass}><option value="male">Male</option><option value="female">Female</option></select></div>
                                    <div><label className={labelClass}>National ID</label><input value={formData.nationalId} onChange={e => setFormData(p=>({...p, nationalId: e.target.value}))} required className={inputClass} /></div>
                                    <div><label className={labelClass}>Nationality</label><input value={formData.nationality} onChange={e => setFormData(p=>({...p, nationality: e.target.value}))} className={inputClass} /></div>
                                    <div><label className={labelClass}>Contact Phone</label><input value={formData.phone} onChange={e => setFormData(p=>({...p, phone: e.target.value}))} className={inputClass} /></div>
                                    <div><label className={labelClass}>Department</label><select value={formData.department} onChange={e => setFormData(p=>({...p, department: e.target.value, jobTitle: departmentJobTitles[e.target.value]?.[0] || ''}))} required className={inputClass}>{DEPARTMENTS.map(d=><option key={d} value={d}>{t(`departments.${d}`)}</option>)}</select></div>
                                    <div className="md:col-span-2"><label className={labelClass}>Job Title</label><select value={formData.jobTitle} onChange={e => setFormData(p=>({...p, jobTitle: e.target.value}))} required className={inputClass}>{(departmentJobTitles[formData.department] || []).map(t=><option key={t} value={t}>{t}</option>)}</select></div>
                                    <div className="md:col-span-3"><label className={labelClass}>Home Address</label><input value={formData.address} onChange={e => setFormData(p=>({...p, address: e.target.value}))} className={inputClass} /></div>
                                </div>
                            </div>
                        </form>
                        <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50/50">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-slate-500 font-black uppercase text-[10px] tracking-widest">Cancel</button>
                            <button onClick={handleSubmit} disabled={isSubmitting} className="px-10 py-2.5 bg-hotel-navy text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl">{isSubmitting ? 'Processing...' : 'Commit Changes'}</button>
                        </div>
                    </div>
                </div>
            )}
            <ExportOptionsModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} onExportPdf={() => { setIsPdfExporting(true); exportToPdf({ headers: ['CLOCK ID', 'NAME', 'DEPT', 'JOB', 'GENDER', 'HIRED', 'NATIONALITY', 'PHONE', 'LEVEL'], data: filteredEmployees.map(e => [e.employeeId, `${e.firstName} ${e.lastName}`, e.department, e.jobTitle, e.gender, e.hireDate, e.nationality, e.phone, e.level]), title: 'STAFF ROSTER', filename: 'staff_directory.pdf', settings: {...appSettings, pdfOrientation: 'l'} as any, language }); setIsPdfExporting(false); setIsExportModalOpen(false); }} onExportExcel={() => { exportToExcel({ headers: ['CLOCK ID', 'NAME', 'DEPT', 'JOB', 'GENDER', 'HIRED', 'NATIONALITY', 'PHONE', 'LEVEL', 'ADDRESS'], data: filteredEmployees.map(e => [e.employeeId, `${e.firstName} ${e.lastName}`, e.department, e.jobTitle, e.gender, e.hireDate, e.nationality, e.phone, e.level, e.address]), filename: 'staff_master.xlsx', settings: appSettings }); setIsExportModalOpen(false); }} isPdfExporting={isPdfExporting} isExcelExporting={false} />
        </div>
    );
};

export default EmployeesPage;
