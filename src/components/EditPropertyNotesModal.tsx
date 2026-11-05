import React, { useState } from 'react';
import { Property, OccupantState } from '../types';
import { X, Home, Key, FileText, Tag } from 'lucide-react';

interface EditPropertyNotesModalProps {
  property: Property;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (updates: {
    occupantSummary: string;
    occupantState: OccupantState;
    accessNotes?: string;
    generalNotes?: string;
    tags: string[];
  }) => void;
}

export const EditPropertyNotesModal: React.FC<EditPropertyNotesModalProps> = ({
  property,
  isOpen,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  const [occupantSummary, setOccupantSummary] = useState(property.occupantSummary);
  const [occupantState, setOccupantState] = useState<OccupantState>(property.occupantState);
  const [accessNotes, setAccessNotes] = useState(property.accessNotes || '');
  const [generalNotes, setGeneralNotes] = useState(property.generalNotes || '');
  const [tagsInput, setTagsInput] = useState(property.tags.join(', '));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedTags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    onSubmit({
      occupantSummary: occupantSummary.trim(),
      occupantState,
      accessNotes: accessNotes.trim() || undefined,
      generalNotes: generalNotes.trim() || undefined,
      tags: parsedTags,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Home className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Edit Property Information</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Occupant State */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Current Occupancy Status
            </label>
            <select
              value={occupantState}
              onChange={e => setOccupantState(e.target.value as OccupantState)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="occupied">Occupied (Established Residents)</option>
              <option value="new_move_in">New Move-in (Recently arrived)</option>
              <option value="vacant">Vacant / For Sale / In Transition</option>
              <option value="transient_rental">Rental / Frequent Turnover</option>
            </select>
          </div>

          {/* Occupant Summary */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Occupant Summary / Household Note
            </label>
            <input
              type="text"
              value={occupantSummary}
              onChange={e => setOccupantSummary(e.target.value)}
              placeholder="e.g. Henderson Household (New move-in, 4 children)"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Properties are primary. When residents move, this field is easily updated without altering address history.
            </p>
          </div>

          {/* Access & Physical Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-slate-500" />
              <span>Access & Approach Notes</span>
            </label>
            <textarea
              rows={2}
              value={accessNotes}
              onChange={e => setAccessNotes(e.target.value)}
              placeholder="Gate code, friendly pet, steep driveway in winter, intercom instructions..."
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* General Pastoral / Care Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>General Care / Visit Guidance</span>
            </label>
            <textarea
              rows={3}
              value={generalNotes}
              onChange={e => setGeneralNotes(e.target.value)}
              placeholder="Best visiting hours, language preferences, mobility considerations..."
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-500" />
              <span>Tags (comma-separated)</span>
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="Elderly Care, New Move-in, Youth, Snow Removal Assistance"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

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
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-xl shadow-sm transition-all"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
