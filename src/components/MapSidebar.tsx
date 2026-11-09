import React from 'react';
import { Property, FilterState, WardRole } from '../types';
import { computePropertyStatus, getStatusTheme, formatDueDateLabel } from '../services/storageService';
import { WARD_ROLES, getRoleLabel } from '../data/roles';
import {
  Search,
  Filter,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  Compass,
  ArrowRight
} from 'lucide-react';

interface MapSidebarProps {
  properties: Property[];
  filter: FilterState;
  onFilterChange: (updates: Partial<FilterState>) => void;
  onSelectProperty: (id: string) => void;
  onOpenAddProperty?: () => void;
}

export const MapSidebar: React.FC<MapSidebarProps> = ({
  properties,
  filter,
  onFilterChange,
  onSelectProperty,
  onOpenAddProperty,
}) => {
  // Count by status
  const statusCounts = React.useMemo(() => {
    let overdue = 0;
    let dueSoon = 0;
    let scheduled = 0;
    let completed = 0;
    let noAction = 0;

    properties.forEach(p => {
      const s = computePropertyStatus(p);
      if (s === 'overdue') overdue++;
      else if (s === 'due_soon') dueSoon++;
      else if (s === 'scheduled') scheduled++;
      else if (s === 'completed') completed++;
      else if (s === 'no_action') noAction++;
    });

    return { overdue, dueSoon, scheduled, completed, noAction };
  }, [properties]);

  // Filtered properties
  const filteredList = React.useMemo(() => {
    return properties.filter(p => {
      const s = computePropertyStatus(p);
      if (filter.status !== 'all' && s !== filter.status) return false;
      if (filter.zone !== 'all' && p.zone !== filter.zone) return false;
      if (filter.role !== 'all') {
        const hasRole = p.followUps.some(f => f.status === 'pending' && f.assignedRole === filter.role);
        if (!hasRole) return false;
      }
      if (filter.searchQuery.trim()) {
        const q = filter.searchQuery.toLowerCase();
        const mAddr = p.address.toLowerCase().includes(q);
        const mUnit = p.unit?.toLowerCase().includes(q);
        const mOcc = p.occupantSummary.toLowerCase().includes(q);
        const mTag = p.tags.some(t => t.toLowerCase().includes(q));
        if (!mAddr && !mUnit && !mOcc && !mTag) return false;
      }
      return true;
    });
  }, [properties, filter]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Top Search & Filter Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 shrink-0 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Residential Atlas Navigator
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select or search an address below to coordinate visits.
            </p>
          </div>
          {onOpenAddProperty && (
            <button
              onClick={onOpenAddProperty}
              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shrink-0 shadow-xs flex items-center gap-1 transition-colors"
            >
              <span>+ Add Address</span>
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filter.searchQuery}
            onChange={e => onFilterChange({ searchQuery: e.target.value })}
            placeholder="Search address, family, or tags..."
            className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Secondary filters: Role & Zone */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Filter by Role:
            </label>
            <select
              value={filter.role}
              onChange={e => onFilterChange({ role: e.target.value as WardRole })}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 truncate"
            >
              {WARD_ROLES.map(r => (
                <option key={r.id} value={r.id}>
                  {r.shortLabel}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Filter by Zone:
            </label>
            <select
              value={filter.zone}
              onChange={e => onFilterChange({ zone: e.target.value as any })}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 truncate"
            >
              <option value="all">All Zones</option>
              <option value="Unassigned">Unassigned</option>
              <option value="North Ridge">North Ridge</option>
              <option value="Lakeside East">Lakeside East</option>
              <option value="Timberline">Timberline</option>
              <option value="Meadowview">Meadowview</option>
            </select>
          </div>
        </div>

        {/* Status Pills Tabs (Functional filter buttons) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          <button
            onClick={() => onFilterChange({ status: 'all' })}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filter.status === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-200/70 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            All ({properties.length})
          </button>

          <button
            onClick={() => onFilterChange({ status: 'overdue' })}
            className={`px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
              filter.status === 'overdue'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-600 dark:bg-rose-400" />
            <span>Overdue ({statusCounts.overdue})</span>
          </button>

          <button
            onClick={() => onFilterChange({ status: 'due_soon' })}
            className={`px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
              filter.status === 'due_soon'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Due Soon ({statusCounts.dueSoon})</span>
          </button>

          <button
            onClick={() => onFilterChange({ status: 'no_action' })}
            className={`px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filter.status === 'no_action'
                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                : 'bg-slate-200/70 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            No Action ({statusCounts.noAction})
          </button>
        </div>
      </div>

      {/* Property List in sidebar */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        <div className="text-xs text-slate-400 font-semibold px-1">
          MATCHING ADDRESSES ({filteredList.length})
        </div>

        {filteredList.length === 0 ? (
          properties.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No residential records yet
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto mb-4">
                All fake data has been removed. You can now add your own residential addresses or import records.
              </p>
              {onOpenAddProperty && (
                <button
                  onClick={onOpenAddProperty}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                >
                  + Add First Address
                </button>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              No properties match your current filters.
            </div>
          )
        ) : (
          filteredList.map(property => {
            const status = computePropertyStatus(property);
            const theme = getStatusTheme(status);
            const pending = property.followUps.filter(f => f.status === 'pending');

            return (
              <div
                key={property.id}
                onClick={() => onSelectProperty(property.id)}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-xs transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                    {property.address} {property.unit ? `· ${property.unit}` : ''}
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${theme.badgeBg}`}>
                    {theme.label}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1 mb-2">
                  {property.occupantSummary}
                </p>

                {pending.length > 0 ? (
                  <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
                    <span className="truncate max-w-[170px] text-slate-700 dark:text-slate-300 font-medium">
                      {pending[0].title}
                    </span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                      {formatDueDateLabel(pending[0].dueDate)}
                    </span>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span>In good standing</span>
                    <span>{property.visitLogs.length} previous visits</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
