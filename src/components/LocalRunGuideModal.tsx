import React, { useState } from 'react';
import { Property } from '../types';
import { storageService } from '../services/storageService';
import { HouseholdImportPanel } from './HouseholdImportPanel';
import {
  X,
  Terminal,
  ShieldCheck,
  RefreshCw,
  Download,
  Info,
  Check,
  AlertCircle
} from 'lucide-react';

interface LocalRunGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearAll: () => void;
  onLoadSampleData: () => void;
  onDataReload?: () => void;
  properties: Property[];
}

export const LocalRunGuideModal: React.FC<LocalRunGuideModalProps> = ({
  isOpen,
  onClose,
  onClearAll,
  onLoadSampleData,
  onDataReload,
  properties,
}) => {
  const [copied, setCopied] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [sampleConfirm, setSampleConfirm] = useState(false);
  if (!isOpen) return null;

  const localRunCode = `# 1. Install project dependencies
npm install

# 2. Start the local Vite development server
npm run dev

# 3. Open your browser
# Visit http://localhost:3001 (or port reported by Vite)`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(localRunCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    const json = storageService.exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lakeridge_ward_atlas_data_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Data & Setup
              </h3>
              <p className="text-xs text-slate-500">
                Lakeridge Ward Atlas
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close guide modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Fictional Data & Architecture Disclaimer */}
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>Private Ward Atlas</span>
            </div>
            <p className="leading-relaxed">
              Household records are shared with the authorized leaders who can access this app.
            </p>
            <p className="leading-relaxed font-medium">
              Keep household names and occupancy details current. Families sharing an address remain separate records until their occupancy has been verified.
            </p>
          </div>

          {/* Running the Exported Project Locally */}
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
              <Terminal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>How to Run Locally</span>
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
              To run this application on your local machine using Node.js:
            </p>

            <div className="relative rounded-xl bg-slate-900 text-slate-100 p-4 font-mono text-xs">
              <button
                onClick={handleCopyCode}
                className="absolute top-3 right-3 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] rounded-lg border border-slate-700 flex items-center gap-1 transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : null}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <pre className="overflow-x-auto">{localRunCode}</pre>
            </div>
          </div>

          {/* Data Persistence, Reset & Backup */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Data Management & Persistence
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Visits, follow-ups, and notes are saved to the shared database ({properties.length} records currently active). Imports add new households and preserve existing records. Clearing records and loading samples replace the shared atlas for all leaders.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              {/* Clear All Records Button */}
              {!clearConfirm ? (
                <button
                  onClick={() => setClearConfirm(true)}
                  className="px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Clear All Records ({properties.length})</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 p-1.5 bg-rose-50 dark:bg-rose-950/50 rounded-xl border border-rose-200 dark:border-rose-900">
                  <span className="text-xs text-rose-700 dark:text-rose-300 font-medium px-2">
                    Clear all {properties.length} addresses?
                  </span>
                  <button
                    onClick={() => {
                      onClearAll();
                      setClearConfirm(false);
                      onClose();
                    }}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                  >
                    Yes, Clear All
                  </button>
                  <button
                    onClick={() => setClearConfirm(false)}
                    className="px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Optional Load Sample Data Button */}
              {!sampleConfirm ? (
                <button
                  onClick={() => setSampleConfirm(true)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <span>Load Sample Data</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 p-1.5 bg-blue-50 dark:bg-blue-950/50 rounded-xl border border-blue-200 dark:border-blue-900">
                  <span className="text-xs text-blue-700 dark:text-blue-300 font-medium px-2">
                    Load 18 fictional properties?
                  </span>
                  <button
                    onClick={() => {
                      onLoadSampleData();
                      setSampleConfirm(false);
                      onClose();
                    }}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => setSampleConfirm(false)}
                    className="px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Export JSON */}
              <button
                onClick={handleExport}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON Backup</span>
              </button>

            </div>
            <HouseholdImportPanel />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 rounded-xl transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
