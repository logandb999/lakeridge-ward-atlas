import React, { useState, useEffect, useMemo } from 'react';
import { Property, FilterState, UserAccount, WardRole, FollowUpItem, VisitLog } from './types';
import { storageService, computePropertyStatus, getTodayDateString, getDaysDiffFromToday } from './services/storageService';
import { AdminPage } from './components/AdminPage';
import { Header } from './components/Header';
import { MapView } from './components/MapView';
import { BudgetedGoogleMap } from './components/BudgetedGoogleMap';
import { MapSidebar } from './components/MapSidebar';
import { PropertyDetail } from './components/PropertyDetail';
import { FollowUpList } from './components/FollowUpList';
import { PropertyDirectory } from './components/PropertyDirectory';
import { LocalRunGuideModal } from './components/LocalRunGuideModal';
import { AddPropertyModal } from './components/AddPropertyModal';
import { LocationReview } from './components/LocationReview';
import { canReviewLocations } from './lib/locationReview';
import {
  MapPin,
  Clock,
  BookOpen,
  X,
  Search,
  Filter,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  Info,
  Plus
} from 'lucide-react';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return (localStorage.getItem('ward-atlas-theme') ?? localStorage.getItem('ward-atlas-map-style')) === 'DARK';
    } catch {
      return false;
    }
  });
  const colorScheme = darkMode ? 'DARK' : 'LIGHT';
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try { localStorage.setItem('ward-atlas-theme', colorScheme); } catch { /* Preference applies for this visit. */ }
  }, [darkMode, colorScheme]);

  // Primary State
  const [properties, setProperties] = useState<Property[]>([]);
  const [sync, setSync] = useState(storageService.getSyncState());
  const [today, setToday] = useState(getTodayDateString());
  const downloadUnsaved = () => {
    const url = URL.createObjectURL(new Blob([storageService.exportData()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `atlas-unsaved-${getTodayDateString()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'map' | 'follow_ups' | 'directory' | 'admin'>('map');
  const [reviewLocations, setReviewLocations] = useState(false);
  const currentUser: UserAccount = {
    id: sync.user?.id ?? '', name: sync.user?.name ?? '', role: 'all', roleTitle: sync.user?.role === 'admin' ? 'Administrator' : 'Regular user',
    avatarInitials: (sync.user?.name ?? '').split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase(),
  };
  const [authError] = useState(() => {
    const errors: Record<string, string> = {
      not_allowed: 'This Google account is not authorized to access the atlas. Choose your authorized account.',
      cancelled: 'Google sign-in was cancelled. You can try again.',
      failed: 'Google sign-in could not be completed. Please try again.',
      unavailable: 'Google sign-in is temporarily unavailable. Please try again.',
    };
    const params = new URLSearchParams(window.location.search);
    const error = params.get('auth_error');
    if (error) { params.delete('auth_error'); window.history.replaceState(null, '', window.location.pathname + (params.size ? `?${params}` : '') + window.location.hash); }
    return error ? errors[error] ?? errors.failed : '';
  });
  const signIn = () => {
    if (!storageService.hasUnsavedChanges() || window.confirm('Sign-in opens a new page. Download any unsaved changes before continuing. Continue to Google?')) window.location.assign('/api/auth/login');
  };
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showAddPropertyModal, setShowAddPropertyModal] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mapMode, setMapMode] = useState<'google' | 'vector'>(GOOGLE_MAPS_API_KEY ? 'google' : 'vector');
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Listen for Google Maps quota exceeded events
  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // Filter State
  const [filter, setFilter] = useState<FilterState>({
    searchQuery: '',
    status: 'all',
    role: 'all',
    zone: 'all',
  });

  // Load properties on initial mount
  useEffect(() => {
    let active = true;
    storageService.loadPropertiesAsync().then(loaded => { if (active) setProperties(loaded); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handleStorageUpdate = () => {
      setProperties([...storageService.loadProperties()]);
      setSync(storageService.getSyncState());
    };
    window.addEventListener('atlas-storage-update', handleStorageUpdate);
    handleStorageUpdate();
    return () => window.removeEventListener('atlas-storage-update', handleStorageUpdate);
  }, []);

  useEffect(() => {
    const checkDate = () => setToday(getTodayDateString());
    const timer = window.setInterval(checkDate, 30000);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (storageService.hasUnsavedChanges()) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('focus', checkDate);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', checkDate);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, []);

  // Recompute date-dependent child filters when the local calendar day changes.
  useEffect(() => { setProperties(items => [...items]); }, [today]);

  // Update filter helper
  const handleFilterChange = (updates: Partial<FilterState>) => {
    setFilter(prev => ({ ...prev, ...updates }));
  };

  // Follow-up & Visit Action Handlers
  const handleAddFollowUp = (propertyId: string, item: Omit<FollowUpItem, 'id' | 'createdAt' | 'propertyId'>) => {
    storageService.addFollowUp(propertyId, item);
    setProperties(storageService.loadProperties());
  };

  const handleToggleFollowUp = (propertyId: string, followUpId: string) => {
    storageService.toggleFollowUpStatus(propertyId, followUpId, currentUser.name);
    setProperties(storageService.loadProperties());
  };

  const handleDeleteFollowUp = (propertyId: string, followUpId: string) => {
    storageService.deleteFollowUp(propertyId, followUpId);
    setProperties(storageService.loadProperties());
  };

  const handleAddVisitLog = (propertyId: string, log: Omit<VisitLog, 'id'>) => {
    storageService.addVisitLog(propertyId, log);
    setProperties(storageService.loadProperties());
  };

  const handleUpdateNotes = (propertyId: string, updates: Partial<Property>) => {
    storageService.updatePropertyNotes(propertyId, updates as any);
    setProperties(storageService.loadProperties());
  };

  const handleAddProperty = (data: Parameters<typeof storageService.addProperty>[0]) => {
    const created = storageService.addProperty(data);
    setProperties(storageService.loadProperties());
    setSelectedPropertyId(created.id);
  };

  const handleClearAll = () => {
    const cleared = storageService.clearAllData();
    setProperties(cleared);
    setSelectedPropertyId(null);
  };

  const handleLoadSampleData = () => {
    const samples = storageService.loadSampleData();
    setProperties(samples);
  };

  // Selected Property Object
  const selectedProperty = useMemo(() => {
    return properties.find(p => p.id === selectedPropertyId) || null;
  }, [properties, selectedPropertyId]);

  // Overall Counts
  const { pendingCount, overdueCount } = useMemo(() => {
    let pending = 0;
    let overdue = 0;
    properties.forEach(p => {
      p.followUps.forEach(f => {
        if (f.status === 'pending') {
          pending++;
          if (getDaysDiffFromToday(f.dueDate) < 0) {
            overdue++;
          }
        }
      });
    });
    return { pendingCount: pending, overdueCount: overdue };
  }, [properties, today]);

  return (
    <>
      <div className="app-shell flex flex-col w-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased overflow-hidden">
        {/* Google Maps Quota Exceeded In-App Banner */}
        {quotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}

        {/* Top Bar Header */}
        {sync.access !== 'ready' && (
          <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/80 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
              <h1 className="text-xl font-semibold">Welcome to Lakeridge Ward Atlas</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Sign in with your authorized Google account to open the atlas.</p>
              <p role="status" className="mt-3 text-sm text-rose-600">{sync.message || authError}</p>
              <button onClick={signIn} disabled={sync.access === 'checking' || !sync.configured} className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-3 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">{sync.access === 'checking' ? 'Checking your session…' : 'Sign in with Google'}</button>
              {sync.status === 'error' && !storageService.hasUnsavedChanges() && <button onClick={() => void storageService.loadPropertiesAsync()} className="mt-3 w-full text-sm underline">Retry connection</button>}
              {storageService.hasUnsavedChanges() && <button onClick={downloadUnsaved} className="mt-3 w-full text-sm underline">Download unsaved changes before signing in</button>}
            </div>
          </div>
        )}
        {sync.access === 'ready' && (
          <div role="status" aria-live="polite" className="shrink-0 border-b border-slate-200 bg-white px-4 py-2 text-xs sm:text-sm dark:border-slate-800 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span>{sync.status === 'saving' ? 'Saving… Keep this page open.' : sync.status === 'loading' ? 'Loading latest records…' : sync.status === 'saved' ? 'Saved to shared database' : 'Changes have not been saved'}</span>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <span className="hidden sm:inline text-xs text-slate-500">{sync.user?.email}</span>
              <button disabled={sync.status !== 'saved'} onClick={() => void storageService.reload()} className="underline disabled:opacity-40">Refresh records</button>
              <button disabled={sync.status !== 'saved'} onClick={() => void storageService.signOut()} className="underline disabled:opacity-40">Sign out</button>
            </div>
          </div>
        )}
        {sync.access === 'ready' && (sync.status === 'error' || sync.status === 'conflict') && (
          <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/80 p-4">
            <div role="alert" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
              <h2 className="text-lg font-semibold">{sync.status === 'conflict' ? 'Newer changes are available' : 'Could not save or connect'}</h2>
              <p className="mt-2 text-sm">{sync.message} Your open changes remain in this tab.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {storageService.hasUnsavedChanges() && <button onClick={downloadUnsaved} className="rounded-lg border px-3 py-2">Download unsaved changes</button>}
                {sync.status !== 'conflict' && storageService.hasUnsavedChanges() && <button onClick={() => void storageService.retrySave()} className="rounded-lg bg-blue-600 px-3 py-2 text-white">Retry save</button>}
                <button onClick={() => {
                  if (!storageService.hasUnsavedChanges() || window.confirm('Loading the latest records replaces unsaved changes in this tab. Download a copy first if you need to keep them. Continue?')) void storageService.reload();
                }} className="rounded-lg border px-3 py-2">Load latest records</button>
              </div>
            </div>
          </div>
        )}
        <div className="contents" inert={sync.access !== 'ready' || ['error', 'conflict', 'loading'].includes(sync.status)}>
        <Header
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode(value => !value)}
          currentView={currentView === 'admin' ? 'map' : currentView}
          onViewChange={view => {
            setCurrentView(view);
            setReviewLocations(false);
          }}
          currentUser={currentUser}
          pendingCount={pendingCount}
          overdueCount={overdueCount}
          totalProperties={properties.length}
          onOpenAdmin={sync.user?.role === 'admin' ? () => setCurrentView('admin') : undefined}
          onOpenGuide={undefined}
        />

        {canReviewLocations(sync.user) && <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
          <button className="text-sm font-semibold text-blue-600" onClick={() => { setCurrentView('map'); setReviewLocations(value => !value); }}>
            {reviewLocations ? 'Back to ward map' : 'Review approximate locations (private)'}
          </button>
        </div>}
        {/* Main Viewport Workspace */}
        <main className="flex-1 min-h-0 min-w-0 relative overflow-hidden flex flex-col">
          {currentView === 'admin' && sync.user?.role === 'admin' && <AdminPage email={sync.user.email} onOpenSetup={() => setShowGuideModal(true)} />}
          {/* --- View 1: Atlas Map (Primary Map-First Screen) --- */}
          {currentView === 'map' && reviewLocations && canReviewLocations(sync.user) && <LocationReview colorScheme={colorScheme} key={sync.user!.email} apiKey={GOOGLE_MAPS_API_KEY} email={sync.user!.email} />}
          {currentView === 'map' && !reviewLocations && (
            <div className="flex-1 min-h-0 min-w-0 flex flex-col lg:flex-row relative overflow-hidden">
              {/* Left/Center: Prominent Interactive Map Area */}
              <div className="flex-1 min-h-0 min-w-0 relative overflow-hidden flex flex-col">
                {/* Mobile Quick Filter Header */}
                <div className="lg:hidden shrink-0 p-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 z-10 flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={filter.searchQuery}
                      onChange={e => handleFilterChange({ searchQuery: e.target.value })}
                      placeholder="Search address or family..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
                    className={`min-h-[36px] px-2.5 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors ${
                      filter.status !== 'all' || filter.zone !== 'all' || filter.role !== 'all'
                        ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                    aria-label="Filter Map Properties"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Filter</span>
                  </button>

                  <button
                    onClick={() => setShowAddPropertyModal(true)}
                    className="min-h-[36px] px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 shadow-xs transition-colors shrink-0"
                    title="Add Residential Address"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>

                {/* Mobile Filter Drawer Dropdown */}
                {mobileFilterOpen && (
                  <div className="lg:hidden shrink-0 max-h-[40%] overflow-y-auto p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10 text-xs space-y-2 animate-in slide-in-from-top duration-150">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-500 font-medium">Status:</span>
                        <select
                          value={filter.status}
                          onChange={e => handleFilterChange({ status: e.target.value as any })}
                          className="w-full mt-0.5 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        >
                          <option value="all">All Statuses</option>
                          <option value="overdue">Overdue Only</option>
                          <option value="due_soon">Due This Week</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="completed">Completed</option>
                          <option value="no_action">In Good Standing</option>
                        </select>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 font-medium">Zone:</span>
                        <select
                          value={filter.zone}
                          onChange={e => handleFilterChange({ zone: e.target.value as any })}
                          className="w-full mt-0.5 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
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

                    <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => {
                          handleFilterChange({ status: 'all', zone: 'all', role: 'all', searchQuery: '' });
                          setMobileFilterOpen(false);
                        }}
                        className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      >
                        Clear all filters
                      </button>
                      <button
                        onClick={() => setMobileFilterOpen(false)}
                        className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}

                {/* Primary Map Engine: Google Maps or Ward GIS Vector Map */}
                <div className="flex-1 min-h-0 relative overflow-hidden">
                {mapMode === 'google' && GOOGLE_MAPS_API_KEY && sync.access === 'ready' ? (
                  <BudgetedGoogleMap
                    apiKey={GOOGLE_MAPS_API_KEY}
                    colorScheme={colorScheme}
                    properties={properties}
                    selectedPropertyId={selectedPropertyId}
                    onSelectProperty={id => setSelectedPropertyId(id)}
                    filter={filter}
                    onToggleMapMode={() => setMapMode('vector')}
                  />
                ) : (
                  <MapView
                    properties={properties}
                    selectedPropertyId={selectedPropertyId}
                    onSelectProperty={id => setSelectedPropertyId(id)}
                    filter={filter}
                    onFilterChange={handleFilterChange}
                    hasGoogleMaps={Boolean(GOOGLE_MAPS_API_KEY)}
                    onToggleMapMode={() => setMapMode('google')}
                  />
                )}
                </div>
              </div>

            {/* Desktop Side Panel: Shows Details if Property is selected, or Navigator Sidebar if none */}
            <div className="hidden lg:block w-[400px] xl:w-[440px] h-full shrink-0">
              {selectedProperty ? (
                <PropertyDetail
                  property={selectedProperty}
                  currentRole={currentUser.role}
                  currentUserName={currentUser.name}
                  onClose={() => setSelectedPropertyId(null)}
                  onAddFollowUp={handleAddFollowUp}
                  onToggleFollowUp={handleToggleFollowUp}
                  onDeleteFollowUp={handleDeleteFollowUp}
                  onAddVisitLog={handleAddVisitLog}
                  onUpdateNotes={handleUpdateNotes}
                />
              ) : (
                <MapSidebar
                  properties={properties}
                  filter={filter}
                  onFilterChange={handleFilterChange}
                  onSelectProperty={id => setSelectedPropertyId(id)}
                  onOpenAddProperty={() => setShowAddPropertyModal(true)}
                />
              )}
            </div>

            {/* Mobile Bottom Sheet for Selected Property Details */}
            {selectedProperty && (
              <div className="lg:hidden absolute inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex flex-col justify-end">
                <div
                  className="w-full bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-slate-800 flex flex-col max-h-full overflow-hidden animate-in slide-in-from-bottom duration-200"
                  onClick={e => e.stopPropagation()}
                >
                  {/* Drag Handle */}
                  <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-2.5 shrink-0" />

                  {/* Body Content */}
                  <div className="flex-1 overflow-y-auto">
                    <PropertyDetail
                      property={selectedProperty}
                      currentRole={currentUser.role}
                      currentUserName={currentUser.name}
                      onClose={() => setSelectedPropertyId(null)}
                      onAddFollowUp={handleAddFollowUp}
                      onToggleFollowUp={handleToggleFollowUp}
                      onDeleteFollowUp={handleDeleteFollowUp}
                      onAddVisitLog={handleAddVisitLog}
                      onUpdateNotes={handleUpdateNotes}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- View 2: Follow-Up List View --- */}
        {currentView === 'follow_ups' && (
          <FollowUpList
            properties={properties}
            currentRole={currentUser.role}
            onSelectProperty={id => setSelectedPropertyId(id)}
            onToggleFollowUp={handleToggleFollowUp}
            onNavigateToMap={() => setCurrentView('map')}
            onOpenAddProperty={() => setShowAddPropertyModal(true)}
          />
        )}

        {/* --- View 3: Residential Property Directory View --- */}
        {currentView === 'directory' && (
          <PropertyDirectory
            properties={properties}
            onSelectProperty={id => setSelectedPropertyId(id)}
            onNavigateToMap={() => setCurrentView('map')}
            onOpenAddProperty={() => setShowAddPropertyModal(true)}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Tab Bar (Thumb Zone) */}
      <nav className="mobile-navigation lg:hidden shrink-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2">
        <button
          onClick={() => setCurrentView('map')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors ${
            currentView === 'map'
              ? 'text-blue-600 dark:text-blue-400 font-semibold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <MapPin className="w-5 h-5 mb-1" />
          <span className="text-[11px]">Atlas Map</span>
        </button>

        <button
          onClick={() => setCurrentView('follow_ups')}
          className={`flex-1 flex flex-col items-center justify-center py-1 relative transition-colors ${
            currentView === 'follow_ups'
              ? 'text-blue-600 dark:text-blue-400 font-semibold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <div className="relative">
            <Clock className="w-5 h-5 mb-1" />
            {overdueCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 min-w-[16px] text-center bg-rose-600 text-white rounded-full text-[9px] font-bold">
                {overdueCount}
              </span>
            )}
          </div>
          <span className="text-[11px]">Follow-Ups</span>
        </button>

        <button
          onClick={() => setCurrentView('directory')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors ${
            currentView === 'directory'
              ? 'text-blue-600 dark:text-blue-400 font-semibold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <BookOpen className="w-5 h-5 mb-1" />
          <span className="text-[11px]">Addresses</span>
        </button>
      </nav>

      {/* Guide & Local Setup Modal */}
      <LocalRunGuideModal
        isOpen={showGuideModal && sync.user?.role === 'admin'}
        onClose={() => setShowGuideModal(false)}
        onClearAll={handleClearAll}
        onLoadSampleData={handleLoadSampleData}
        onDataReload={() => setProperties(storageService.loadProperties())}
        properties={properties}
      />

      {/* Add Address Modal */}
      <AddPropertyModal
        isOpen={showAddPropertyModal}
        onClose={() => setShowAddPropertyModal(false)}
        onSubmit={handleAddProperty}
      />
      </div>
      </div>
    </>
  );
}
