
import React, { useState, useRef } from 'react';
import { useProperty } from '../context/PropertyContext';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { Property, AVAILABLE_MODULES, ModuleType } from '../types';
import { propertyApi, userApi } from '../services/apiService';
import { useToast } from '../context/ToastContext';
import { Navigate } from 'react-router-dom';

const PropertiesPage: React.FC = () => {
    const { allProperties, refreshProperties, switchProperty, currentProperty } = useProperty();
    const { user } = useAuth();
    const { t } = useLanguage();
    const { showToast } = useToast();
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProp, setEditingProp] = useState<Property | null>(null);
    const [activeTab, setActiveTab] = useState<'general' | 'modules' | 'branding' | 'admin'>('general');
    
    // Form State
    const [formData, setFormData] = useState<Partial<Property>>({ 
        name: '', 
        code: '',
        displayName: '',
        status: 'active', 
        primaryColor: '#0F2A44', 
        logo: null,
        defaultLanguage: 'en',
        enabledModules: AVAILABLE_MODULES.map(m => m.key) // Default all active
    });
    
    // Admin User State (only for creation)
    const [adminUser, setAdminUser] = useState({ username: '', password: '' });
    const [adminUsernameError, setAdminUsernameError] = useState('');
    const [propertyCodeError, setPropertyCodeError] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!user?.roles.includes('super_admin')) return <Navigate to="/" />;

    const handleEdit = (prop: Property) => {
        setEditingProp(prop);
        setFormData({ ...prop });
        setAdminUser({ username: '', password: '' }); 
        setAdminUsernameError('');
        setPropertyCodeError('');
        setActiveTab('general');
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingProp(null);
        setFormData({ 
            name: '', 
            code: '',
            displayName: '',
            status: 'active', 
            primaryColor: '#0F2A44', 
            logo: null,
            defaultLanguage: 'en',
            enabledModules: AVAILABLE_MODULES.map(m => m.key)
        });
        setAdminUser({ username: '', password: '' });
        setAdminUsernameError('');
        setPropertyCodeError('');
        setActiveTab('general');
        setIsModalOpen(true);
    };

    const handleDeleteProperty = async (prop: Property) => {
        if (prop.id === 1) {
            showToast("HQ Property cannot be deleted.", "error");
            return;
        }

        if (!window.confirm(`Are you sure you want to permanently delete "${prop.displayName || prop.name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await propertyApi.delete(prop.id);
            showToast('Property deleted successfully', 'success');
            
            if (currentProperty?.id === prop.id) {
                await switchProperty(1);
            }
            
            await refreshProperties();
        } catch (e: any) {
            showToast(e.message || "Failed to delete property", "error");
        }
    };

    const checkPropertyCode = async (code: string) => {
        if (!code.trim() || (editingProp && editingProp.code.toLowerCase() === code.trim().toLowerCase())) {
            setPropertyCodeError('');
            return;
        }
        try {
            const exists = await propertyApi.checkCodeExists(code);
            if (exists) {
                setPropertyCodeError('Property Code is already taken');
            } else {
                setPropertyCodeError('');
            }
        } catch (e) {
            setPropertyCodeError('');
        }
    };

    const checkAdminUsername = async (username: string) => {
        if (!username.trim()) {
            setAdminUsernameError('');
            return;
        }
        try {
            const exists = await userApi.checkUsernameExists(username);
            if (exists) {
                setAdminUsernameError(t('errors.duplicateUsername', { username: username.trim() }));
            } else {
                setAdminUsernameError('');
            }
        } catch (e) {
            setAdminUsernameError('');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 500 * 1024) { showToast('Image too large (Max 500KB)', 'error'); return; }
        const reader = new FileReader();
        reader.onload = () => setFormData(p => ({ ...p, logo: reader.result as string }));
        reader.readAsDataURL(file);
    };

    const toggleModule = (moduleKey: ModuleType) => {
        setFormData(prev => {
            const modules = prev.enabledModules || [];
            if (modules.includes(moduleKey)) {
                return { ...prev, enabledModules: modules.filter(m => m !== moduleKey) };
            } else {
                return { ...prev, enabledModules: [...modules, moduleKey] };
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.name || !formData.code) {
            showToast("Property Name and Code are required", "error");
            setActiveTab('general');
            return;
        }

        if (propertyCodeError) {
            showToast(propertyCodeError, "error");
            setActiveTab('general');
            return;
        }

        if (!editingProp) {
            if (!adminUser.username || !adminUser.password) {
                showToast("Admin credentials required for new property", "error");
                setActiveTab('admin');
                return;
            }
            if (adminUsernameError) {
                showToast(adminUsernameError, "error");
                setActiveTab('admin');
                return;
            }
        }

        try {
            if (editingProp) {
                await propertyApi.update(editingProp.id, formData);
                showToast('Property updated', 'success');
            } else {
                await propertyApi.create({
                    ...formData,
                    adminUsername: adminUser.username,
                    adminPassword: adminUser.password
                });
                showToast('Property created & Admin assigned', 'success');
            }
            setIsModalOpen(false);
            refreshProperties();
        } catch (e: any) {
            console.error(e);
            const msg = e.message || 'Operation failed';
            showToast(msg, 'error');
            
            if (msg.toLowerCase().includes('username')) {
                setActiveTab('admin');
            } else if (msg.toLowerCase().includes('code')) {
                setActiveTab('general');
            }
        }
    };

    const inputClass = "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-hotel-gold outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white transition-all shadow-inner placeholder-slate-400";
    const labelClass = "block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-widest";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Property Management</h1>
                    <p className="text-hotel-muted dark:text-slate-400 text-sm mt-1">Manage multiple sites/hotels from a single dashboard.</p>
                </div>
                <button onClick={handleCreate} className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-lg hover:brightness-110 transition-all">
                    <i className="fas fa-plus me-2"></i> Add Property
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {allProperties.map(prop => (
                    <div key={prop.id} className={`bg-white dark:bg-slate-800 rounded-2xl shadow-lg border p-6 transition-all ${prop.id === currentProperty?.id ? 'border-hotel-gold ring-2 ring-hotel-gold/20' : 'border-slate-100 dark:border-slate-700'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border dark:border-slate-600 shadow-inner">
                                {prop.logo ? <img src={prop.logo} alt={prop.name} className="w-full h-full object-contain" /> : <i className="fas fa-building text-slate-400 text-xl"></i>}
                            </div>
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${prop.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>{prop.status}</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{prop.displayName || prop.name}</h3>
                        <p className="text-xs text-slate-500 font-mono mb-2">{prop.code}</p>
                        <div className="flex flex-wrap gap-1 mb-4">
                            {prop.enabledModules && prop.enabledModules.slice(0, 3).map(m => (
                                <span key={m} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[9px] rounded uppercase font-bold">{m}</span>
                            ))}
                            {(prop.enabledModules?.length || 0) > 3 && <span className="px-1.5 py-0.5 text-[9px] text-slate-400">+{prop.enabledModules!.length - 3}</span>}
                        </div>
                        
                        <div className="flex gap-2">
                            <button 
                                onClick={() => switchProperty(prop.id)} 
                                disabled={prop.id === currentProperty?.id} 
                                className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {prop.id === currentProperty?.id ? 'Current' : 'Switch To'}
                            </button>
                            <button 
                                onClick={() => handleEdit(prop)} 
                                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-primary-600 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/40 transition-colors"
                            >
                                <i className="fas fa-edit"></i>
                            </button>
                            {prop.id !== 1 && (
                                <button 
                                    onClick={() => handleDeleteProperty(prop)} 
                                    className="px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-600 dark:hover:bg-rose-600 hover:text-white transition-colors" 
                                    title="Delete Property"
                                >
                                    <i className="fas fa-trash-alt"></i>
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-widest">{editingProp ? 'Edit Property' : 'New Property'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><i className="fas fa-times"></i></button>
                        </div>
                        
                        {/* Tabs */}
                        <div className="flex border-b dark:border-slate-700 px-6 bg-slate-50/20">
                            {(['general', 'modules', 'branding', 'admin'] as const).map(tab => {
                                if (tab === 'admin' && editingProp) return null; // Hide Admin tab on edit
                                return (
                                    <button 
                                        key={tab} 
                                        onClick={() => setActiveTab(tab)}
                                        className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-colors ${activeTab === tab ? 'border-hotel-gold text-hotel-navy dark:text-hotel-gold' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                    >
                                        {tab}
                                    </button>
                                );
                            })}
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar flex-1">
                            
                            {activeTab === 'general' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-in-up">
                                    <div className="col-span-2">
                                        <label className={labelClass}>Property Name (Internal)</label>
                                        <input type="text" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} required className={inputClass} placeholder="e.g. Sunrise Crystal Bay" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Property Code (Unique)</label>
                                        <input 
                                            type="text" 
                                            value={formData.code} 
                                            onChange={e => {
                                                setFormData(p => ({...p, code: e.target.value.toUpperCase()}));
                                                if (propertyCodeError) setPropertyCodeError('');
                                            }} 
                                            onBlur={e => checkPropertyCode(e.target.value)}
                                            required 
                                            className={`${inputClass} ${propertyCodeError ? 'border-rose-500 ring-rose-100 ring-1' : ''}`} 
                                            placeholder="e.g. SCB-01" 
                                        />
                                        {propertyCodeError && <p className="text-rose-500 text-[10px] font-bold mt-1 uppercase">{propertyCodeError}</p>}
                                    </div>
                                    <div>
                                        <label className={labelClass}>Display Name (Public)</label>
                                        <input type="text" value={formData.displayName} onChange={e => setFormData(p => ({...p, displayName: e.target.value}))} className={inputClass} placeholder="e.g. Crystal Bay Resort" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Default Language</label>
                                        <select value={formData.defaultLanguage} onChange={e => setFormData(p => ({...p, defaultLanguage: e.target.value as any}))} className={inputClass}>
                                            <option value="en">English</option>
                                            <option value="ar">Arabic</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Status</label>
                                        <select value={formData.status} onChange={e => setFormData(p => ({...p, status: e.target.value as any}))} className={inputClass}>
                                            <option value="active">Active</option>
                                            <option value="disabled">Disabled</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'modules' && (
                                <div className="animate-fade-in-up space-y-4">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Select active modules for this property. Disabled modules will be hidden from the sidebar.</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {AVAILABLE_MODULES.map(module => (
                                            <label key={module.key} className={`flex items-center p-3 border-2 rounded-xl cursor-pointer transition-all ${formData.enabledModules?.includes(module.key) ? 'bg-primary-50 border-hotel-gold/30 dark:bg-primary-900/20 dark:border-hotel-gold/20' : 'bg-slate-50 border-transparent hover:border-slate-200 dark:bg-slate-900 dark:border-transparent'}`}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={formData.enabledModules?.includes(module.key)} 
                                                    onChange={() => toggleModule(module.key)}
                                                    className="w-4 h-4 text-hotel-gold rounded border-slate-300 focus:ring-hotel-gold"
                                                />
                                                <span className="ml-3 text-[11px] font-black uppercase text-slate-700 dark:text-slate-200 tracking-tight">{module.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'branding' && (
                                <div className="space-y-6 animate-fade-in-up">
                                    <div>
                                        <label className={labelClass}>Property Logo</label>
                                        <div className="flex gap-4 items-center p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                                            <div className="w-20 h-20 bg-white border rounded-xl flex items-center justify-center overflow-hidden dark:bg-slate-800 dark:border-slate-700 shadow-sm">
                                                {formData.logo ? <img src={formData.logo} className="w-full h-full object-contain" /> : <i className="fas fa-image text-slate-200 text-3xl"></i>}
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-1.5 bg-hotel-navy text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110 shadow-md">Upload Image</button>
                                                {formData.logo && <button type="button" onClick={() => setFormData(p => ({...p, logo: null}))} className="px-4 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-100">Clear Logo</button>}
                                            </div>
                                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Primary Brand Color</label>
                                        <div className="flex gap-3">
                                            <input type="color" value={formData.primaryColor} onChange={e => setFormData(p => ({...p, primaryColor: e.target.value}))} className="h-11 w-14 rounded-xl cursor-pointer border border-slate-200 bg-white dark:bg-slate-700 p-1 shadow-sm" />
                                            <input type="text" value={formData.primaryColor} onChange={e => setFormData(p => ({...p, primaryColor: e.target.value}))} className={inputClass} placeholder="#FFFFFF" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'admin' && !editingProp && (
                                <div className="space-y-4 animate-fade-in-up">
                                    <div className="bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 rounded-2xl p-4 mb-4">
                                        <p className="text-[10px] text-amber-800 dark:text-amber-400 font-black uppercase tracking-widest flex items-center gap-2">
                                            <i className="fas fa-info-circle text-lg"></i>
                                            Automated Admin Provisioning
                                        </p>
                                        <p className="text-[11px] text-amber-700/80 dark:text-amber-500/80 mt-1">An initial Admin user will be automatically created for this property with full access.</p>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Admin Username</label>
                                        <input 
                                            type="text" 
                                            value={adminUser.username} 
                                            onChange={e => {
                                                setAdminUser(p => ({...p, username: e.target.value}));
                                                if (adminUsernameError) setAdminUsernameError('');
                                            }} 
                                            onBlur={e => checkAdminUsername(e.target.value)}
                                            className={`${inputClass} ${adminUsernameError ? 'border-rose-500 ring-rose-100 ring-1' : ''}`} 
                                            autoComplete="off" 
                                            placeholder="System admin username"
                                        />
                                        {adminUsernameError && <p className="text-rose-500 text-[10px] font-bold mt-1 uppercase tracking-tight">{adminUsernameError}</p>}
                                    </div>
                                    <div>
                                        <label className={labelClass}>Admin Password</label>
                                        <input type="password" value={adminUser.password} onChange={e => setAdminUser(p => ({...p, password: e.target.value}))} className={inputClass} autoComplete="new-password" placeholder="Secure password" />
                                    </div>
                                </div>
                            )}

                        </form>
                        
                        <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50/50">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] transition-all hover:text-slate-700">Cancel</button>
                            <button onClick={handleSubmit} disabled={!!adminUsernameError || !!propertyCodeError} className="px-10 py-2.5 bg-hotel-navy text-white rounded-xl font-black shadow-xl uppercase tracking-widest text-xs hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95">Save Property</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PropertiesPage;
