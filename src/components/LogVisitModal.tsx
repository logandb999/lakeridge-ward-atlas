import React, { useState } from 'react';
import { Property, WardRole, VisitCategory } from '../types';
import { WARD_ROLES } from '../data/roles';
import { getTodayDateString } from '../services/storageService';
import { X, Calendar, ClipboardCheck, AlertTriangle } from 'lucide-react';

interface LogVisitModalProps {
  property: Property;
  currentRole: WardRole;
  currentUserName: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    date: string;
    visitorName: string;
    visitorRole: WardRole;
    category: VisitCategory;
    summary: string;
  }) => void;
}

export const LogVisitModal: React.FC<LogVisitModalProps> = ({
  property,
  currentRole,
  currentUserName,
  isOpen,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  const defaultRole: WardRole = currentRole !== 'all' ? currentRole : 'ministering';
  const [visitorName, setVisitorName] = useState(currentUserName);
  const [visitorRole, setVisitorRole] = useState<WardRole>(defaultRole);
  const [date, setDate] = useState(getTodayDateString());
  const [category, setCategory] = useState<VisitCategory>('ministering');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) {
      setError('Please provide a brief summary of the visit.');
      return;
    }
    if (!visitorName.trim()) {
      setError('Please enter visitor name.');
      return;
    }

    onSubmit({
      date,
      visitorName: visitorName.trim(),
      visitorRole,
      category,
      summary: summary.trim(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Log Visit or Contact</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-sm">
              {property.address} {property.unit ? `· ${property.unit}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Date & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Visit Date</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Visit Category
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as VisitCategory)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ministering">Ministering Visit</option>
                <option value="welcome_move_in">Welcome Move-in</option>
                <option value="pastoral_visit">Pastoral / Bishopric Visit</option>
                <option value="welfare_check">Welfare / Wellness Check</option>
                <option value="brief_doorstep">Brief Doorstep Interaction</option>
              </select>
            </div>
          </div>

          {/* Visitor Name & Role */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Visitor Name(s) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={visitorName}
                onChange={e => {
                  setVisitorName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Elena Rostova & Sarah Jenkins"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Organization / Role
              </label>
              <select
                value={visitorRole}
                onChange={e => setVisitorRole(e.target.value as WardRole)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {WARD_ROLES.filter(r => r.id !== 'all').map(role => (
                  <option key={role.id} value={role.id}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes / Summary */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Visit Summary / Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={summary}
              onChange={e => {
                setSummary(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Brief summary of interaction, wellbeing check, notes for other ward leaders..."
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Privacy Note */}
          <p className="text-[11px] text-slate-400">
            Note: Records are attached to this physical address property record. Keep descriptions factual, supportive, and privacy-conscious.
          </p>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] rounded-xl shadow-sm transition-all"
            >
              Save Visit Log
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
