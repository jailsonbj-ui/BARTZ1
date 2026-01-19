import { useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Fuel, MapPin, AlertTriangle, Navigation } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Tile layer URLs for different styles
const TILE_LAYERS = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>'
  },
  streets: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }
};

// Custom icon creators
const createStationIcon = (isActive, isRecommended, price, isAlongRoute) => {
  const color = isRecommended ? "#10B981" : isAlongRoute ? "#3B82F6" : isActive ? "#F97316" : "#64748B";
  const pulseClass = isRecommended ? "marker-pulse" : "";
  
  const iconHtml = renderToStaticMarkup(
    <div className={`flex flex-col items-center ${pulseClass}`}>
      <div
        style={{
          backgroundColor: color,
          padding: "8px",
          borderRadius: "50%",
          border: "3px solid white",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}
      >
        <Fuel size={18} color="white" />
      </div>
      <div
        style={{
          backgroundColor: "#0F172A",
          color: isRecommended ? "#10B981" : "#F97316",
          fontSize: "11px",
          fontWeight: "bold",
          padding: "2px 6px",
          borderRadius: "4px",
          marginTop: "4px",
          fontFamily: "JetBrains Mono, monospace",
        }}
      >
        R$ {price.toFixed(2)}
      </div>
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: "custom-marker",
    iconSize: [50, 60],
    iconAnchor: [25, 60],
    popupAnchor: [0, -55],
  });
};

const createRoutePointIcon = (type) => {
  const colors = {
    origin: "#10B981",
    destination: "#EF4444",
    waypoint: "#3B82F6",
    fuelLimit: "#EF4444",
  };

  const icons = {
    origin: <Navigation size={16} color="white" />,
    destination: <MapPin size={16} color="white" />,
    waypoint: <MapPin size={14} color="white" />,
    fuelLimit: <AlertTriangle size={16} color="white" />,
  };

  const iconHtml = renderToStaticMarkup(
    <div
      className={type === "fuelLimit" ? "fuel-limit-marker" : ""}
      style={{
        backgroundColor: colors[type],
        padding: type === "fuelLimit" ? "6px" : "8px",
        borderRadius: "50%",
        border: "2px solid white",
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {icons[type]}
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: "custom-marker",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
};

// Map click handler component
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
}

// Map bounds updater
function MapBoundsUpdater({ routeData }) {
  const map = useMap();
  
  useEffect(() => {
    if (routeData?.route_geometry?.length > 0) {
      const bounds = L.latLngBounds(routeData.route_geometry);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [routeData, map]);
  
  return null;
}

export default function MapView({
  stations,
  selectedStation,
  setSelectedStation,
  routeData,
  recommendation,
  onMapClick,
  mapStyle = "dark",
  stationsAlongRoute = [],
}) {
  const mapRef = useRef(null);

  // Calculate map center
  const center = useMemo(() => {
    if (routeData?.route_geometry?.length > 0) {
      const lats = routeData.route_geometry.map((p) => p[0]);
      const lngs = routeData.route_geometry.map((p) => p[1]);
      return [
        (Math.min(...lats) + Math.max(...lats)) / 2,
        (Math.min(...lngs) + Math.max(...lngs)) / 2,
      ];
    }
    return [-26.5, -49.5]; // Default center between POA and SP
  }, [routeData]);

  // Check if station is recommended
  const isRecommended = (station) => {
    return recommendation?.recommendation?.station?.id === station.id;
  };

  // Check if station is along route
  const isAlongRoute = (station) => {
    return stationsAlongRoute.some(s => s.id === station.id);
  };

  const tileLayer = TILE_LAYERS[mapStyle] || TILE_LAYERS.dark;

  return (
    <MapContainer
      ref={mapRef}
      center={center}
      zoom={6}
      className="h-full w-full"
      data-testid="map-container"
    >
      <TileLayer
        attribution={tileLayer.attribution}
        url={tileLayer.url}
      />

      <MapClickHandler onMapClick={onMapClick} />
      <MapBoundsUpdater routeData={routeData} />

      {/* Route Line - Real road path */}
      {routeData?.route_geometry?.length > 1 && (
        <Polyline
          positions={routeData.route_geometry}
          color="#F97316"
          weight={5}
          opacity={0.9}
        />
      )}

      {/* Route Points from calculated route */}
      {routeData?.route_points?.map((point, index) => (
        <Marker
          key={`route-point-${index}`}
          position={[point.lat, point.lng]}
          icon={createRoutePointIcon(
            index === 0 ? "origin" : 
            index === routeData.route_points.length - 1 ? "destination" : 
            "waypoint"
          )}
        >
          <Popup className="dark-popup">
            <div className="text-sm font-medium">{point.name}</div>
            <div className="text-xs text-muted-foreground">
              {index === 0 ? "Origem" : index === routeData.route_points.length - 1 ? "Destino" : `Parada ${index}`}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Fuel Limit Point */}
      {routeData?.fuel_limit_point && (
        <Marker
          position={[routeData.fuel_limit_point.latitude, routeData.fuel_limit_point.longitude]}
          icon={createRoutePointIcon("fuelLimit")}
        >
          <Popup className="dark-popup">
            <div className="text-sm font-medium text-destructive">Limite de Combustível</div>
            <div className="text-xs text-muted-foreground">
              {routeData.fuel_limit_point.distance_from_origin} km da origem
            </div>
          </Popup>
        </Marker>
      )}

      {/* Station Markers */}
      {stations.map((station) => (
        <Marker
          key={station.id}
          position={[station.latitude, station.longitude]}
          icon={createStationIcon(
            station.is_active, 
            isRecommended(station), 
            station.diesel_price,
            isAlongRoute(station)
          )}
          eventHandlers={{
            click: () => setSelectedStation(station),
          }}
        >
          <Popup className="dark-popup">
            <div className="p-1">
              <div className="font-medium text-sm">{station.name}</div>
              {station.city && <div className="text-xs text-muted-foreground">{station.city}</div>}
              <div className="text-primary font-mono font-bold">
                R$ {station.diesel_price.toFixed(2)}/L
              </div>
              <div className={`text-xs ${station.is_active ? "text-green-500" : "text-gray-500"}`}>
                {station.is_active ? "Ativo" : "Inativo"}
              </div>
              {isRecommended(station) && (
                <div className="mt-1 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                  Recomendado pela IA
                </div>
              )}
              {isAlongRoute(station) && !isRecommended(station) && (
                <div className="mt-1 text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                  Na rota ({station.distance_to_route?.toFixed(0) || '?'} km)
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* New Station Marker (being created) */}
      {selectedStation?.isNew && (
        <Marker
          position={[selectedStation.latitude, selectedStation.longitude]}
          icon={createStationIcon(true, false, selectedStation.diesel_price || 5.5, false)}
        >
          <Popup className="dark-popup">
            <div className="text-sm">Novo posto</div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
