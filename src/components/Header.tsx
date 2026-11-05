import React from 'react';
import { UserAccount } from '../types';
import {
  MapPin,
  Clock,
  BookOpen,
  Info,
  ChevronDown,
  User,
  ShieldCheck,
  Compass
} from 'lucide-react';

interface HeaderProps {
  currentView: 'map' | 'follow_ups' | 'directory';
  onViewChange: (view: 'map' | 'follow_ups' | 'directory') => void;
  currentUser: UserAccount;
  pendingCount: number;
  overdueCount: number;
  totalProperties: number;
  onOpenGuide: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  currentUser,
  pendingCount,
  overdueCount,
  totalProperties,
  onOpenGuide,
}) => {

  return (
    <header className="h-16 px-4 sm:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0 z-30">
      {/* Zone 1: Wordmark & Quiet Prototype Label */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => onViewChange('map')}
          className="flex items-center gap-2.5 text-left group"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs group-hover:bg-blue-700 transition-colors">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-none">
              Lakeridge Ward Atlas
            </div>
            <div className="text-[10px] text-slate-500 font-medium mt-0.5">
              Residential Coordination
            </div>
          </div>
        </button>

        {/* Demo Pill indicator */}
        <button
          onClick={onOpenGuide}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-lg hover:bg-amber-100 transition-colors"
          title="Click to view Local Setup Guide and privacy design notes"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span>Fictional Demo</span>
        </button>
      </div>

      {/* Zone 2: Navigation Links (Single-Line, clean) */}
      <nav className="hidden sm:flex items-center gap-1 text-sm font-medium">
        <button
          onClick={() => onViewChange('map')}
          className={`px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
            currentView === 'map'
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
          }`}
        >
          <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Atlas Map</span>
        </button>

        <button
          onClick={() => onViewChange('follow_ups')}
          className={`px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
            currentView === 'follow_ups'
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>Follow-Ups</span>
          {overdueCount > 0 ? (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-bold">
              {overdueCount}
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onViewChange('directory')}
          className={`px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
            currentView === 'directory'
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
          }`}
        >
          <BookOpen className="w-4 h-4 text-slate-500" />
          <span>Addresses ({totalProperties})</span>
        </button>
      </nav>

      {/* Zone 3: Signed-in Account & Guide Action */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs" aria-label={`Signed in as ${currentUser.name}`}>
          <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0">{currentUser.avatarInitials}</div>
          <div className="hidden lg:block truncate max-w-[160px]">
            <div className="font-semibold truncate">{currentUser.name}</div>
            <div className="text-[10px] text-slate-500">{currentUser.roleTitle}</div>
          </div>
        </div>

        {/* Local Run Guide Button */}
        <button
          onClick={onOpenGuide}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
          title="Prototype Info & Local Run Guide"
          aria-label="Help and Local Run Guide"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
