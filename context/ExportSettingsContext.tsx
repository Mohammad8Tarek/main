import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { defaultLogoBase64 } from '../logo';

export interface ExportSettings {
    customLogo: string | null;
    headerColor: string;
}

export const defaultSettings: ExportSettings = {
    customLogo: null,
    headerColor: '#2563eb',
};

interface ExportSettingsContextType {
  settings: ExportSettings;
  setSettings: React.Dispatch<React.SetStateAction<ExportSettings>>;
  saveSettings: (newSettings: ExportSettings) => void;
  resetSettings: () => void;
}

const ExportSettingsContext = createContext<ExportSettingsContextType | undefined>(undefined);

export const ExportSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<ExportSettings>(defaultSettings);
    const storageKey = `export_settings`;

    useEffect(() => {
        try {
            const savedSettings = localStorage.getItem(storageKey);
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                // Ensure customLogo has the default if it was cleared
                setSettings({ ...defaultSettings, ...parsed });
            } else {
                setSettings(defaultSettings);
            }
        } catch (error) {
            console.error("Failed to load export settings:", error);
            setSettings(defaultSettings);
        }
    }, []);

    const saveSettings = (newSettings: ExportSettings) => {
        try {
            setSettings(newSettings);
            localStorage.setItem(storageKey, JSON.stringify(newSettings));
        } catch (error) {
            console.error("Failed to save export settings:", error);
        }
    };
    
    const resetSettings = () => {
        localStorage.removeItem(storageKey);
        setSettings(defaultSettings);
    }

    return (
        <ExportSettingsContext.Provider value={{ settings, setSettings: saveSettings, saveSettings, resetSettings }}>
            {children}
        </ExportSettingsContext.Provider>
    );
};

export const useExportSettings = (): ExportSettingsContextType => {
    const context = useContext(ExportSettingsContext);
    if (context === undefined) {
        throw new Error('useExportSettings must be used within an ExportSettingsProvider');
    }
    return context;
};