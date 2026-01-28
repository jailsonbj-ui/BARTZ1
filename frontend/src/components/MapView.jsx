import { useEffect, useMemo, useCallback, useState, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker, Polyline, InfoWindow, TrafficLayer, Autocomplete } from "@react-google-maps/api";
import { Fuel, MapPin, AlertTriangle, Star, Loader2, Plus, X, Layers, Map as MapIcon, Globe, Car, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const GOOGLE_MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;
const LIBRARIES = ["places"];

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const MAP_STYLES = {
  dark: [
    { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
    { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
    { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#64779e" }] },
    { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
    { featureType: "landscape.man_made", elementType: "geometry.stroke", stylers: [{ color: "#334e87" }] },
    { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#023e58" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#283d6a" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6f9ba5" }] },
    { featureType: "poi", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
    { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#023e58" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#3C7680" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
    { featureType: "road", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2c6675" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#255763" }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#b0d5ce" }] },
    { featureType: "road.highway", elementType: "labels.text.stroke", stylers: [{ color: "#023e58" }] },
    { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
    { featureType: "transit", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
    { featureType: "transit.line", elementType: "geometry.fill", stylers: [{ color: "#283d6a" }] },
    { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#3a4762" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4e6d70" }] },
  ],
};

const getOverallRating = (ratings) => {
  if (!ratings) return 0;
  const { price_rating = 0, service_rating = 0, parking_rating = 0, security_rating = 0 } = ratings;
  return ((price_rating + service_rating + parking_rating + security_rating) / 4).toFixed(1);
};

// Station icon types and colors
const STATION_ICONS = {
  fuel: { name: "Combustível", path: "M15 14h10v12h-10z M17 10h6v4h-6z M13 20h4v6h-4z" },
  star: { name: "Estrela", path: "M20 8l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" },
  circle: { name: "Círculo", path: "M20 12a8 8 0 100 16 8 8 0 000-16z" },
  square: { name: "Quadrado", path: "M12 12h16v16h-16z" },
  diamond: { name: "Losango", path: "M20 8l10 12-10 12-10-12z" },
  truck: { name: "Caminhão", path: "M10 16h14v8h-14z M24 18h4l3 4v2h-7z M13 26a2 2 0 100-4 2 2 0 000 4z M25 26a2 2 0 100-4 2 2 0 000 4z" },
};

const STATION_COLORS = {
  orange: { name: "Laranja", hex: "#F97316" },
  blue: { name: "Azul", hex: "#3B82F6" },
  green: { name: "Verde", hex: "#10B981" },
  red: { name: "Vermelho", hex: "#EF4444" },
  purple: { name: "Roxo", hex: "#8B5CF6" },
  yellow: { name: "Amarelo", hex: "#EAB308" },
  pink: { name: "Rosa", hex: "#EC4899" },
  cyan: { name: "Ciano", hex: "#06B6D4" },
};

// Custom marker icons using SVG data URLs
const createStationMarkerIcon = (station, isPlannedStop, stopNumber) => {
  const isActive = station.is_active !== false;
  const customColor = station.marker_color || "orange";
  const customIcon = station.marker_icon || "fuel";
  
  const baseColor = isPlannedStop ? "#10B981" : isActive ? (STATION_COLORS[customColor]?.hex || "#F97316") : "#64748B";
  const iconPath = STATION_ICONS[customIcon]?.path || STATION_ICONS.fuel.path;
  const opacity = isActive ? "1" : "0.6";
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="56" viewBox="0 0 40 56" opacity="${opacity}">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.3"/>
        </filter>
      </defs>
      <circle cx="20" cy="20" r="16" fill="${baseColor}" stroke="white" stroke-width="3" filter="url(#shadow)"/>
      <path d="${iconPath}" fill="white" opacity="0.9" transform="scale(0.6) translate(13, 13)"/>
      ${isPlannedStop ? `<circle cx="32" cy="8" r="8" fill="#10B981" stroke="white" stroke-width="2"/><text x="32" y="12" text-anchor="middle" fill="white" font-size="10" font-weight="bold">${stopNumber}</text>` : ''}
      ${!isActive ? `<line x1="8" y1="8" x2="32" y2="32" stroke="#EF4444" stroke-width="3"/>` : ''}
      <rect x="5" y="42" width="30" height="14" rx="3" fill="#0F172A"/>
      <text x="20" y="52" text-anchor="middle" fill="${isActive ? baseColor : '#64748B'}" font-size="9" font-weight="bold" font-family="monospace">R$${station.diesel_price?.toFixed(2) || '0.00'}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

// Export for use in ControlPanel
export { STATION_ICONS, STATION_COLORS };

const createRoutePointIcon = (type) => {
  const colors = {
    origin: "#10B981",
    destination: "#EF4444",
    waypoint: "#3B82F6",
    fuelLimit: "#EF4444",
  };
  const color = colors[type] || "#3B82F6";
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.3"/>
        </filter>
      </defs>
      <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2" filter="url(#shadow)"/>
      ${type === 'origin' ? '<path d="M16 8l6 10h-12z" fill="white"/>' : ''}
      ${type === 'destination' ? '<circle cx="16" cy="16" r="5" fill="white"/>' : ''}
      ${type === 'waypoint' ? '<circle cx="16" cy="16" r="4" fill="white"/>' : ''}
      ${type === 'fuelLimit' ? '<path d="M16 10l-6 10h12z" fill="white"/><rect x="14" y="22" width="4" height="2" fill="white"/>' : ''}
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const createNewStationIcon = () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18" fill="#10B981" stroke="white" stroke-width="3" stroke-dasharray="5,3"/>
      <line x1="20" y1="10" x2="20" y2="30" stroke="white" stroke-width="3"/>
      <line x1="10" y1="20" x2="30" y2="20" stroke="white" stroke-width="3"/>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export default function MapView({
  stations,
  selectedStation,
  setSelectedStation,
  routeData,
  fuelPlan,
  onCreateStation,
  mapStyle = "dark",
  theme = "dark",
}) {
  const [map, setMap] = useState(null);
  const [activeInfoWindow, setActiveInfoWindow] = useState(null);
  const [isCreatingStation, setIsCreatingStation] = useState(false);
  const [newStationPosition, setNewStationPosition] = useState(null);
  const [showTraffic, setShowTraffic] = useState(false);
  const [mapType, setMapType] = useState("roadmap");
  const [showLayersMenu, setShowLayersMenu] = useState(false);
  const [searchBox, setSearchBox] = useState(null);
  const [searchValue, setSearchValue] = useState("");
  const [searchMarker, setSearchMarker] = useState(null);
  const searchInputRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    libraries: LIBRARIES,
  });

  const onSearchLoad = (autocomplete) => {
    setSearchBox(autocomplete);
  };

  const onPlaceChanged = () => {
    if (searchBox) {
      const place = searchBox.getPlace();
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        
        // Set search marker
        setSearchMarker({
          lat,
          lng,
          name: place.formatted_address || place.name || "Local buscado"
        });
        
        if (map) {
          map.panTo({ lat, lng });
          map.setZoom(14);
        }
        
        setSearchValue(place.formatted_address || place.name || "");
      }
    }
  };

  const clearSearch = () => {
    setSearchValue("");
    setSearchMarker(null);
  };

  // Create search marker icon
  const createSearchMarkerIcon = () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.4"/>
          </filter>
        </defs>
        <path d="M20 0 C9 0 0 9 0 20 C0 35 20 50 20 50 C20 50 40 35 40 20 C40 9 31 0 20 0 Z" fill="#EF4444" stroke="white" stroke-width="2" filter="url(#shadow)"/>
        <circle cx="20" cy="18" r="8" fill="white"/>
      </svg>
    `;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  };

  const center = useMemo(() => {
    if (routeData?.route_geometry?.length > 0) {
      const lats = routeData.route_geometry.map((p) => p[0]);
      const lngs = routeData.route_geometry.map((p) => p[1]);
      return {
        lat: (Math.min(...lats) + Math.max(...lats)) / 2,
        lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      };
    }
    return { lat: -26.5, lng: -49.5 };
  }, [routeData]);

  const plannedStopIds = useMemo(() => {
    if (!fuelPlan?.stops) return new Map();
    const stopMap = new Map();
    fuelPlan.stops.forEach((stop, index) => {
      stopMap.set(stop.station.id, index + 1);
    });
    return stopMap;
  }, [fuelPlan]);

  // Fit bounds when route changes
  useEffect(() => {
    if (map && routeData?.route_geometry?.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      routeData.route_geometry.forEach((point) => {
        bounds.extend({ lat: point[0], lng: point[1] });
      });
      map.fitBounds(bounds, { padding: 50 });
    }
  }, [map, routeData]);

  const onLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const handleMapClick = useCallback((e) => {
    if (isCreatingStation && e.latLng) {
      setNewStationPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    }
    setActiveInfoWindow(null);
  }, [isCreatingStation]);

  const handleConfirmNewStation = () => {
    if (newStationPosition && onCreateStation) {
      onCreateStation(newStationPosition);
      setIsCreatingStation(false);
      setNewStationPosition(null);
    }
  };

  const handleCancelCreation = () => {
    setIsCreatingStation(false);
    setNewStationPosition(null);
  };

  const mapOptions = useMemo(() => ({
    styles: mapType === "roadmap" && mapStyle === "dark" ? MAP_STYLES.dark : [],
    mapTypeId: mapType,
    disableDefaultUI: true,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    clickableIcons: false,
    draggableCursor: isCreatingStation ? "crosshair" : "grab",
    draggingCursor: isCreatingStation ? "crosshair" : "grabbing",
  }), [mapStyle, mapType, isCreatingStation]);

  // Convert route geometry to Google Maps path format
  const routePath = useMemo(() => {
    if (!routeData?.route_geometry?.length) return [];
    return routeData.route_geometry.map((point) => ({
      lat: point[0],
      lng: point[1],
    }));
  }, [routeData]);

  if (loadError) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-900 text-red-400">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
          <p>Erro ao carregar Google Maps</p>
          <p className="text-sm text-gray-500 mt-2">Verifique a chave da API</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-900">
        <div className="text-center text-gray-400">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin" />
          <p>Carregando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={6}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={handleMapClick}
        options={mapOptions}
      >
        {/* Traffic Layer */}
        {showTraffic && <TrafficLayer />}

        {/* Route Polyline */}
        {routePath.length > 1 && (
          <Polyline
            key={`route-${routeData?.total_distance}-${routePath.length}`}
            path={routePath}
            options={{
              strokeColor: "#F97316",
              strokeOpacity: 0.9,
              strokeWeight: 5,
            }}
          />
        )}

        {/* Route Points (Origin, Destination, Waypoints) */}
        {routeData?.route_points?.map((point, index) => {
          const type = index === 0 ? "origin" : index === routeData.route_points.length - 1 ? "destination" : "waypoint";
          return (
            <Marker
              key={`route-point-${index}`}
              position={{ lat: point.lat, lng: point.lng }}
              icon={{
                url: createRoutePointIcon(type),
                scaledSize: new window.google.maps.Size(32, 32),
                anchor: new window.google.maps.Point(16, 16),
              }}
              onClick={() => setActiveInfoWindow(`route-${index}`)}
            >
              {activeInfoWindow === `route-${index}` && (
                <InfoWindow onCloseClick={() => setActiveInfoWindow(null)}>
                  <div className="p-1">
                    <div className="font-medium text-sm text-gray-900">{point.name}</div>
                    <div className="text-xs text-gray-500">
                      {index === 0 ? "Origem" : index === routeData.route_points.length - 1 ? "Destino" : `Parada ${index}`}
                    </div>
                  </div>
                </InfoWindow>
              )}
            </Marker>
          );
        })}

        {/* Fuel Limit Point */}
        {routeData?.fuel_limit_point && !fuelPlan && (
          <Marker
            position={{
              lat: routeData.fuel_limit_point.latitude,
              lng: routeData.fuel_limit_point.longitude,
            }}
            icon={{
              url: createRoutePointIcon("fuelLimit"),
              scaledSize: new window.google.maps.Size(32, 32),
              anchor: new window.google.maps.Point(16, 16),
            }}
            onClick={() => setActiveInfoWindow("fuelLimit")}
          >
            {activeInfoWindow === "fuelLimit" && (
              <InfoWindow onCloseClick={() => setActiveInfoWindow(null)}>
                <div className="p-1">
                  <div className="font-medium text-sm text-red-600">Limite de Combustível</div>
                  <div className="text-xs text-gray-500">
                    {routeData.fuel_limit_point.distance_from_origin} km da origem
                  </div>
                </div>
              </InfoWindow>
            )}
          </Marker>
        )}

        {/* Gap indicators */}
        {fuelPlan?.gaps?.map((gap, index) => {
          const gapPosition = routeData?.route_geometry?.[
            Math.floor(routeData.route_geometry.length * (gap.start_km / routeData.total_distance))
          ];
          if (!gapPosition) return null;
          
          return (
            <Marker
              key={`gap-${index}`}
              position={{ lat: gapPosition[0], lng: gapPosition[1] }}
              icon={{
                url: createRoutePointIcon("fuelLimit"),
                scaledSize: new window.google.maps.Size(28, 28),
                anchor: new window.google.maps.Point(14, 14),
              }}
              onClick={() => setActiveInfoWindow(`gap-${index}`)}
            >
              {activeInfoWindow === `gap-${index}` && (
                <InfoWindow onCloseClick={() => setActiveInfoWindow(null)}>
                  <div className="p-1 max-w-xs">
                    <div className="font-medium text-sm text-red-600">Trecho sem postos</div>
                    <div className="text-xs text-gray-700">{gap.start_km}km - {gap.end_km}km</div>
                    <div className="text-xs text-gray-500 mt-1">{gap.suggestion}</div>
                  </div>
                </InfoWindow>
              )}
            </Marker>
          );
        })}

        {/* Station Markers */}
        {stations.map((station) => {
          const stopNumber = plannedStopIds.get(station.id);
          const isPlannedStop = !!stopNumber;
          
          return (
            <Marker
              key={station.id}
              position={{ lat: station.latitude, lng: station.longitude }}
              icon={{
                url: createStationMarkerIcon(station, isPlannedStop, stopNumber),
                scaledSize: new window.google.maps.Size(40, 56),
                anchor: new window.google.maps.Point(20, 50),
              }}
              onClick={() => {
                setSelectedStation(station);
                setActiveInfoWindow(`station-${station.id}`);
              }}
            >
              {activeInfoWindow === `station-${station.id}` && (
                <InfoWindow onCloseClick={() => setActiveInfoWindow(null)}>
                  <div className="p-2 min-w-[180px]">
                    <div className="font-medium text-sm text-gray-900">{station.name}</div>
                    {station.city && <div className="text-xs text-gray-500">{station.city}</div>}
                    <div className="text-orange-600 font-mono font-bold text-lg mt-1">
                      R$ {station.diesel_price?.toFixed(2)}/L
                    </div>
                    {!station.is_active && (
                      <div className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded mt-1 inline-block">
                        INATIVO
                      </div>
                    )}
                    {station.ratings && (
                      <div className="flex items-center gap-1 text-xs mt-1">
                        <Star size={12} className="text-yellow-500 fill-yellow-500" />
                        <span className="text-gray-700">{getOverallRating(station.ratings)}</span>
                      </div>
                    )}
                    {isPlannedStop && (
                      <div className="mt-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded inline-block">
                        Parada #{stopNumber} do plano
                      </div>
                    )}
                  </div>
                </InfoWindow>
              )}
            </Marker>
          );
        })}

        {/* Search Result Marker */}
        {searchMarker && (
          <Marker
            position={{ lat: searchMarker.lat, lng: searchMarker.lng }}
            icon={{
              url: createSearchMarkerIcon(),
              scaledSize: new window.google.maps.Size(40, 50),
              anchor: new window.google.maps.Point(20, 50),
            }}
            onClick={() => setActiveInfoWindow("search")}
            animation={window.google.maps.Animation.DROP}
          >
            {activeInfoWindow === "search" && (
              <InfoWindow onCloseClick={() => setActiveInfoWindow(null)}>
                <div className="p-2">
                  <div className="font-medium text-sm text-gray-900">{searchMarker.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {searchMarker.lat.toFixed(6)}, {searchMarker.lng.toFixed(6)}
                  </div>
                </div>
              </InfoWindow>
            )}
          </Marker>
        )}

        {/* New Station Marker (when creating) */}
        {newStationPosition && (
          <Marker
            position={newStationPosition}
            icon={{
              url: createNewStationIcon(),
              scaledSize: new window.google.maps.Size(40, 40),
              anchor: new window.google.maps.Point(20, 20),
            }}
            draggable={true}
            onDragEnd={(e) => {
              if (e.latLng) {
                setNewStationPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() });
              }
            }}
          />
        )}
      </GoogleMap>

      {/* Search Bar Overlay */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-80">
        <Autocomplete
          onLoad={onSearchLoad}
          onPlaceChanged={onPlaceChanged}
          options={{
            componentRestrictions: { country: "br" },
            types: ["geocode", "establishment"],
          }}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              ref={searchInputRef}
              data-testid="input-map-search"
              type="text"
              placeholder="Buscar local no mapa..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-10 pr-8 bg-slate-900/95 backdrop-blur-sm border-white/20 text-white placeholder:text-gray-400 shadow-lg"
            />
            {searchValue && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </Autocomplete>
      </div>

      {/* Map Controls Overlay */}
      <div className="absolute top-16 left-4 flex flex-col gap-2 z-10">
        {/* Add Station Button */}
        {!isCreatingStation ? (
          <Button
            data-testid="btn-add-station-map"
            onClick={() => setIsCreatingStation(true)}
            className="bg-green-600 hover:bg-green-700 text-white shadow-lg"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-1" /> Novo Posto
          </Button>
        ) : (
          <div className="bg-slate-900/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-green-500/50">
            <div className="text-sm text-white mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-400" />
              {newStationPosition ? "Arraste para ajustar" : "Clique no mapa"}
            </div>
            <div className="flex gap-2">
              {newStationPosition && (
                <Button
                  data-testid="btn-confirm-station"
                  onClick={handleConfirmNewStation}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  Confirmar
                </Button>
              )}
              <Button
                data-testid="btn-cancel-station"
                onClick={handleCancelCreation}
                size="sm"
                variant="outline"
                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Layers Control */}
        <div className="relative">
          <Button
            data-testid="btn-layers"
            onClick={() => setShowLayersMenu(!showLayersMenu)}
            variant="secondary"
            size="sm"
            className="bg-slate-900/90 hover:bg-slate-800 text-white shadow-lg"
          >
            <Layers className="w-4 h-4 mr-1" /> Camadas
          </Button>

          {showLayersMenu && (
            <div className="absolute top-full left-0 mt-2 bg-slate-900/95 backdrop-blur-sm rounded-lg p-2 shadow-lg border border-white/10 min-w-[160px]">
              <div className="text-xs text-gray-400 px-2 mb-2 uppercase tracking-wide">Tipo de Mapa</div>
              
              <button
                onClick={() => setMapType("roadmap")}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                  mapType === "roadmap" ? "bg-primary/20 text-primary" : "text-white hover:bg-white/10"
                }`}
              >
                <MapIcon className="w-4 h-4" /> Mapa
              </button>
              
              <button
                onClick={() => setMapType("satellite")}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                  mapType === "satellite" ? "bg-primary/20 text-primary" : "text-white hover:bg-white/10"
                }`}
              >
                <MapPin className="w-4 h-4" /> Satélite
              </button>
              
              <button
                onClick={() => setMapType("terrain")}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                  mapType === "terrain" ? "bg-primary/20 text-primary" : "text-white hover:bg-white/10"
                }`}
              >
                <Globe className="w-4 h-4" /> Relevo
              </button>
              
              <button
                onClick={() => setMapType("hybrid")}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                  mapType === "hybrid" ? "bg-primary/20 text-primary" : "text-white hover:bg-white/10"
                }`}
              >
                <Layers className="w-4 h-4" /> Híbrido
              </button>

              <div className="border-t border-white/10 my-2" />
              <div className="text-xs text-gray-400 px-2 mb-2 uppercase tracking-wide">Camadas</div>
              
              <button
                onClick={() => setShowTraffic(!showTraffic)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                  showTraffic ? "bg-primary/20 text-primary" : "text-white hover:bg-white/10"
                }`}
              >
                <Car className="w-4 h-4" /> Trânsito {showTraffic && "✓"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Creation Mode Indicator */}
      {isCreatingStation && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium animate-pulse">
          Modo de Criação Ativo - Clique no mapa para posicionar
        </div>
      )}
    </div>
  );
}
