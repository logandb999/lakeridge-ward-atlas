import React, { useState, useMemo } from 'react';
import { Property, WardRole, FollowUpItem } from '../types';
import { formatDueDateLabel, getTodayDateString, getDaysDiffFromToday } from '../services/storageService';
import { getRoleLabel, getRoleColor } from '../data/roles';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Calendar,
  MapPin,
  Search,
  Filter,
  Check,
  ArrowRight
} from 'lucide-react';

interface FollowUpListProps {
  properties: Property[];
  currentRole: WardRole;
  onSelectProperty: (propertyId: string) => void;
  onToggleFollowUp: (propertyId: string, followUpId: string) => void;
  onNavigateToMap: () => void;
  onOpenAddProperty?: () => void;
}

type TabType = 'all_pending' | 'overdue' | 'due_soon' | 'my_role' | 'completed';

export const FollowUpList: React.FC<FollowUpListProps> = ({
  properties,
  currentRole,
  onSelectProperty,
  onToggleFollowUp,
  onNavigateToMap,
  onOpenAddProperty,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('all_pending');
  const [search, setSearch] = useState('');

  // Extract all follow-up items with property context
  const allItems = useMemo(() => {
    const list: Array<FollowUpItem & { propertyAddress: string; propertyUnit?: string; propertyZone: string }> = [];
    properties.forEach(p => {
      p.followUps.forEach(f => {
        list.push({
          ...f,
          propertyAddress: p.address,
          propertyUnit: p.unit,
          propertyZone: p.zone,
        });
      });
    });
    return list;
  }, [properties]);

  // Tab counts
  const counts = useMemo(() => {
    const pending = allItems.filter(i => i.status === 'pending');
    const overdue = pending.filter(i => getDaysDiffFromToday(i.dueDate) < 0);
    const dueSoon = pending.filter(i => {
      const diff = getDaysDiffFromToday(i.dueDate);
      return diff >= 0 && diff <= 7;
    });
    const myRole = pending.filter(i => currentRole === 'all' || i.assignedRole === currentRole);
    const completed = allItems.filter(i => i.status === 'completed');

    return {
      all_pending: pending.length,
      overdue: overdue.length,
      due_soon: dueSoon.length,
      my_role: myRole.length,
      completed: completed.length,
    };
  }, [allItems, currentRole]);

  // Filtered items
  const filteredItems = useMemo(() => {
    let result = allItems;

    // Filter by tab
    if (activeTab === 'all_pending') {
      result = result.filter(i => i.status === 'pending');
    } else if (activeTab === 'overdue') {
      result = result.filter(i => i.status === 'pending' && getDaysDiffFromToday(i.dueDate) < 0);
    } else if (activeTab === 'due_soon') {
      result = result.filter(i => {
        const diff = getDaysDiffFromToday(i.dueDate);
        return i.status === 'pending' && diff >= 0 && diff <= 7;
      });
    } else if (activeTab === 'my_role') {
      result = result.filter(i => i.status === 'pending' && (currentRole === 'all' || i.assignedRole === currentRole));
    } else if (activeTab === 'completed') {
      result = result.filter(i => i.status === 'completed');
    }

    // Filter by search text
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        i =>
          i.title.toLowerCase().includes(q) ||
          i.propertyAddress.toLowerCase().includes(q) ||
          i.assignedToName?.toLowerCase().includes(q) ||
          getRoleLabel(i.assignedRole).toLowerCase().includes(q)
      );
    }

    // Sort by due date (soonest / most overdue first for pending; completedAt for completed)
    return result.sort((a, b) => {
      if (activeTab === 'completed') {
        return (b.completedAt || '').localeCompare(a.completedAt || '');
      }
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [allItems, activeTab, search, currentRole]);

  const handleJumpToProperty = (propertyId: string) => {
    onSelectProperty(propertyId);
    onNavigateToMap();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* View Header */}
      <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Ward Follow-Up Items
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Residential coordination, assignments, and pending visits across all ward organizations.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks, addresses, roles..."
              className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Segmented Filter Control */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setActiveTab('all_pending')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'all_pending'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <span>All Pending</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 dark:text-white text-slate-700">
              {counts.all_pending}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('overdue')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'overdue'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Overdue</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
              {counts.overdue}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('due_soon')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'due_soon'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Due This Week</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
              {counts.due_soon}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('my_role')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'my_role'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300'
            }`}
          >
            <span>Assigned to My Role</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
              {counts.my_role}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'completed'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Completed</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white">
              {counts.completed}
            </span>
          </button>
        </div>
      </div>

      {/* Follow-Up Item List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center max-w-sm mx-auto px-4">
            <CheckCircle2 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">
              {properties.length === 0 ? 'No residential records yet' : 'No follow-ups in this view'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 mb-4 leading-relaxed">
              {properties.length === 0
                ? 'All fake records have been cleared. Add a residential address to create and track visit follow-up items.'
                : activeTab === 'overdue'
                ? 'Great work! No visits or follow-ups are currently overdue.'
                : 'Try switching tabs or searching for a different keyword.'}
            </p>
            {properties.length === 0 && onOpenAddProperty && (
              <button
                onClick={onOpenAddProperty}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                + Add First Address
              </button>
            )}
          </div>
        ) : (
          filteredItems.map(item => {
            const dueDateFormatted = formatDueDateLabel(item.dueDate);
            const isOverdue = dueDateFormatted.includes('overdue');
            const isCompleted = item.status === 'completed';

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                <div className="flex items-start gap-4">
                  {/* Mark complete button */}
                  <button
                    onClick={() => onToggleFollowUp(item.propertyId, item.id)}
                    className="mt-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shrink-0"
                    title={isCompleted ? 'Mark Pending' : 'Mark Completed'}
                    aria-label="Toggle task completion status"
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="w-6 h-6" />
                    )}
                  </button>

                  {/* Task Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                      <h3 className={`text-sm sm:text-base font-semibold text-slate-900 dark:text-white leading-snug ${isCompleted ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
                        {item.title}
                      </h3>

                      {/* Jump to Map Button */}
                      <button
                        onClick={() => handleJumpToProperty(item.propertyId)}
                        className="self-start sm:self-auto min-h-[36px] px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
                        title="Focus on Atlas Map"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>View on Map</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    {item.description && (
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
                        {item.description}
                      </p>
                    )}

                    {/* Metadata strip */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {/* Property Address */}
                      <button
                        onClick={() => handleJumpToProperty(item.propertyId)}
                        className="font-semibold text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1 truncate max-w-xs"
                      >
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>
                          {item.propertyAddress} {item.propertyUnit ? `· ${item.propertyUnit}` : ''}
                        </span>
                      </button>

                      <span className="text-slate-300 dark:text-slate-700">·</span>

                      {/* Organization / Role */}
                      <span
                        className="font-medium px-2 py-0.5 rounded text-[11px]"
                        style={{
                          backgroundColor: `${getRoleColor(item.assignedRole)}15`,
                          color: getRoleColor(item.assignedRole),
                        }}
                      >
                        {getRoleLabel(item.assignedRole)}
                      </span>

                      {item.assignedToName && (
                        <>
                          <span className="text-slate-300 dark:text-slate-700">·</span>
                          <span className="text-slate-600 dark:text-slate-300 font-medium">
                            {item.assignedToName}
                          </span>
                        </>
                      )}

                      <span className="text-slate-300 dark:text-slate-700">·</span>

                      {/* Due date */}
                      <span className={`font-semibold ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {dueDateFormatted}
                      </span>

                      {item.priority === 'urgent' && !isCompleted && (
                        <>
                          <span className="text-slate-300 dark:text-slate-700">·</span>
                          <span className="text-rose-600 dark:text-rose-400 font-bold uppercase text-[10px] tracking-wide">
                            Urgent
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
