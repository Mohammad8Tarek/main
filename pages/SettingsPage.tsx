
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { AppSettings, DEFAULT_SETTINGS, DEPARTMENTS, departmentJobTitles, RoomTypeConfig } from '../types';
import { logActivity } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';

const SettingsPage: React.FC = () => {
    const { settings, updateSettings } = useSettings();
    const { t, language, setLanguage } = useLanguage();
    const { showToast } = useToast();
    const { user } = useAuth();
    
    const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Taxonomy States
    const [expandedDept, setExpandedDept] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [newDeptName, setNewDeptName] = useState('');
    const [newJobTitles, setNewJobTitles] = useState<Record<string, string>>({});
    const [roomTypeForm, setRoomTypeForm] = useState<RoomTypeConfig>({ name: '', description: '', defaultCapacity: 1 });

    useEffect(() => {
        setLocalSettings(settings);
        setIsDirty(false);
    }, [settings]);

    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--primary-color', localSettings.primaryColor);
        root.style.setProperty('--sidebar-color', localSettings.sidebarColor);
        root.style.setProperty('--button-color', localSettings.buttonColor);
        root.style.setProperty('--header-color', localSettings.headerColor || '#FFFFFF');
        root.style.setProperty('--bg-color', localSettings.backgroundColor || '#E2E8F0');
        root.style.setProperty('--text-color', localSettings.textColor || '#1A202C');
        
        document.body.style.backgroundColor = localSettings.backgroundColor || '#E2E8F0';
        document.body.style.color = localSettings.textColor || '#1A202C';
    }, [localSettings]);

    const taxonomy = useMemo(() => {
        const tax = localSettings.customTaxonomy || DEFAULT_SETTINGS.customTaxonomy;
        const roomTypes = (tax.roomTypes || []).map(rt => 
            typeof rt === 'string' ? { name: rt, description: '', defaultCapacity: 1 } : rt
        );
        return { ...tax, roomTypes };
    }, [localSettings.customTaxonomy]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target as HTMLInputElement;
        const finalValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        setLocalSettings(prev => ({ ...prev, [name]: finalValue }));
        setIsDirty(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 500 * 1024) {
            showToast(t('settings.logoSizeError'), 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setLocalSettings(prev => ({ ...prev, systemLogo: reader.result as string }));
            setIsDirty(true);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            await updateSettings(localSettings);
            if (localSettings.defaultLanguage !== language) {
                setLanguage(localSettings.defaultLanguage);
            }
            await logActivity(user!.username, "Updated system settings and taxonomy");
            showToast(t('settings.saved'), "success");
            setIsDirty(false);
        } catch (error: any) {
            showToast(t('errors.generic'), "error");
        } finally {
            setIsSaving(false);
        }
    };

    // --- Organization Taxonomy Actions ---
    const allDepts = useMemo(() => {
        const custom = taxonomy.departments || [];
        const combined = Array.from(new Set([...DEPARTMENTS, ...custom]));
        const filtered = combined.filter(d => !taxonomy.hiddenDepartments?.includes(d));
        if (!searchTerm) return filtered;
        return filtered.filter(d => {
            const translated = t(`departments.${d}`);
            return d.toLowerCase().includes(searchTerm.toLowerCase()) || 
                   translated.toLowerCase().includes(searchTerm.toLowerCase());
        });
    }, [taxonomy.departments, taxonomy.hiddenDepartments, searchTerm, t]);

    const addDepartment = () => {
        if (!newDeptName.trim()) return;
        const normalized = newDeptName.trim().toUpperCase().replace(/\s+/g, '_');
        setLocalSettings(prev => {
            const currentTax = prev.customTaxonomy || DEFAULT_SETTINGS.customTaxonomy;
            return {
                ...prev,
                customTaxonomy: {
                    ...currentTax,
                    departments: [...(currentTax.departments || []), normalized],
                    jobTitles: { ...(currentTax.jobTitles || {}), [normalized]: [] }
                }
            };
        });
        setNewDeptName('');
        setIsDirty(true);
        setExpandedDept(normalized);
    };

    const removeDepartment = (deptKey: string) => {
        const confirmMsg = language === 'ar' 
            ? `هل أنت متأكد من إخفاء قسم: ${t(`departments.${deptKey}`)}؟` 
            : `Are you sure you want to hide: ${t(`departments.${deptKey}`)}?`;
        if (!window.confirm(confirmMsg)) return;
        
        setLocalSettings(prev => {
            const currentTax = prev.customTaxonomy || DEFAULT_SETTINGS.customTaxonomy;
            const hidden = currentTax.hiddenDepartments || [];
            return {
                ...prev,
                customTaxonomy: {
                    ...currentTax,
                    hiddenDepartments: [...hidden, deptKey]
                }
            };
        });
        setIsDirty(true);
    };

    const addJobTitle = (deptKey: string) => {
        const title = newJobTitles[deptKey]?.trim();
        if (!title) return;
        setLocalSettings(prev => {
            const currentTax = prev.customTaxonomy || DEFAULT_SETTINGS.customTaxonomy;
            const currentCustom = currentTax.jobTitles?.[deptKey] || [];
            return {
                ...prev,
                customTaxonomy: {
                    ...currentTax,
                    jobTitles: { ...(currentTax.jobTitles || {}), [deptKey]: [...currentCustom, title] }
                }
            };
        });
        setNewJobTitles(prev => ({ ...prev, [deptKey]: '' }));
        setIsDirty(true);
    };

    const removeJobTitle = (deptKey: string, title: string) => {
        setLocalSettings(prev => {
            const currentTax = prev.customTaxonomy || DEFAULT_SETTINGS.customTaxonomy;
            const hiddenObj = currentTax.hiddenJobTitles || {};
            const hiddenForDept = hiddenObj[deptKey] || [];
            return {
                ...prev,
                customTaxonomy: {
                    ...currentTax,
                    hiddenJobTitles: { ...hiddenObj, [deptKey]: [...hiddenForDept, title] }
                }
            };
        });
        setIsDirty(true);
    };

    const addRoomType = () => {
        if (!roomTypeForm.name.trim()) return;
        setLocalSettings(prev => {
            const currentTax = prev.customTaxonomy || DEFAULT_SETTINGS.customTaxonomy;
            const currentTypes = (currentTax.roomTypes || []).map(rt => 
                typeof rt === 'string' ? { name: rt, description: '', defaultCapacity: 1 } : rt
            );
            return {
                ...prev,
                customTaxonomy: {
                    ...currentTax,
                    roomTypes: [...currentTypes, { ...roomTypeForm }]
                }
            };
        });
        setRoomTypeForm({ name: '', description: '', defaultCapacity: 1 });
        setIsDirty(true);
    };

    const removeRoomType = (name: string) => {
        setLocalSettings(prev => {
            const currentTax = prev.customTaxonomy || DEFAULT_SETTINGS.customTaxonomy;
            return {
                ...prev,
                customTaxonomy: {
                    ...currentTax,
                    roomTypes: (currentTax.roomTypes || []).filter(rt => (typeof rt === 'string' ? rt : rt.name) !== name)
                }
            };
        });
        setIsDirty(true);
    };

    const sectionClass = "bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 space-y-6 animate-fade-in-up transition-all";
    const labelClass = "block text-[10px] font-black text-hotel-muted uppercase mb-2 tracking-widest";
    const inputClass = "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-hotel-gold outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white transition-all shadow-inner";

    return (
        <div className="space-y-8 pb-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 pb-6 dark:border-slate-700">
                <div>
                    <h1 className="text-4xl font-black text-hotel-navy dark:text-white tracking-tighter uppercase">{t('settings.title')}</h1>
                    <p className="text-hotel-muted dark:text-slate-400 text-sm mt-1">
                        {isDirty ? <span className="text-rose-600 font-bold animate-pulse">{language === 'ar' ? 'تغييرات غير محفوظة!' : 'Unsaved changes!'}</span> : t('settings.subtitle')}
                    </p>
                </div>
                <button onClick={handleSave} disabled={isSaving} className="px-8 py-3 bg-hotel-navy text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 hover:brightness-110">
                    {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>} {t('settings.saveChanges')}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* General Config */}
                <section className={sectionClass}>
                    <h2 className="text-lg font-black text-hotel-navy dark:text-white flex items-center gap-3 border-b border-slate-50 dark:border-slate-700 pb-4 uppercase tracking-tight">
                        <i className="fas fa-cog text-hotel-gold"></i> {t('settings.generalConfig')}
                    </h2>
                    <div className="space-y-5">
                        <div>
                            <label className={labelClass}>{t('settings.displayName')}</label>
                            <input name="systemName" value={localSettings.systemName} onChange={handleInputChange} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>{t('settings.customLogo.label')}</label>
                            <div className="flex items-center gap-4 mt-2">
                                <div className="w-16 h-16 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-inner">
                                    {localSettings.systemLogo ? (
                                        <img src={localSettings.systemLogo} className="w-full h-full object-contain" alt="Logo Preview" />
                                    ) : (
                                        <i className="fas fa-image text-slate-300"></i>
                                    )}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button 
                                        type="button" 
                                        onClick={() => fileInputRef.current?.click()} 
                                        className="px-4 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all border border-slate-200 dark:border-slate-600"
                                    >
                                        {t('settings.customLogo.upload')}
                                    </button>
                                    {localSettings.systemLogo && (
                                        <button 
                                            type="button" 
                                            onClick={() => { setLocalSettings(p => ({ ...p, systemLogo: null })); setIsDirty(true); }} 
                                            className="px-4 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all"
                                        >
                                            {t('settings.customLogo.remove')}
                                        </button>
                                    )}
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                            </div>
                        </div>
                        <div>
                             <label className={labelClass}>{language === 'ar' ? 'اللغة الافتراضية' : 'Default Language'}</label>
                             <select name="defaultLanguage" value={localSettings.defaultLanguage} onChange={handleInputChange} className={inputClass}>
                                 <option value="en">English</option>
                                 <option value="ar">العربية</option>
                             </select>
                        </div>
                    </div>
                </section>

                {/* Departure Alerts */}
                <section className={sectionClass}>
                    <h2 className="text-lg font-black text-hotel-navy dark:text-white flex items-center gap-3 border-b border-slate-50 dark:border-slate-700 pb-4 uppercase tracking-tight">
                        <i className="fas fa-bell text-rose-500"></i> {language === 'ar' ? 'تنبيهات المغادرة' : 'Departure Alerts Configuration'}
                    </h2>
                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl shadow-inner">
                            <div>
                                <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">{language === 'ar' ? 'تفعيل تنبيهات التاريخ' : 'Enable Date Alerts'}</h4>
                                <p className="text-xs text-slate-400">{language === 'ar' ? 'البحث عن مواعيد الخروج القادمة.' : 'Scan for upcoming checkout dates.'}</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" name="departureAlertsEnabled" checked={localSettings.departureAlertsEnabled} onChange={handleInputChange} className="sr-only peer" />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                        </div>
                        <div className={!localSettings.departureAlertsEnabled ? 'opacity-40 pointer-events-none' : ''}>
                            <label className={labelClass}>{language === 'ar' ? 'حد التنبيه (أيام)' : 'Alert Threshold (Days)'}</label>
                            <div className="flex items-center gap-4">
                                <input type="range" name="departureAlertThreshold" min="1" max="30" value={localSettings.departureAlertThreshold} onChange={handleInputChange} className="flex-1 accent-hotel-navy" />
                                <span className="w-12 h-10 bg-slate-100 dark:bg-slate-900 flex items-center justify-center rounded-xl font-black text-hotel-navy dark:text-hotel-gold border border-slate-200 dark:border-slate-700">{localSettings.departureAlertThreshold}</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Room Types Taxonomy */}
                <section className={sectionClass + " lg:col-span-2"}>
                    <h2 className="text-lg font-black text-hotel-navy dark:text-white flex items-center gap-3 border-b border-slate-50 dark:border-slate-700 pb-4 uppercase tracking-tight">
                        <i className="fas fa-bed text-hotel-gold"></i> {language === 'ar' ? 'تكوين أنواع الغرف' : 'Housing Configuration (Room Types)'}
                    </h2>
                    
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-inner">
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest">{language === 'ar' ? 'تعريف أنواع الغرف المتاحة والسعة الافتراضية.' : 'Define available room types with default capacities.'}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <div className="md:col-span-3">
                                <label className={labelClass}>{language === 'ar' ? 'اسم النوع' : 'Type Name'}</label>
                                <input placeholder={language === 'ar' ? 'مثال: غرفة مشتركة' : 'e.g. Shared Room'} value={roomTypeForm.name} onChange={e => setRoomTypeForm(p=>({...p, name: e.target.value}))} className={inputClass} />
                            </div>
                            <div className="md:col-span-5">
                                <label className={labelClass}>{language === 'ar' ? 'الوصف / ملاحظات' : 'Description / Notes'}</label>
                                <input placeholder={language === 'ar' ? 'خاصة / مشتركة / VIP...' : 'Private/Shared/VIP...'} value={roomTypeForm.description} onChange={e => setRoomTypeForm(p=>({...p, description: e.target.value}))} className={inputClass} />
                            </div>
                            <div className="md:col-span-2">
                                <label className={labelClass}>{language === 'ar' ? 'الأسرة الافتراضية' : 'Default Beds'}</label>
                                <input type="number" min="1" value={roomTypeForm.defaultCapacity} onChange={e => setRoomTypeForm(p=>({...p, defaultCapacity: parseInt(e.target.value)}))} className={inputClass} />
                            </div>
                            <div className="md:col-span-2 flex items-end pb-0.5">
                                <button onClick={addRoomType} className="w-full bg-hotel-gold text-white py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:brightness-110 shadow-lg transition-all">{language === 'ar' ? 'إضافة النوع' : 'Add Type'}</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {(taxonomy.roomTypes || []).map((rt: RoomTypeConfig) => (
                                <div key={rt.name} className="flex flex-col bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm group hover:border-hotel-gold/30 transition-all">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-tight text-xs">{rt.name}</h4>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{rt.defaultCapacity} {language === 'ar' ? 'أسرة' : 'Beds'}</p>
                                        </div>
                                        <button onClick={() => removeRoomType(rt.name)} className="w-6 h-6 rounded-lg bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-sm"><i className="fas fa-times text-[10px]"></i></button>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed italic line-clamp-2">
                                        {rt.description || (language === 'ar' ? 'لا يوجد وصف.' : 'No description provided.')}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Organization Taxonomy (Restored) */}
                <section className={sectionClass + " lg:col-span-2"}>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-50 dark:border-slate-700 pb-4 gap-4">
                        <h2 className="text-lg font-black text-hotel-navy dark:text-white flex items-center gap-3 uppercase tracking-tight">
                            <i className="fas fa-sitemap text-hotel-gold"></i> {language === 'ar' ? 'الهيكل التنظيمي (الأقسام)' : 'Organization Taxonomy (Departments)'}
                        </h2>
                        <div className="relative w-full md:w-64">
                            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                            <input 
                                placeholder={language === 'ar' ? 'بحث في الأقسام...' : 'Search departments...'} 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)} 
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 rounded-xl text-xs outline-none shadow-inner" 
                            />
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-center border border-dashed border-slate-200 dark:border-slate-700 shadow-inner">
                        <input 
                            placeholder={language === 'ar' ? 'أدخل اسم القسم الجديد...' : 'Enter new department name...'} 
                            value={newDeptName} 
                            onChange={e => setNewDeptName(e.target.value)} 
                            className="w-full md:flex-1 bg-white dark:bg-slate-800 border-none rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-hotel-gold dark:text-white shadow-sm" 
                        />
                        <button onClick={addDepartment} className="w-full md:w-auto bg-hotel-navy text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:brightness-110 transition-all shadow-md">
                            {language === 'ar' ? 'إضافة قسم' : 'Add Department'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {allDepts.map(dept => {
                            const isExpanded = expandedDept === dept;
                            const customTitles = taxonomy.jobTitles?.[dept] || [];
                            const defaultTitles = departmentJobTitles[dept] || [];
                            const combinedJobTitles = Array.from(new Set([...defaultTitles, ...customTitles]))
                                .filter(t => !taxonomy.hiddenJobTitles?.[dept]?.includes(t));
                            
                            return (
                                <div key={dept} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                                    <div className={`p-4 flex justify-between items-center transition-colors ${isExpanded ? 'bg-slate-50 dark:bg-slate-700/50' : ''}`}>
                                        <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => setExpandedDept(isExpanded ? null : dept)}>
                                            <div className="w-8 h-8 rounded-lg bg-hotel-navy text-white flex items-center justify-center text-[10px] font-black uppercase shadow-sm">
                                                {dept.substring(0, 2)}
                                            </div>
                                            <span className="text-xs font-black uppercase text-slate-700 dark:text-white tracking-tight">
                                                {t(`departments.${dept}`)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => removeDepartment(dept)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors" title={language === 'ar' ? 'إخفاء القسم' : 'Hide Department'}>
                                                <i className="fas fa-eye-slash text-[10px]"></i>
                                            </button>
                                            <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-[10px] text-slate-400 ml-2`}></i>
                                        </div>
                                    </div>
                                    
                                    {isExpanded && (
                                        <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-50 dark:border-slate-700 animate-fade-in-up">
                                            <p className="text-[9px] font-black text-slate-400 uppercase mb-3 tracking-widest">
                                                {language === 'ar' ? 'المسميات الوظيفية' : 'Positions & Job Titles'}
                                            </p>
                                            <div className="space-y-2 mb-4 max-h-40 overflow-y-auto custom-scrollbar">
                                                {combinedJobTitles.map(title => (
                                                    <div key={title} className="flex justify-between items-center group p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-600">
                                                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{title}</span>
                                                        <button onClick={() => removeJobTitle(dept, title)} className="opacity-0 group-hover:opacity-100 p-1 text-rose-400 hover:text-rose-600 transition-all">
                                                            <i className="fas fa-times text-[9px]"></i>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex gap-2 pt-3 border-t border-dashed border-slate-100 dark:border-slate-700">
                                                <input 
                                                    placeholder={language === 'ar' ? 'أضف مسمى...' : 'Add title...'} 
                                                    value={newJobTitles[dept] || ''} 
                                                    onChange={e => setNewJobTitles(p => ({ ...p, [dept]: e.target.value }))} 
                                                    onKeyPress={e => e.key === 'Enter' && addJobTitle(dept)} 
                                                    className="flex-1 bg-slate-50 dark:bg-slate-900 border-none rounded-lg px-3 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-hotel-gold dark:text-white shadow-inner" 
                                                />
                                                <button onClick={() => addJobTitle(dept)} className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-sm hover:bg-slate-300">
                                                    {language === 'ar' ? 'أضف' : 'Add'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default SettingsPage;
