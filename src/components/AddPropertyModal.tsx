import React, { useState } from 'react';
import { Property, PropertyCoordinates, OccupantState } from '../types';
import { X, MapPin, Home, Key, FileText, Tag, AlertTriangle } from 'lucide-react';

interface AddPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCoords?: { lat: number; lng: number };
  onSubmit: (data: {
    address: string;
    unit?: string;
    zone: Property['zone'];
    parcelNumber: string;
    coordinates: PropertyCoordinates;
    occupantSummary: string;
    occupantState: OccupantState;
    accessNotes?: string;
    generalNotes?: string;
    tags: string[];
  }) => void;
}

export const AddPropertyModal: React.FC<AddPropertyModalProps> = ({
  isOpen,
  onClose,
  defaultCoords,
  onSubmit,
}) => {
  const [address, setAddress] = useState('');
  const [unit, setUnit] = useState('');
  const [zone, setZone] = useState<Property['zone']>('Unassigned');
  const [parcelNumber, setParcelNumber] = useState(`LR-${Math.floor(100 + Math.random() * 900)}`);
  const [lat, setLat] = useState(defaultCoords?.lat ? defaultCoords.lat.toFixed(5) : '40.3765');
  const [lng, setLng] = useState(defaultCoords?.lng ? defaultCoords.lng.toFixed(5) : '-111.7575');
  const [occupantSummary, setOccupantSummary] = useState('');
  const [occupantState, setOccupantState] = useState<OccupantState>('occupied');
  const [accessNotes, setAccessNotes] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) {
      setError('Please provide a residential street address.');
      return;
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      setError('Please enter valid numeric latitude and longitude coordinates.');
      return;
    }

    // Convert lat/lng to approximate 0-1000 svg coordinates for vector fallback
    // Ward center ~40.3765, -111.7575 maps to 500, 400
    const xCoord = Math.min(Math.max(Math.round(500 + (longitude - (-111.7575)) * 12000), 50), 950);
    const yCoord = Math.min(Math.max(Math.round(400 - (latitude - 40.3765) * 12000), 50), 750);

    const parsedTags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    onSubmit({
      address: address.trim(),
      unit: unit.trim() || undefined,
      zone,
      parcelNumber: parcelNumber.trim() || `LR-${Math.floor(100 + Math.random() * 900)}`,
      coordinates: {
        x: xCoord,
        y: yCoord,
        lat: latitude,
        lng: longitude,
      },
      occupantSummary: occupantSummary.trim() || 'Resident',
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
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Add Residential Address</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Create a new physical property record in the ward atlas.
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
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Street Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Street Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={e => {
                setAddress(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. 1420 Lakeridge Crest Dr"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Unit / Apt & Zone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Unit / Apt (Optional)
              </label>
              <input
                type="text"
                value={unit}
                onChange={e => setUnit(e.target.value)}
                placeholder="e.g. Unit 4B"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Ward Zone
              </label>
              <select
                value={zone}
                onChange={e => setZone(e.target.value as any)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="North Ridge">North Ridge</option>
                <option value="Lakeside East">Lakeside East</option>
                <option value="Timberline">Timberline</option>
                <option value="Meadowview">Meadowview</option>
                <option value="Unassigned">Unassigned</option>
              </select>
            </div>
          </div>

          {/* Coordinates (Lat / Lng) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Latitude
              </label>
              <input
                type="text"
                value={lat}
                onChange={e => setLat(e.target.value)}
                placeholder="40.3765"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Longitude
              </label>
              <input
                type="text"
                value={lng}
                onChange={e => setLng(e.target.value)}
                placeholder="-111.7575"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Household / Occupant Summary */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Household Note / Current Occupant
            </label>
            <input
              type="text"
              value={occupantSummary}
              onChange={e => setOccupantSummary(e.target.value)}
              placeholder="e.g. Miller Household (Renters, moved in Oct)"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Access Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-slate-500" />
              <span>Access & Approach Notes (Optional)</span>
            </label>
            <textarea
              rows={2}
              value={accessNotes}
              onChange={e => setAccessNotes(e.target.value)}
              placeholder="Gate code, steep drive, dogs, intercom code, best hours..."
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* General Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Care & Visit Notes (Optional)</span>
            </label>
            <textarea
              rows={2}
              value={generalNotes}
              onChange={e => setGeneralNotes(e.target.value)}
              placeholder="Support notes, special considerations, or visiting preferences..."
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
              placeholder="New Move-in, Elderly Care, Youth"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              Add Property
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
