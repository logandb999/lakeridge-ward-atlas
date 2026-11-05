import React, { useState, useMemo } from 'react';
import { Property, FilterState, WardRole } from '../types';
import { computePropertyStatus, getStatusTheme, formatDueDateLabel } from '../services/storageService';
import { getRoleLabel } from '../data/roles';
import {
  Search,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  Key,
  Filter,
  ArrowRight,
  Home
} from 'lucide-react';

interface PropertyDirectoryProps {
  properties: Property[];
  onSelectProperty: (propertyId: string) => void;
  onNavigateToMap: () => void;
  onOpenAddProperty?: () => void;
}

export const PropertyDirectory: React.FC<PropertyDirectoryProps> = ({
  properties,
  onSelectProperty,
  onNavigateToMap,
  onOpenAddProperty,
}) => {
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState<'all' | 'North Ridge' | 'Lakeside East' | 'Timberline' | 'Meadowview'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredProperties = useMemo(() => {
    return properties.filter(p => {
      // Zone filter
      if (zoneFilter !== 'all' && p.zone !== zoneFilter) return false;

      // Status filter
      const status = computePropertyStatus(p);
      if (statusFilter !== 'all' && status !== statusFilter) return false;

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchAddress = p.address.toLowerCase().includes(q);
        const matchUnit = p.unit?.toLowerCase().includes(q);
        const matchOccupant = p.occupantSummary.toLowerCase().includes(q);
        const matchNotes = p.generalNotes?.toLowerCase().includes(q) || p.accessNotes?.toLowerCase().includes(q);
        const matchTags = p.tags.some(t => t.toLowerCase().includes(q));
        if (!matchAddress && !matchUnit && !matchOccupant && !matchNotes && !matchTags) {
          return false;
        }
      }

      return true;
    });
  }, [properties, search, zoneFilter, statusFilter]);

  const handleSelect = (propertyId: string) => {
    onSelectProperty(propertyId);
    onNavigateToMap();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Header & Filter Controls */}
      <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Ward Residential Directory
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Physical address records, occupancy status, access notes, and visit history.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search addresses, occupants, tags..."
                className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {onOpenAddProperty && (
              <button
                onClick={onOpenAddProperty}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs flex items-center gap-1.5 transition-all shrink-0"
              >
                <span>+ Add Address</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Zone Selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-medium text-slate-500">Zone:</span>
            <select
              value={zoneFilter}
              onChange={e => setZoneFilter(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Zones (4)</option>
              <option value="North Ridge">North Ridge</option>
              <option value="Lakeside East">Lakeside East</option>
              <option value="Timberline">Timberline</option>
              <option value="Meadowview">Meadowview</option>
            </select>
          </div>

          {/* Status Selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-medium text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="overdue">Overdue Follow-up</option>
              <option value="due_soon">Due This Week</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="no_action">In Good Standing</option>
            </select>
          </div>

          <span className="text-xs text-slate-400 ml-auto">
            Showing <strong className="text-slate-800 dark:text-white tabular-nums">{filteredProperties.length}</strong> of {properties.length} properties
          </span>
        </div>
      </div>

      {/* Directory Grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {filteredProperties.length === 0 ? (
          properties.length === 0 ? (
            <div className="py-20 px-4 text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center mx-auto mb-4 text-blue-600 dark:text-blue-400">
                <MapPin className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                No Residential Records Yet
              </h2>
              <p className="text-xs text-slate-500 mt-1 mb-6 leading-relaxed">
                All sample data has been removed. You have a clean atlas ready for your ward&apos;s real residential addresses.
              </p>
              {onOpenAddProperty && (
                <button
                  onClick={onOpenAddProperty}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors"
                >
                  + Add First Residential Address
                </button>
              )}
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-slate-400">
              No addresses match your active search and filter criteria.
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProperties.map(property => {
              const status = computePropertyStatus(property);
            const theme = getStatusTheme(status);
            const pending = property.followUps.filter(f => f.status === 'pending');

            return (
              <div
                key={property.id}
                onClick={() => handleSelect(property.id)}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  {/* Top metadata strip */}
                  <div className="flex items-center justify-between gap-2 mb-2 text-xs">
                    <span className={`font-semibold px-2 py-0.5 rounded ${theme.badgeBg}`}>
                      {theme.label}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {property.parcelNumber}
                    </span>
                  </div>

                  {/* Address */}
                  <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {property.address}
                  </h3>
                  {property.unit && (
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {property.unit}
                    </p>
                  )}

                  {/* Occupant */}
                  <div className="mt-2.5 flex items-start gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{property.occupantSummary}</span>
                  </div>

                  {/* Access note if any */}
                  {property.accessNotes && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
                      <Key className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span className="line-clamp-1 italic">{property.accessNotes}</span>
                    </div>
                  )}

                  {/* Tags */}
                  {property.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {property.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        >
                          {tag}
                        </span>
                      ))}
                      {property.tags.length > 3 && (
                        <span className="text-[10px] text-slate-400 self-center">
                          +{property.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Footer Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <strong className="text-slate-800 dark:text-slate-200">{pending.length}</strong> follow-ups
                    </span>
                    <span>·</span>
                    <span>
                      <strong className="text-slate-800 dark:text-slate-200">{property.visitLogs.length}</strong> visits
                    </span>
                  </div>

                  <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <span>View</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
};
