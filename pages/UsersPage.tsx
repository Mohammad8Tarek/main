
import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../types';
import { userApi, logActivity } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { usePermissions } from '../hooks/usePermissions';
import { useProperty } from '../context/PropertyContext'; 
import { Navigate } from 'react-router-dom';

const ALL_ROLES: User['roles'][number][] = ['admin', 'hr', 'manager', 'supervisor', 'maintenance', 'viewer'];
const SUPER_ROLES: User['roles'][number][] = ['super_admin', ...ALL_ROLES];

const UsersPage: React.FC = () => {
    const { user: currentUser } = useAuth();
    const { t } = useLanguage();
    const { showToast } = useToast();
    const perms = usePermissions();
    const { allProperties, currentProperty } = useProperty(); 
    
    if (!perms.canViewUsers) return <Navigate to="/" />;

    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [usernameError, setUsernameError] = useState('');

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        roles: [] as User['roles'],
        status: 'active' as User['status'],
        propertyId: 1 
    });

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await userApi.getAll(perms.isSuperAdmin); 
            setUsers(data);
        } catch (error) { 
            showToast(t('errors.fetchFailed'), 'error'); 
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => { 
        fetchUsers(); 
        const handleRefresh = () => fetchUsers();
        window.addEventListener('datachanged', handleRefresh);
        return () => window.removeEventListener('datachanged', handleRefresh);
    }, [perms.isSuperAdmin, currentProperty?.id]);

    const filteredUsers = useMemo(() => {
        return users.filter(user => user.username.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [users, searchTerm]);

    const openAddModal = () => {
        setEditingUser(null);
        setFormData({ 
            username: '', 
            password: '', 
            roles: ['viewer'], 
            status: 'active',
            propertyId: perms.isSuperAdmin ? (currentProperty?.id || 1) : (currentUser?.propertyId || 1)
        });
        setUsernameError('');
        setIsModalOpen(true);
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setFormData({ 
            username: user.username, 
            password: '', 
            roles: [...user.roles], 
            status: user.status,
            propertyId: user.propertyId 
        });
        setUsernameError('');
        setIsModalOpen(true);
    };

    const checkUsernameAvailability = async (username: string) => {
        if (!username.trim()) { setUsernameError(''); return; }
        if (editingUser && editingUser.username.toLowerCase() === username.trim().toLowerCase()) { setUsernameError(''); return; }

        try {
            const isTaken = await userApi.checkUsernameExists(username);
            if (isTaken) {
                setUsernameError(t('errors.duplicateUsername', { username }));
            } else { setUsernameError(''); }
        } catch (e) { setUsernameError(''); }
    };

    const handleToggleRole = (role: User['roles'][number]) => {
        setFormData(prev => {
            const roles = prev.roles.includes(role) 
                ? prev.roles.filter(r => r !== role) 
                : [...prev.roles, role];
            return { ...prev, roles };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (usernameError) { showToast(usernameError, 'error'); return; }
        if (formData.roles.length === 0) { showToast("Please select at least one role", "error"); return; }

        setIsSubmitting(true);
        try {
            const trimmedUsername = formData.username.trim();
            const targetPropId = perms.isSuperAdmin ? formData.propertyId : (editingUser ? editingUser.propertyId : (currentUser?.propertyId || 1));
            
            if (editingUser) {
                const updateData: any = { 
                    username: trimmedUsername, 
                    roles: formData.roles,
                    status: formData.status,
                    propertyId: targetPropId
                };
                if (formData.password) updateData.password = formData.password;
                await userApi.update(editingUser.id, updateData);
                logActivity(currentUser!.username, `Updated user: ${trimmedUsername}`);
                showToast(t('users.updated'), 'success');
            } else {
                if (!formData.password) { showToast(t('users.passwordRequired'), 'error'); setIsSubmitting(false); return; }
                await userApi.create({
                    username: trimmedUsername,
                    password: formData.password,
                    roles: formData.roles,
                    status: formData.status,
                    propertyId: targetPropId
                });
                logActivity(currentUser!.username, `Created user: ${trimmedUsername}`);
                showToast(t('users.added'), 'success');
            }
            setIsModalOpen(false);
            await fetchUsers();
        } catch (error: any) {
            showToast(t('errors.generic') + ': ' + (error.message || ''), 'error');
        } finally { setIsSubmitting(false); }
    };

    const handleDelete = async (userToDelete: User) => {
        if (userToDelete.id === currentUser?.id) { showToast(t('users.cannotDeleteSelf'), 'error'); return; }
        if (!window.confirm(`${t('users.deleteConfirm', { name: userToDelete.username })}`)) return;
        try {
            await userApi.delete(userToDelete.id);
            logActivity(currentUser!.username, `Deleted user account: ${userToDelete.username}`);
            showToast(t('users.deleted'), 'success');
            await fetchUsers();
        } catch (error) { showToast(t('errors.generic'), 'error'); }
    };

    const inputClass = "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-hotel-gold outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white transition-all shadow-inner placeholder-slate-400";
    const labelClass = "block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-widest";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">{t('users.title')}</h1>
                    <p className="text-hotel-muted dark:text-slate-400 text-sm mt-1">
                        {perms.isSuperAdmin 
                            ? "Global System Administration View: Managing all properties." 
                            : `Managing staff users for ${currentProperty?.displayName || currentProperty?.name}.`}
                    </p>
                </div>
                <button onClick={openAddModal} className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-lg hover:brightness-110 transition-all">
                    <i className="fas fa-user-plus me-2"></i>{t('users.add')}
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="p-5 border-b dark:border-slate-700 flex justify-between items-center gap-4 bg-slate-50/50">
                    <div className="relative w-full max-w-sm">
                        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                        <input 
                            type="text" 
                            placeholder={t('users.search')} 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="bg-white border border-slate-200 text-sm rounded-xl w-full pl-10 pr-4 py-2.5 dark:bg-slate-900 dark:text-white focus:ring-hotel-gold focus:border-hotel-gold outline-none" 
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="p-20 text-center flex flex-col items-center">
                        <div className="w-10 h-10 border-4 border-hotel-navy border-t-hotel-gold rounded-full animate-spin mb-4"></div>
                        <p className="text-hotel-muted font-bold text-xs uppercase tracking-widest">{t('loading')}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
                            <thead className="text-[10px] font-black uppercase text-slate-500 bg-slate-50 dark:bg-slate-700 tracking-wider">
                                <tr>
                                    <th className="px-6 py-5">{t('users.username')}</th>
                                    <th className="px-6 py-5">{t('users.role')}</th>
                                    {perms.isSuperAdmin && <th className="px-6 py-5">Property</th>}
                                    <th className="px-6 py-5">{t('users.status')}</th>
                                    <th className="px-6 py-5 text-center">{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {filteredUsers.map(user => (
                                    <tr key={user.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${user.id === currentUser?.id ? 'bg-amber-50/30' : ''}`}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-hotel-navy text-white flex items-center justify-center text-xs font-bold shadow-sm">
                                                    {user.username.substring(0, 2).toUpperCase()}
                                                </div>
                                                <span className="font-bold text-slate-900 dark:text-white">
                                                    {user.username} 
                                                    {user.id === currentUser?.id && <span className="ml-2 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-black uppercase">You</span>}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {user.roles.map(r => (
                                                    <span key={r} className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-tight border dark:border-slate-600">
                                                        {t(`roles.${r}`)}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        {perms.isSuperAdmin && (
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-black uppercase text-hotel-gold bg-hotel-navy/5 dark:bg-hotel-gold/10 px-2 py-1 rounded">
                                                    {allProperties.find(p => p.id === user.propertyId)?.displayName || allProperties.find(p => p.id === user.propertyId)?.name || 'HQ'}
                                                </span>
                                            </td>
                                        )}
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${user.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                                {t(`statuses.${user.status}`)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => openEditModal(user)} className="p-2 text-primary-600 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/40 rounded-lg transition-all" title={t('edit')}>
                                                    <i className="fas fa-user-edit"></i>
                                                </button>
                                                {user.id !== currentUser?.id && (
                                                    <button onClick={() => handleDelete(user)} className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/40 rounded-lg transition-all" title={t('delete')}>
                                                        <i className="fas fa-trash-alt"></i>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-widest">{editingUser ? t('users.edit') : t('users.add')}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><i className="fas fa-times"></i></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-5 overflow-y-auto custom-scrollbar">
                            <div>
                                <label className={labelClass}>{t('users.username')}</label>
                                <input 
                                    type="text" 
                                    value={formData.username} 
                                    onChange={e => { setFormData(p => ({...p, username: e.target.value})); if (usernameError) setUsernameError(''); }} 
                                    onBlur={e => checkUsernameAvailability(e.target.value)} 
                                    required 
                                    className={`${inputClass} ${usernameError ? 'border-red-500 ring-2 ring-red-100' : ''}`} 
                                    placeholder="Username"
                                />
                                {usernameError && <p className="text-rose-500 text-[10px] font-bold mt-1 uppercase tracking-tight">{usernameError}</p>}
                            </div>
                            
                            {perms.isSuperAdmin && (
                                <div>
                                    <label className={labelClass}>Assign to Property</label>
                                    <select 
                                        value={formData.propertyId} 
                                        onChange={e => setFormData(p => ({...p, propertyId: parseInt(e.target.value)}))} 
                                        className={inputClass}
                                    >
                                        {allProperties.map(prop => (
                                            <option key={prop.id} value={prop.id}>{prop.displayName || prop.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className={labelClass}>{t('users.password')}</label>
                                <input 
                                    type="password" 
                                    value={formData.password} 
                                    onChange={e => setFormData(p => ({...p, password: e.target.value}))} 
                                    placeholder={editingUser ? t('users.passwordPlaceholder') : t('users.password')} 
                                    required={!editingUser} 
                                    className={inputClass} 
                                    autoComplete="new-password"
                                />
                            </div>
                            
                            <div>
                                <label className={labelClass}>{t('users.role')}</label>
                                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 border rounded-xl dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 custom-scrollbar shadow-inner">
                                    {(perms.isSuperAdmin ? SUPER_ROLES : ALL_ROLES).map(role => (
                                        <label key={role} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${formData.roles.includes(role) ? 'bg-white dark:bg-slate-800 shadow-sm ring-1 ring-hotel-gold/30' : 'hover:bg-white dark:hover:bg-slate-800'}`}>
                                            <input 
                                                type="checkbox" 
                                                checked={formData.roles.includes(role)} 
                                                onChange={() => handleToggleRole(role)} 
                                                className="w-4 h-4 text-hotel-gold rounded border-slate-300 focus:ring-hotel-gold" 
                                            />
                                            <span className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-200 tracking-tight">{t(`roles.${role}`)}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            
                            <div>
                                <label className={labelClass}>{t('users.status')}</label>
                                <select 
                                    value={formData.status} 
                                    onChange={e => setFormData(p => ({...p, status: e.target.value as any}))} 
                                    className={inputClass}
                                >
                                    <option value="active">{t('statuses.active')}</option>
                                    <option value="inactive">{t('statuses.inactive')}</option>
                                </select>
                            </div>
                        </form>
                        
                        <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50/50">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-slate-500 font-black uppercase text-[10px] tracking-widest">{t('cancel')}</button>
                            <button 
                                onClick={handleSubmit} 
                                disabled={isSubmitting || !!usernameError} 
                                className="px-10 py-2.5 bg-primary-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:brightness-110 shadow-xl disabled:opacity-50 transition-all active:scale-95"
                            >
                                {isSubmitting ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-save mr-2"></i>} 
                                {t('save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UsersPage;
