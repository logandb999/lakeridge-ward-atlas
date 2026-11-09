import React, { useEffect, useState, useMemo } from 'react';
import { HouseholdFlags } from './HouseholdFlags';
import { householdLabels } from '../lib/householdFlags';
import type { LocationReviewRecord, ReviewCoordinates } from '../lib/locationReview';
import {
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap
} from '@vis.gl/react-google-maps';
import { Property, FilterState, FollowUpStatus } from '../types';
import { computePropertyStatus, getStatusTheme, formatDueDateLabel } from '../services/storageService';
import {
  Home,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Compass,
  Info,
  MapPin,
  Navigation,
  Loader2
} from 'lucide-react';

interface GoogleMapViewProps {
  properties: Property[];
  selectedPropertyId: string | null;
  onSelectProperty: (id: string) => void;
  filter: FilterState;
  onToggleMapMode?: () => void;
  mapMode: 'google' | 'vector';
  locationReview?: {
    locations: LocationReviewRecord[];
    selectedId: string;
    draft: ReviewCoordinates | null;
    onSelect: (id: string) => void;
    onMove: (point: ReviewCoordinates) => void;
  };
}

// 40°16'47.1"N 111°41'30.3"W
const WARD_CENTER = { lat: 40.27975, lng: -111.69175 };

function ReviewCamera({ point }: { point: ReviewCoordinates | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !point) return;
    map.panTo(point); map.setZoom(19);
  }, [map, point]);
  return null;
}

// Controller to smoothly pan the Google Map when selectedProperty or userLocation changes
function MapCameraController({
  selectedProperty,
  centerTarget,
}: {
  selectedProperty: Property | null;
  centerTarget: { lat: number; lng: number; zoom?: number } | null;
}) {
  const map = useMap();

  // If a property is selected, center on it
  useEffect(() => {
    if (!map || !selectedProperty) return;
    map.panTo({
      lat: selectedProperty.coordinates.lat,
      lng: selectedProperty.coordinates.lng,
    });
    if (map.getZoom() && map.getZoom()! < 16) {
      map.setZoom(16);
    }
  }, [map, selectedProperty]);

  // If explicit centerTarget is given (user location or ward center)
  useEffect(() => {
    if (!map || !centerTarget) return;
    map.panTo({ lat: centerTarget.lat, lng: centerTarget.lng });
    if (centerTarget.zoom) {
      map.setZoom(centerTarget.zoom);
    }
  }, [map, centerTarget]);

  return null;
}

export const GoogleMapView: React.FC<GoogleMapViewProps> = ({
  properties,
  selectedPropertyId,
  onSelectProperty,
  filter,
  onToggleMapMode,
  mapMode,
  locationReview,
}) => {
  const [hoveredProperty, setHoveredProperty] = useState<Property | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [centerTarget, setCenterTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [locationToast, setLocationToast] = useState<string | null>(null);

  // Request browser geolocation
  const handleRequestLocation = (isInitial = false) => {
    if (!navigator.geolocation) {
      if (!isInitial) {
        setLocationToast('Geolocation is not supported by your browser.');
        setTimeout(() => setLocationToast(null), 3500);
      }
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(coords);
        setCenterTarget({ ...coords, zoom: 16 });
        setIsLocating(false);
        setLocationToast('Centered on your current location');
        setTimeout(() => setLocationToast(null), 3000);
      },
      error => {
        setIsLocating(false);
        console.warn('Geolocation request did not resolve:', error.message);
        if (!isInitial) {
          setLocationToast(error.code === 1
            ? 'Location access is blocked. Allow location for this website in your browser settings and enable Location Services on your device.'
            : error.code === 3
              ? 'Finding your location timed out. Check that Location Services is enabled, then try again.'
              : 'Your device could not determine its location. Check Location Services and your connection, then try again.');
          setTimeout(() => setLocationToast(null), 10000);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  // Check filter match
  const matchesFilter = (property: Property): boolean => {
    const status = computePropertyStatus(property);

    if (filter.status !== 'all' && status !== filter.status) {
      return false;
    }

    if (filter.role !== 'all') {
      const hasRoleTask = property.followUps.some(
        f => f.status === 'pending' && f.assignedRole === filter.role
      );
      if (!hasRoleTask) return false;
    }

    if (filter.zone !== 'all' && property.zone !== filter.zone) {
      return false;
    }

    if (filter.searchQuery.trim()) {
      const q = filter.searchQuery.toLowerCase();
      const addrMatch = property.address.toLowerCase().includes(q);
      const unitMatch = property.unit?.toLowerCase().includes(q);
      const occupantMatch = property.occupantSummary.toLowerCase().includes(q);
      const tagMatch = [...property.tags, ...householdLabels(property)].some(t => t.toLowerCase().includes(q));
      if (!addrMatch && !unitMatch && !occupantMatch && !tagMatch) return false;
    }

    return true;
  };

  const selectedProperty = useMemo(() => {
    return properties.find(p => p.id === selectedPropertyId) || null;
  }, [properties, selectedPropertyId]);

  const matchStats = useMemo(() => {
    const total = properties.length;
    const matching = properties.filter(matchesFilter).length;
    return { total, matching };
  }, [properties, filter]);

  return (
    <div className="relative w-full h-full bg-slate-100 dark:bg-slate-950 overflow-hidden">
      {/* Google Maps Container */}
      <Map
        mapId="DEMO_MAP_ID"
        defaultCenter={WARD_CENTER}
        defaultZoom={15}
        defaultMapTypeId={locationReview ? 'hybrid' : 'roadmap'}
        onClick={event => { if (locationReview?.selectedId && event.detail.latLng) locationReview.onMove(event.detail.latLng); }}
        minZoom={12}
        maxZoom={20}
        gestureHandling="greedy"
        disableDefaultUI={false}
        mapTypeControl={true}
        streetViewControl={false}
        clickableIcons={false}
        fullscreenControl={false}
        zoomControl={true}
        className="w-full h-full"
        style={{ width: '100%', height: '100%' }}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
      >
        <MapCameraController selectedProperty={selectedProperty} centerTarget={centerTarget} />
        {locationReview && <>
          <ReviewCamera point={locationReview.draft} />
          {locationReview.locations.filter(r => r.coordinates && Date.parse(r.expiresAt) > Date.now()).map(r => (
            <AdvancedMarker key={r.id} position={r.id === locationReview.selectedId && locationReview.draft ? locationReview.draft : r.coordinates!}
              title={`${r.address} — ${r.status === 'confirmed' ? 'Confirmed' : 'Approximate'}`}
              draggable={r.id === locationReview.selectedId}
              onClick={() => locationReview.onSelect(r.id)}
              onDragEnd={event => { if (event.latLng) locationReview.onMove({ lat: event.latLng.lat(), lng: event.latLng.lng() }); }}>
              <Pin background={r.status === 'confirmed' ? '#059669' : '#d97706'} borderColor={r.id === locationReview.selectedId ? '#2563eb' : '#ffffff'} glyphColor="#ffffff" />
            </AdvancedMarker>
          ))}
        </>}

        {/* User Current Location Marker */}
        {userLocation && (
          <AdvancedMarker
            position={userLocation}
            title="Your Current Location"
            zIndex={1000}
          >
            <div className="relative flex items-center justify-center">
              {/* Outer pulsing ring */}
              <div className="absolute w-8 h-8 rounded-full bg-blue-500/30 animate-ping pointer-events-none" />
              <div className="absolute w-6 h-6 rounded-full bg-blue-500/25 pointer-events-none" />
              {/* Solid blue core dot */}
              <div className="relative w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md z-10" />
              {/* Tiny indicator label */}
              <div className="absolute top-full mt-1 px-1.5 py-0.5 rounded bg-slate-900/90 text-white text-[9px] font-bold whitespace-nowrap shadow-sm pointer-events-none border border-slate-700">
                You are here
              </div>
            </div>
          </AdvancedMarker>
        )}

        {/* Render Advanced Markers for all properties */}
        {properties.map(property => {
          const status = computePropertyStatus(property);
          const theme = getStatusTheme(status);
          const isSelected = property.id === selectedPropertyId;
          const isMatch = matchesFilter(property);

          if (!isMatch) return null;

          return (
            <AdvancedMarker
              key={property.id}
              position={{
                lat: property.coordinates.lat,
                lng: property.coordinates.lng,
              }}
              title={property.address}
              onClick={() => onSelectProperty(property.id)}
              zIndex={isSelected ? 100 : 10}
            >
              {/* Custom Pin with Status Badge & House Tag */}
              <div
                className="relative group cursor-pointer transition-transform duration-150 transform hover:scale-110"
                onMouseEnter={() => setHoveredProperty(property)}
                onMouseLeave={() => setHoveredProperty(null)}
              >
                {/* Active Selection Glow Ring */}
                {isSelected && (
                  <div className="absolute -inset-2 rounded-full border-2 border-blue-500 border-dashed animate-spin-slow pointer-events-none" />
                )}

                {/* Marker Pin */}
                <div
                  className={`relative flex items-center justify-center rounded-full shadow-lg border-2 border-white text-white ${
                    isSelected ? 'w-10 h-10 ring-4 ring-blue-500/30' : 'w-8 h-8'
                  }`}
                  style={{ backgroundColor: theme.markerBg }}
                >
                  {status === 'overdue' && <AlertTriangle className="w-4 h-4" />}
                  {status === 'due_soon' && <Clock className="w-4 h-4" />}
                  {status === 'scheduled' && <Clock className="w-4 h-4" />}
                  {status === 'completed' && <CheckCircle2 className="w-4 h-4" />}
                  {status === 'no_action' && <Home className="w-4 h-4" />}
                </div>

                {/* Address Chip Tag underneath */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-1.5 py-0.5 rounded bg-slate-900/90 text-white text-[10px] font-bold whitespace-nowrap shadow-md pointer-events-none border border-slate-700">
                  {property.address.split(' ')[0]} {property.unit ? `(${property.unit.split(' ')[1] || property.unit})` : ''}
                </div>
              </div>
            </AdvancedMarker>
          );
        })}

        {/* InfoWindow for Selected Property */}
        {selectedProperty && (
          <InfoWindow
            position={{
              lat: selectedProperty.coordinates.lat,
              lng: selectedProperty.coordinates.lng,
            }}
            pixelOffset={[0, -38]}
            onCloseClick={() => onSelectProperty('')}
            headerDisabled={true}
          >
            <div className="p-1 max-w-xs text-xs">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-bold text-slate-900 truncate">
                  {selectedProperty.address}
                </span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getStatusTheme(computePropertyStatus(selectedProperty)).badgeBg}`}>
                  {getStatusTheme(computePropertyStatus(selectedProperty)).label}
                </span>
              </div>
              <p className="text-slate-600 text-[11px] line-clamp-2 mb-1.5">
                {selectedProperty.occupantSummary}
              </p>
              <HouseholdFlags property={selectedProperty} />
              {selectedProperty.accessNotes && (
                <p className="text-[10px] text-amber-700 italic line-clamp-1 mb-1">
                  Access: {selectedProperty.accessNotes}
                </p>
              )}
              <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-1 flex justify-between">
                <span>{selectedProperty.zone}</span>
                <span className="font-semibold text-blue-600">Details open in panel</span>
              </div>
            </div>
          </InfoWindow>
        )}
      </Map>

      {/* Floating Notification Toast */}
      {locationToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="bg-slate-900/90 text-white text-xs font-medium px-3.5 py-1.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-blue-400" />
            <span>{locationToast}</span>
          </div>
        </div>
      )}

      {/* Floating Top Left Match Banner */}
      <div className="absolute top-4 left-4 z-20 pointer-events-auto">
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-md border border-slate-200 dark:border-slate-800 px-3.5 py-2 flex items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{locationReview ? 'Location Review' : 'Google Maps Live'}</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="text-slate-600 dark:text-slate-400">
            {locationReview ? `${locationReview.locations.length} review records` : <><strong className="text-slate-900 dark:text-white tabular-nums">{matchStats.matching}</strong> of {matchStats.total} addresses shown</>}
          </span>
        </div>
      </div>

      {/* Floating Controls (Top Right: Locate Me, Recenter Ward, Map Switcher, Legend) */}
      <div className="absolute top-4 right-14 z-20 flex items-center gap-2 pointer-events-auto">
        {/* Locate My Location Button */}
        <button
          onClick={() => handleRequestLocation(false)}
          disabled={isLocating}
          className={`px-3 py-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-md border border-slate-200 dark:border-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            userLocation
              ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40'
              : 'text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400'
          }`}
          title="Center on my current location"
          aria-label="Locate me"
        >
          {isLocating ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          ) : (
            <Navigation className={`w-4 h-4 ${userLocation ? 'fill-blue-600 text-blue-600 dark:fill-blue-400 dark:text-blue-400' : ''}`} />
          )}
          <span className="hidden sm:inline">My Location</span>
        </button>

        {/* Recenter Ward Button */}
        <button
          onClick={() => setCenterTarget({ ...WARD_CENTER, zoom: 15 })}
          className="px-3 py-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-md border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 transition-colors"
          title="Recenter on Lakeridge Ward"
          aria-label="Recenter on Lakeridge Ward"
        >
          <Compass className="w-4 h-4 text-slate-500" />
          <span className="hidden sm:inline">Ward Center</span>
        </button>

        {/* Toggle between Google Maps & Ward GIS Vector */}
        {onToggleMapMode && (
          <button
            onClick={onToggleMapMode}
            className="px-3 py-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-md border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 transition-colors"
            title="Switch to Ward GIS Vector Map"
          >
            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>GIS View</span>
          </button>
        )}

        <button
          onClick={() => setShowLegend(!showLegend)}
          className={`w-9 h-9 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-md border border-slate-200 dark:border-slate-800 flex items-center justify-center transition-colors ${
            showLegend ? 'text-blue-600 border-blue-400' : 'text-slate-700 dark:text-slate-200'
          }`}
          title="Atlas Legend"
          aria-label="Atlas Legend"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {/* Collapsible Atlas Legend */}
      {showLegend && (
        <div className="absolute bottom-6 left-4 z-20 max-w-xs bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-3.5 text-xs animate-in fade-in duration-100">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-slate-900 dark:text-white">Google Maps Pin Legend</span>
            <button
              onClick={() => setShowLegend(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
            >
              ×
            </button>
          </div>

          <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-600 shrink-0" />
              <span>Overdue Follow-Up</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
              <span>Due This Week (Next 7 days)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-sky-600 shrink-0" />
              <span>Scheduled Future Visit</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-600 shrink-0" />
              <span>All Tasks Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-slate-500 shrink-0" />
              <span>In Good Standing (No action needed)</span>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
            Powered by Google Maps Platform. Drag to pan, scroll to zoom, click any pin to view address details.
          </div>
        </div>
      )}
    </div>
  );
};
