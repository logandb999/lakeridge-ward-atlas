import React, { useState } from 'react';
import { Property, WardRole, FollowUpPriority } from '../types';
import { WARD_ROLES } from '../data/roles';
import { getTodayDateString } from '../services/storageService';
import { X, Calendar, Flag, UserCheck, AlertTriangle } from 'lucide-react';

interface AddFollowUpModalProps {
  property: Property;
  currentRole: WardRole;
  currentUserName: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    assignedRole: WardRole;
    assignedToName?: string;
    dueDate: string;
    priority: FollowUpPriority;
    status: 'pending';
  }) => void;
}

export const AddFollowUpModal: React.FC<AddFollowUpModalProps> = ({
  property,
  currentRole,
  currentUserName,
  isOpen,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  const defaultRole: WardRole = currentRole !== 'all' ? currentRole : 'bishopric';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedRole, setAssignedRole] = useState<WardRole>(defaultRole);
  const [assignedToName, setAssignedToName] = useState(currentUserName);

  // Default due date: 5 days from today
  const [dueDate, setDueDate] = useState(() => {
    const today = new Date(getTodayDateString() + 'T12:00:00');
    today.setDate(today.getDate() + 5);
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });

  const [priority, setPriority] = useState<FollowUpPriority>('normal');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a follow-up action title.');
      return;
    }

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      assignedRole,
      assignedToName: assignedToName.trim() || undefined,
      dueDate,
      priority,
      status: 'pending',
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
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Create Follow-Up
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

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Action Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => {
                setTitle(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g., Deliver welcome package & directory"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Responsible Organization / Role */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Responsible Role
              </label>
              <select
                value={assignedRole}
                onChange={e => setAssignedRole(e.target.value as WardRole)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {WARD_ROLES.filter(r => r.id !== 'all').map(role => (
                  <option key={role.id} value={role.id}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Assignee Name (Optional)
              </label>
              <input
                type="text"
                value={assignedToName}
                onChange={e => setAssignedToName(e.target.value)}
                placeholder="e.g., Sister Rostova"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Due Date & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Due Date</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5 text-slate-500" />
                <span>Priority</span>
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as FollowUpPriority)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="urgent">Urgent</option>
                <option value="normal">Normal</option>
                <option value="low">Low Priority / Background</option>
              </select>
            </div>
          </div>

          {/* Description / Specific instructions */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Coordination Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Specific details, dietary preferences, best times to knock, or coordination notes..."
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Action buttons */}
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
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-xl shadow-sm transition-all"
            >
              Create Follow-Up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
