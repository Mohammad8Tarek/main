import React, { useState, useRef, useEffect } from 'react';
import { useExportSettings, ExportSettings, defaultSettings } from '../../context/ExportSettingsContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { defaultLogoBase64 } from '../../logo';

interface ExportSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ExportSettingsModal: React.FC<ExportSettingsModalProps> = ({ isOpen, onClose }) => {
    const { settings, saveSettings, resetSettings } = useExportSettings();
    const [localSettings, setLocalSettings] = useState<ExportSettings>(settings);
    const { t } = useLanguage();
    const { showToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings, isOpen]);
    
    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 500 * 1024) { // 500KB limit
            showToast(t('settings.logoSizeError'), 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setLocalSettings(prev => ({ ...prev, customLogo: reader.result as string }));
        };
        reader.readAsDataURL(file);
    };
    
    const handleSave = () => {
        saveSettings(localSettings);
        showToast(t('settings.saved'), 'success');
        onClose();
    };

    const handleReset = () => {
        resetSettings();
        setLocalSettings(defaultSettings);
        showToast(t('settings.reset'), 'info');
    }
    
    const formInputClass = "w-full p-2 border border-slate-300 rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-200";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('settings.title')}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <i className="fas fa-times text-xl"></i>
                    </button>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">{t('settings.description')}</p>
                <div className="space-y-6">
                    {/* Custom Logo */}
                    <div>
                        <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">{t('settings.customLogo.label')}</label>
                        <div className="flex items-center gap-4">
                            <img src={localSettings.customLogo || defaultLogoBase64} alt="Logo Preview" className="w-16 h-16 object-contain border rounded-md p-1 dark:border-slate-600 bg-slate-50 dark:bg-slate-700"/>
                            <div className="flex flex-col gap-2">
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 text-sm bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 rounded">{t('settings.customLogo.upload')}</button>
                                {localSettings.customLogo && <button type="button" onClick={() => setLocalSettings(p => ({...p, customLogo: null}))} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 rounded">{t('settings.customLogo.remove')}</button>}
                            </div>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg" className="hidden" />
                        </div>
                    </div>

                    {/* Header Color */}
                    <div>
                        <label htmlFor="headerColor" className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">{t('settings.headerColor')}</label>
                        <div className="flex items-center gap-2">
                             <input id="headerColor" type="color" value={localSettings.headerColor} onChange={e => setLocalSettings(p => ({...p, headerColor: e.target.value}))} className="p-1 h-10 w-14 block bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 cursor-pointer rounded-lg disabled:opacity-50 disabled:pointer-events-none"/>
                             <input type="text" value={localSettings.headerColor} onChange={e => setLocalSettings(p => ({...p, headerColor: e.target.value}))} className={`${formInputClass} w-32`}/>
                        </div>
                    </div>
                </div>
                 <div className="flex justify-between items-center mt-8">
                    <button onClick={handleReset} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">{t('settings.resetButton')}</button>
                    <div className="flex gap-4">
                        <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 rounded">{t('cancel')}</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">{t('save')}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExportSettingsModal;
