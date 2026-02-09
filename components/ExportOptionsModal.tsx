import React from 'react';
import { useLanguage } from '../context/LanguageContext';

interface ExportOptionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExportPdf: () => void;
    onExportExcel: () => void;
    isPdfExporting: boolean;
    isExcelExporting: boolean;
}

const ExportOptionsModal: React.FC<ExportOptionsModalProps> = ({
    isOpen,
    onClose,
    onExportPdf,
    onExportExcel,
    isPdfExporting,
    isExcelExporting,
}) => {
    const { t } = useLanguage();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 dark:bg-primary-900 mb-4">
                    <i className="fas fa-file-export text-2xl text-primary-600 dark:text-primary-400"></i>
                </div>
                <h3 className="text-lg font-medium leading-6 text-slate-900 dark:text-white mb-2">{t('exportOptions.title')}</h3>
                <div className="mt-6 space-y-4">
                    <button
                        type="button"
                        onClick={onExportPdf}
                        disabled={isPdfExporting || isExcelExporting}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                        {isPdfExporting ? (
                            <><i className="fas fa-spinner fa-spin"></i> {t('exporting')}</>
                        ) : (
                            <><i className="fas fa-file-pdf"></i> {t('exportOptions.exportAsPdf')}</>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={onExportExcel}
                        disabled={isPdfExporting || isExcelExporting}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                        {isExcelExporting ? (
                            <><i className="fas fa-spinner fa-spin"></i> {t('exporting')}</>
                        ) : (
                            <><i className="fas fa-file-excel"></i> {t('exportOptions.exportAsExcel')}</>
                        )}
                    </button>
                </div>
                <div className="mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isPdfExporting || isExcelExporting}
                        className="w-full px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 disabled:opacity-50"
                    >
                        {t('cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportOptionsModal;
