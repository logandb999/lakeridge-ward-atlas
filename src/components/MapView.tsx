import { hasMapLocation } from '../lib/propertyLocations';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Property, FollowUpStatus, FilterState } from '../types';
import { computePropertyStatus, getStatusTheme, formatDueDateLabel } from '../services/storageService';
import {
  ZoomIn,
  ZoomOut,
  Compass,
  Layers,
  Home,
  AlertCircle,
  Clock,
  CheckCircle2,
  Info,
  Calendar
} from 'lucide-react';

interface MapViewProps {
  properties: Property[];
  selectedPropertyId: string | null;
  onSelectProperty: (id: string) => void;
  filter: FilterState;
  onFilterChange: (newFilter: Partial<FilterState>) => void;
  onToggleMapMode?: () => void;
  hasGoogleMaps?: boolean;
}

export const MapView: React.FC<MapViewProps> = ({
  properties,
  selectedPropertyId,
  onSelectProperty,
  filter,
  onToggleMapMode,
  hasGoogleMaps,
}) => {
  // Pan and Zoom state
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredProperty, setHoveredProperty] = useState<Property | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [showParcels, setShowParcels] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  // Smoothly center on selected property
  useEffect(() => {
    if (selectedPropertyId && containerRef.current) {
      const selected = properties.find(p => p.id === selectedPropertyId);
      if (selected && !selected.location && hasMapLocation(selected)) {
        // Map viewBox is 1000 x 800
        const targetX = (500 - selected.coordinates.x) * scale;
        const targetY = (400 - selected.coordinates.y) * scale;
        setPan({ x: targetX, y: targetY });
      }
    }
  }, [selectedPropertyId, scale]);

  const handleZoom = (delta: number) => {
    setScale(prev => Math.min(Math.max(prev + delta, 0.7), 2.5));
  };

  const handleReset = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag on left click and not on interactive buttons
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile pan
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Check if a property matches the current filter
  const matchesFilter = (property: Property): boolean => {
    if (property.location || !hasMapLocation(property)) return false;
    const status = computePropertyStatus(property);

    // Status filter
    if (filter.status !== 'all' && status !== filter.status) {
      return false;
    }

    // Role filter
    if (filter.role !== 'all') {
      const hasRoleTask = property.followUps.some(
        f => f.status === 'pending' && f.assignedRole === filter.role
      );
      if (!hasRoleTask) return false;
    }

    // Zone filter
    if (filter.zone !== 'all' && property.zone !== filter.zone) {
      return false;
    }

    // Search query
    if (filter.searchQuery.trim()) {
      const q = filter.searchQuery.toLowerCase();
      const addrMatch = property.address.toLowerCase().includes(q);
      const unitMatch = property.unit?.toLowerCase().includes(q);
      const occupantMatch = property.occupantSummary.toLowerCase().includes(q);
      const tagMatch = property.tags.some(t => t.toLowerCase().includes(q));
      if (!addrMatch && !unitMatch && !occupantMatch && !tagMatch) return false;
    }

    return true;
  };

  const matchStats = useMemo(() => {
    const total = properties.length;
    const matching = properties.filter(matchesFilter).length;
    return { total, matching };
  }, [properties, filter]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#f8fafc] dark:bg-slate-950 overflow-hidden select-none cursor-grab active:cursor-grabbing border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* SVG Canvas */}
      <svg
        viewBox="0 0 1000 800"
        className="w-full h-full transition-transform duration-75 ease-out"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: '50% 50%',
        }}
      >
        <defs>
          {/* Subtle water pattern */}
          <linearGradient id="lakeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.9" />
          </linearGradient>

          {/* Grass gradient for parks */}
          <linearGradient id="parkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#dcfce7" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#bbf7d0" stopOpacity="0.85" />
          </linearGradient>

          {/* Forest green for Timberline reserve */}
          <linearGradient id="forestGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f0fdf4" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#dcfce7" stopOpacity="0.6" />
          </linearGradient>

          {/* Marker Drop Shadow */}
          <filter id="markerShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#0f172a" floodOpacity="0.25" />
          </filter>

          <filter id="selectedGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#2563eb" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* --- Background Base Terrain --- */}
        <rect width="1000" height="800" fill="#f8fafc" />

        {/* Subtle elevation contour lines for North Ridge */}
        <path d="M 60,180 Q 300,100 680,120 T 960,100" fill="none" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="4 6" opacity="0.6" />
        <path d="M 40,240 Q 340,160 720,180 T 960,150" fill="none" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="4 6" opacity="0.5" />
        <path d="M 40,300 Q 320,240 680,260 T 960,240" fill="none" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="4 6" opacity="0.4" />

        {/* --- Green Spaces & Preserves --- */}
        {/* Timberline Forest Preserve (West) */}
        <path
          d="M 20,280 C 60,320 120,380 90,520 C 60,620 40,720 20,780 L 20,280 Z"
          fill="url(#forestGrad)"
          stroke="#bbf7d0"
          strokeWidth="1"
        />

        {/* Heritage Grove Community Park (South-Central) */}
        <rect
          x="340"
          y="420"
          width="130"
          height="110"
          rx="12"
          fill="url(#parkGrad)"
          stroke="#86efac"
          strokeWidth="1"
        />
        <text x="405" y="475" textAnchor="middle" fontSize="11" fill="#15803d" fontWeight="500" letterSpacing="0.05em">
          HERITAGE GROVE PARK
        </text>

        {/* Lakeside Marsh / Nature Trail (East Shore) */}
        <path
          d="M 680,520 C 720,540 760,560 740,640 C 720,680 660,700 620,700 C 600,660 630,580 680,520 Z"
          fill="url(#parkGrad)"
          stroke="#86efac"
          strokeWidth="1"
        />

        {/* --- Lakeridge Lake (East) --- */}
        <path
          d="M 650,220 C 700,200 790,210 870,250 C 930,290 950,380 940,460 C 925,550 860,600 790,590 C 730,575 700,520 680,450 C 660,380 620,250 650,220 Z"
          fill="url(#lakeGrad)"
          stroke="#38bdf8"
          strokeWidth="2"
        />

        {/* Lake Shimmer wave lines */}
        <path d="M 720,300 Q 750,295 780,300" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" fill="none" />
        <path d="M 760,340 Q 800,335 840,340" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" fill="none" />
        <path d="M 710,400 Q 740,395 770,400" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" fill="none" />
        <path d="M 800,430 Q 830,425 860,430" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" fill="none" />

        {/* Lake Name */}
        <text x="800" y="380" textAnchor="middle" fontSize="16" fill="#0369a1" fontWeight="600" letterSpacing="0.1em" opacity="0.8">
          LAKERIDGE LAKE
        </text>
        <text x="800" y="398" textAnchor="middle" fontSize="10" fill="#0284c7" fontWeight="500" letterSpacing="0.05em" opacity="0.7">
          (EAST BASIN)
        </text>

        {/* Boat dock piers */}
        <rect x="760" y="495" width="28" height="6" fill="#92400e" rx="1" />
        <rect x="790" y="490" width="32" height="6" fill="#92400e" rx="1" />

        {/* --- Residential Lot Parcels (GIS layer) --- */}
        {showParcels && (
          <g stroke="#cbd5e1" strokeWidth="0.75" strokeDasharray="3 3" fill="none" opacity="0.7">
            {/* North Ridge Parcels */}
            <rect x="230" y="90" width="105" height="100" rx="3" />
            <rect x="335" y="90" width="115" height="100" rx="3" />
            <rect x="450" y="80" width="125" height="105" rx="3" />
            <rect x="230" y="190" width="120" height="90" rx="3" />
            <rect x="350" y="190" width="130" height="90" rx="3" />

            {/* Timberline Parcels */}
            <rect x="120" y="300" width="120" height="100" rx="3" />
            <rect x="170" y="410" width="130" height="110" rx="3" />
            <rect x="110" y="530" width="125" height="110" rx="3" />
            <rect x="240" y="560" width="120" height="120" rx="3" />

            {/* Lakeside East Parcels */}
            <rect x="630" y="170" width="120" height="90" rx="3" />
            <rect x="690" y="260" width="110" height="90" rx="3" />
            <rect x="770" y="340" width="110" height="95" rx="3" />
            <rect x="740" y="460" width="115" height="95" rx="3" />

            {/* Meadowview Parcels */}
            <rect x="440" y="540" width="140" height="110" rx="3" />
            <rect x="370" y="650" width="120" height="95" rx="3" />
            <rect x="520" y="660" width="115" height="90" rx="3" />
            <rect x="640" y="610" width="120" height="95" rx="3" />
          </g>
        )}

        {/* --- Street Network (Roads) --- */}
        {/* Road Bed Fill */}
        <g stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round">
          {/* Lakeridge Crest Drive (Major West-to-East along North) */}
          <path d="M 80,160 Q 320,120 580,160 T 670,220" strokeWidth="20" fill="none" />

          {/* Summit Ridge Way */}
          <path d="M 500,120 L 580,240" strokeWidth="16" fill="none" />

          {/* High Bluff Court (Cul-de-sac) */}
          <path d="M 280,130 L 260,205" strokeWidth="16" fill="none" />

          {/* Pine Hollow Court */}
          <path d="M 370,135 L 380,230" strokeWidth="14" fill="none" />

          {/* Shoreline Blvd (Curving lakeside artery) */}
          <path d="M 660,190 C 690,260 760,300 780,480 C 790,560 750,620 670,680" strokeWidth="22" fill="none" />

          {/* Lakeview Point Dr */}
          <path d="M 750,330 L 835,395" strokeWidth="16" fill="none" />

          {/* Dockside Lane */}
          <path d="M 770,470 L 810,515" strokeWidth="15" fill="none" />

          {/* Timberline Way (Western corridor) */}
          <path d="M 140,240 C 180,310 220,440 240,510 L 290,640" strokeWidth="20" fill="none" />

          {/* Whispering Pines Rd */}
          <path d="M 215,460 L 150,590" strokeWidth="15" fill="none" />

          {/* Cedar Glen Trail */}
          <path d="M 240,560 L 300,635" strokeWidth="14" fill="none" />

          {/* Meadowview Lane & Loop */}
          <path d="M 290,640 C 380,600 480,590 600,610 L 700,670" strokeWidth="20" fill="none" />

          {/* Prairie Creek Road */}
          <path d="M 400,610 L 415,720" strokeWidth="16" fill="none" />

          {/* Wildflower Way */}
          <path d="M 540,605 L 575,730" strokeWidth="16" fill="none" />

          {/* Goldenrod Circle */}
          <path d="M 640,630 L 690,675" strokeWidth="15" fill="none" />

          {/* Cross Connector: Ridge to Meadow */}
          <path d="M 380,230 C 370,340 360,420 370,550" strokeWidth="16" fill="none" strokeDasharray="6 4" opacity="0.6" />
        </g>

        {/* Road Surface Centerline Overlay */}
        <g stroke="#e2e8f0" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M 80,160 Q 320,120 580,160 T 670,220" strokeWidth="14" />
          <path d="M 500,120 L 580,240" strokeWidth="10" />
          <path d="M 280,130 L 260,205" strokeWidth="10" />
          <path d="M 370,135 L 380,230" strokeWidth="8" />
          <path d="M 660,190 C 690,260 760,300 780,480 C 790,560 750,620 670,680" strokeWidth="16" />
          <path d="M 750,330 L 835,395" strokeWidth="10" />
          <path d="M 770,470 L 810,515" strokeWidth="9" />
          <path d="M 140,240 C 180,310 220,440 240,510 L 290,640" strokeWidth="14" />
          <path d="M 215,460 L 150,590" strokeWidth="10" />
          <path d="M 240,560 L 300,635" strokeWidth="9" />
          <path d="M 290,640 C 380,600 480,590 600,610 L 700,670" strokeWidth="14" />
          <path d="M 400,610 L 415,720" strokeWidth="10" />
          <path d="M 540,605 L 575,730" strokeWidth="10" />
          <path d="M 640,630 L 690,675" strokeWidth="9" />
        </g>

        {/* Road Centerline Dashes */}
        <g stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 6" fill="none">
          <path d="M 80,160 Q 320,120 580,160 T 670,220" />
          <path d="M 660,190 C 690,260 760,300 780,480 C 790,560 750,620 670,680" />
          <path d="M 140,240 C 180,310 220,440 240,510 L 290,640" />
          <path d="M 290,640 C 380,600 480,590 600,610 L 700,670" />
        </g>

        {/* --- Street Name Labels --- */}
        <g fontSize="10" fill="#64748b" fontWeight="600" letterSpacing="0.06em">
          <text x="350" y="112" textAnchor="middle">LAKERIDGE CREST DR</text>
          <text x="735" y="240" textAnchor="middle" transform="rotate(35, 735, 240)">SHORELINE BLVD</text>
          <text x="170" y="380" textAnchor="middle" transform="rotate(65, 170, 380)">TIMBERLINE WAY</text>
          <text x="500" y="582" textAnchor="middle">MEADOWVIEW LN</text>
          <text x="235" y="215" textAnchor="middle" fontSize="9">HIGH BLUFF CT</text>
          <text x="390" y="245" textAnchor="middle" fontSize="9">PINE HOLLOW CT</text>
          <text x="840" y="415" textAnchor="middle" fontSize="9">LAKEVIEW POINT</text>
          <text x="140" y="605" textAnchor="middle" fontSize="9">WHISPERING PINES</text>
          <text x="420" y="735" textAnchor="middle" fontSize="9">PRAIRIE CREEK RD</text>
          <text x="580" y="745" textAnchor="middle" fontSize="9">WILDFLOWER WAY</text>
        </g>

        {/* --- Ward Boundary Outline --- */}
        <rect
          x="30"
          y="35"
          width="940"
          height="730"
          rx="24"
          fill="none"
          stroke="#0f172a"
          strokeWidth="2"
          strokeDasharray="8 6"
          opacity="0.25"
        />
        <text x="60" y="65" fill="#475569" fontSize="11" fontWeight="700" letterSpacing="0.1em">
          LAKERIDGE WARD BOUNDARY (DISTRICT 4)
        </text>

        {/* --- Zone Quadrant Labels --- */}
        <g fill="#94a3b8" fontSize="12" fontWeight="700" letterSpacing="0.1em" opacity="0.65">
          <text x="180" y="90">ZONE: NORTH RIDGE</text>
          <text x="850" y="180" textAnchor="end">ZONE: LAKESIDE EAST</text>
          <text x="60" y="740">ZONE: TIMBERLINE</text>
          <text x="720" y="740">ZONE: MEADOWVIEW</text>
        </g>

        {/* --- Property Markers --- */}
        {properties.filter(p => !p.location && hasMapLocation(p)).map(property => {
          const status = computePropertyStatus(property);
          const theme = getStatusTheme(status);
          const isSelected = property.id === selectedPropertyId;
          const isMatch = matchesFilter(property);
          const { x, y } = property.coordinates;

          return (
            <g
              key={property.id}
              className="cursor-pointer transition-all duration-200"
              style={{
                opacity: isMatch ? 1 : 0.22,
                transform: `translate(${x}px, ${y}px)`,
                pointerEvents: isMatch ? 'auto' : 'none',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectProperty(property.id);
              }}
              onMouseEnter={() => setHoveredProperty(property)}
              onMouseLeave={() => setHoveredProperty(null)}
            >
              {/* Selected Focus Halo */}
              {isSelected && (
                <>
                  <circle
                    r="24"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2.5"
                    strokeDasharray="4 3"
                    className="animate-spin-slow"
                  />
                  <circle
                    r="30"
                    fill="#3b82f6"
                    opacity="0.15"
                  />
                </>
              )}

              {/* Marker Teardrop / Pin Base */}
              <g filter={isSelected ? 'url(#selectedGlow)' : 'url(#markerShadow)'}>
                {/* Pin body */}
                <path
                  d="M 0,0 C -14,-14 -14,-32 0,-36 C 14,-32 14,-14 0,0 Z"
                  fill={theme.markerBg}
                  stroke="#ffffff"
                  strokeWidth="2"
                />

                {/* Inner status badge glyph */}
                {status === 'overdue' && (
                  <circle cx="0" cy="-22" r="6" fill="#ffffff" />
                )}
                {status === 'due_soon' && (
                  <circle cx="0" cy="-22" r="6" fill="#ffffff" />
                )}
                {status === 'scheduled' && (
                  <circle cx="0" cy="-22" r="6" fill="#ffffff" />
                )}
                {status === 'completed' && (
                  <circle cx="0" cy="-22" r="6" fill="#ffffff" />
                )}
                {status === 'no_action' && (
                  <circle cx="0" cy="-22" r="5" fill="#ffffff" />
                )}

                {/* Inner symbol icon */}
                {status === 'overdue' && (
                  <path d="M 0,-25 L 0,-22 M 0,-20 L 0,-19" stroke={theme.markerBg} strokeWidth="1.8" strokeLinecap="round" />
                )}
                {status === 'due_soon' && (
                  <path d="M -2,-24 L 2,-24 M 0,-24 L 0,-20 M -2,-20 L 2,-20" stroke={theme.markerBg} strokeWidth="1.5" strokeLinecap="round" />
                )}
                {status === 'scheduled' && (
                  <path d="M 0,-24 L 0,-22 L 2,-22" stroke={theme.markerBg} strokeWidth="1.5" strokeLinecap="round" fill="none" />
                )}
                {status === 'completed' && (
                  <path d="M -2.5,-22 L -0.5,-20 L 3,-24" stroke={theme.markerBg} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                )}
              </g>

              {/* House Number / Short Street Micro Tag */}
              <rect
                x="-26"
                y="5"
                width="52"
                height="16"
                rx="4"
                fill="#0f172a"
                fillOpacity={isSelected ? 0.95 : 0.8}
                stroke={isSelected ? '#3b82f6' : '#ffffff'}
                strokeWidth={isSelected ? 1.5 : 0.8}
              />
              <text
                x="0"
                y="16"
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                fill="#ffffff"
                letterSpacing="0.02em"
              >
                {property.address.split(' ')[0]} {property.unit ? `(${property.unit.split(' ')[1] || property.unit})` : ''}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating Hover Card (Preview on marker hover) */}
      {hoveredProperty && (
        <div
          className="absolute z-30 pointer-events-none transition-all duration-150 transform -translate-x-1/2 -translate-y-full pb-4"
          style={{
            left: `${((hoveredProperty.coordinates.x * scale) + pan.x + (containerRef.current ? containerRef.current.clientWidth / 2 - 500 * scale : 0))}px`,
            top: `${((hoveredProperty.coordinates.y * scale) + pan.y + (containerRef.current ? containerRef.current.clientHeight / 2 - 400 * scale : 0))}px`,
          }}
        >
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl p-3 shadow-xl border border-slate-200 dark:border-slate-800 text-xs w-64">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-semibold text-slate-900 dark:text-white truncate">
                {hoveredProperty.address}
              </span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${getStatusTheme(computePropertyStatus(hoveredProperty)).badgeBg}`}>
                {getStatusTheme(computePropertyStatus(hoveredProperty)).label}
              </span>
            </div>

            <p className="text-slate-600 dark:text-slate-300 text-[11px] line-clamp-1 mb-2">
              {hoveredProperty.occupantSummary}
            </p>

            {hoveredProperty.followUps.filter(f => f.status === 'pending').length > 0 ? (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-slate-500">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-slate-700 dark:text-slate-200 truncate max-w-[140px]">
                    {hoveredProperty.followUps.filter(f => f.status === 'pending')[0].title}
                  </span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                    {formatDueDateLabel(hoveredProperty.followUps.filter(f => f.status === 'pending')[0].dueDate)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 text-slate-400 text-[10px]">
                No pending follow-ups
              </div>
            )}
          </div>
        </div>
      )}

      {/* Map Controls (Top Right: Zoom, Reset, Layers, Legend) */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl shadow-md border border-slate-200 dark:border-slate-800 p-1 flex flex-col gap-1">
          <button
            onClick={() => handleZoom(0.25)}
            title="Zoom In"
            className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-transform"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleZoom(-0.25)}
            title="Zoom Out"
            className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-transform"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <div className="w-full h-px bg-slate-200 dark:bg-slate-800" />
          <button
            onClick={handleReset}
            title="Reset Atlas View"
            className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-transform"
            aria-label="Reset Atlas View"
          >
            <Compass className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl shadow-md border border-slate-200 dark:border-slate-800 p-1 flex flex-col gap-1">
          {onToggleMapMode && hasGoogleMaps && (
            <button
              onClick={onToggleMapMode}
              title="Switch to Google Maps"
              className="w-10 h-10 flex items-center justify-center rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
              aria-label="Switch to Google Maps"
            >
              <Compass className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => setShowParcels(!showParcels)}
            title={showParcels ? "Hide Parcel Grid" : "Show Parcel Grid"}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
              showParcels
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            aria-label="Toggle Parcel Boundaries"
          >
            <Layers className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowLegend(!showLegend)}
            title="Toggle Atlas Legend"
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
              showLegend
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            aria-label="Toggle Atlas Legend"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Floating Match Count Banner (Top Left) */}
      <div className="absolute top-4 left-4 z-20">
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl shadow-md border border-slate-200 dark:border-slate-800 px-3.5 py-2 flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-100">
            <Home className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Lakeridge Ward Atlas</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="text-slate-600 dark:text-slate-400">
            <strong className="text-slate-900 dark:text-white tabular-nums">{matchStats.matching}</strong> of {matchStats.total} addresses shown
          </span>
        </div>
      </div>

      {/* Collapsible Atlas Legend (Bottom Left) */}
      {showLegend && (
        <div className="absolute bottom-4 left-4 z-20 max-w-xs bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 p-3.5 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-slate-900 dark:text-white">Atlas Status Legend</span>
            <button
              onClick={() => setShowLegend(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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

          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
            Drag to pan. Click any marker to view address details, contact notes, and visit history.
          </div>
        </div>
      )}
    </div>
  );
};
