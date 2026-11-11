import React, { useState } from 'react';
import { Property, WardRole, FollowUpItem, VisitLog } from '../types';
import { computePropertyStatus, getStatusTheme, formatDueDateLabel } from '../services/storageService';
import { getRoleLabel, getRoleColor } from '../data/roles';
import { AddFollowUpModal } from './AddFollowUpModal';
import { LogVisitModal } from './LogVisitModal';
import { EditPropertyNotesModal } from './EditPropertyNotesModal';
import { HouseholdFlags } from './HouseholdFlags';
import {
  ArrowLeft,
  Plus,
  CheckCircle2,
  Circle,
  Calendar,
  Clock,
  MapPin,
  Key,
  FileText,
  User,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp,
  Tag,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface PropertyDetailProps {
  property: Property;
  currentRole: WardRole;
  currentUserName: string;
  onClose: () => void;
  showBackButton?: boolean;
  onAddFollowUp: (propertyId: string, item: Omit<FollowUpItem, 'id' | 'createdAt' | 'propertyId'>) => void;
  onToggleFollowUp: (propertyId: string, followUpId: string) => void;
  onDeleteFollowUp: (propertyId: string, followUpId: string) => void;
  onAddVisitLog: (propertyId: string, log: Omit<VisitLog, 'id'>) => void;
  onUpdateNotes: (propertyId: string, updates: Partial<Property>) => void;
}

export const PropertyDetail: React.FC<PropertyDetailProps> = ({
  property,
  currentRole,
  currentUserName,
  onClose,
  showBackButton = true,
  onAddFollowUp,
  onToggleFollowUp,
  onDeleteFollowUp,
  onAddVisitLog,
  onUpdateNotes,
}) => {
  const [showAddFollowUp, setShowAddFollowUp] = useState(false);
  const [showLogVisit, setShowLogVisit] = useState(false);
  const [showEditNotes, setShowEditNotes] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const status = computePropertyStatus(property);
  const theme = getStatusTheme(status);

  const pendingFollowUps = property.followUps.filter(f => f.status === 'pending');
  const completedFollowUps = property.followUps.filter(f => f.status === 'completed');

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
      {/* Top Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {/* Status indicator unboxed text */}
            <div className="flex items-center gap-2 mb-1.5 text-xs">
              <span className={`font-semibold px-2 py-0.5 rounded ${theme.badgeBg}`}>
                {theme.label}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500 dark:text-slate-400 font-medium">{property.zone}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">{property.parcelNumber}</span>
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug truncate">
              {property.address}
            </h2>
            {property.unit && (
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {property.unit}
              </p>
            )}
          </div>

          {showBackButton && (
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors shrink-0"
              aria-label="Back to map"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
        </div>

        <HouseholdFlags property={property} />
        {/* Quick Action Ribbon */}
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => setShowAddFollowUp(true)}
            className="flex-1 min-h-[44px] px-3 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Follow-Up</span>
          </button>
          <button
            onClick={() => setShowLogVisit(true)}
            className="flex-1 min-h-[44px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Log Visit</span>
          </button>
        </div>
      </div>

      {/* Scrollable Content Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
        {/* Occupant & Property Context Card */}
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Current Household & Occupancy</span>
            </div>
            <button
              onClick={() => setShowEditNotes(true)}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <Edit2 className="w-3 h-3" />
              <span>Edit</span>
            </button>
          </div>

          <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
            {property.occupantSummary}
          </p>

          {/* Tags */}
          {property.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              {property.tags.map(tag => (
                <span
                  key={tag}
                  className="text-[11px] font-medium px-2 py-0.5 rounded bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Access & Approach Notes */}
          {property.accessNotes && (
            <div className="pt-2.5 mt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
              <Key className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-200">Access: </span>
                <span>{property.accessNotes}</span>
              </div>
            </div>
          )}

          {/* General Notes */}
          {property.generalNotes && (
            <div className="pt-2 mt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
              <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-200">Coordination Notes: </span>
                <span>{property.generalNotes}</span>
              </div>
            </div>
          )}
        </div>

        {/* --- Active Follow-Ups Section --- */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Pending Follow-ups</span>
              <span className="text-xs font-normal text-slate-400 ml-1">
                ({pendingFollowUps.length})
              </span>
            </h3>

            <button
              onClick={() => setShowAddFollowUp(true)}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-0.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>

          {pendingFollowUps.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-900/50">
              No pending follow-ups for this address.
            </div>
          ) : (
            <div className="space-y-2.5">
              {pendingFollowUps.map(item => {
                const dueDateFormatted = formatDueDateLabel(item.dueDate);
                const isOverdue = dueDateFormatted.includes('overdue');
                const isUrgent = item.priority === 'urgent';

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <button
                        onClick={() => onToggleFollowUp(property.id, item.id)}
                        className="mt-0.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shrink-0"
                        title="Mark Completed"
                        aria-label="Mark task completed"
                      >
                        <Circle className="w-5 h-5" />
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                            {item.title}
                          </h4>

                          <button
                            onClick={() => onDeleteFollowUp(property.id, item.id)}
                            className="text-slate-300 hover:text-rose-500 transition-colors shrink-0 p-1"
                            title="Delete follow-up"
                            aria-label="Delete follow-up"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {item.description && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 leading-relaxed">
                            {item.description}
                          </p>
                        )}

                        {/* Unboxed Metadata row */}
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span
                            className="font-medium px-1.5 py-0.5 rounded text-[10px]"
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
                          <span className={`font-semibold ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}`}>
                            {dueDateFormatted}
                          </span>

                          {isUrgent && (
                            <>
                              <span className="text-slate-300 dark:text-slate-700">·</span>
                              <span className="text-rose-600 dark:text-rose-400 font-bold uppercase text-[9px] tracking-wide">
                                Urgent
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Completed follow-ups toggle */}
          {completedFollowUps.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
              >
                {showCompleted ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>
                  {showCompleted ? 'Hide' : 'Show'} completed items ({completedFollowUps.length})
                </span>
              </button>

              {showCompleted && (
                <div className="mt-2 space-y-2">
                  {completedFollowUps.map(item => (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-start gap-3 opacity-75"
                    >
                      <button
                        onClick={() => onToggleFollowUp(property.id, item.id)}
                        className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                        title="Mark Pending"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <div className="flex-1 min-w-0 text-xs">
                        <div className="font-medium text-slate-600 dark:text-slate-300 line-through">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Completed {item.completedBy ? `by ${item.completedBy}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- Recent Activity & Visit Timeline --- */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Visit History & Notes</span>
              <span className="text-xs font-normal text-slate-400 ml-1">
                ({property.visitLogs.length})
              </span>
            </h3>

            <button
              onClick={() => setShowLogVisit(true)}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex items-center gap-0.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log</span>
            </button>
          </div>

          {property.visitLogs.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-900/50">
              No recorded visits yet. Log the first contact above.
            </div>
          ) : (
            <div className="relative pl-4 space-y-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
              {property.visitLogs.map(log => (
                <div key={log.id} className="relative group">
                  {/* Timeline dot */}
                  <span className="absolute -left-[19px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900" />

                  <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-2 mb-1 text-xs">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {log.visitorName}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mb-1.5">
                      {getRoleLabel(log.visitorRole)} · {log.category.replace('_', ' ')}
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {log.summary}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AddFollowUpModal
        property={property}
        currentRole={currentRole}
        currentUserName={currentUserName}
        isOpen={showAddFollowUp}
        onClose={() => setShowAddFollowUp(false)}
        onSubmit={item => onAddFollowUp(property.id, item)}
      />

      <LogVisitModal
        property={property}
        currentRole={currentRole}
        currentUserName={currentUserName}
        isOpen={showLogVisit}
        onClose={() => setShowLogVisit(false)}
        onSubmit={log => onAddVisitLog(property.id, log)}
      />

      <EditPropertyNotesModal
        property={property}
        isOpen={showEditNotes}
        onClose={() => setShowEditNotes(false)}
        onSubmit={updates => onUpdateNotes(property.id, updates)}
      />
    </div>
  );
};
