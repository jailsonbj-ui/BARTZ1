import { useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Fuel, MapPin, AlertTriangle, Navigation, Star } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const TILE_LAYERS = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; Esri'
  },
  streets: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; OpenStreetMap'
  }
};

const getOverallRating = (ratings) => {
  if (!ratings) return 0;
  const { price_rating = 0, service_rating = 0, parking_rating = 0, security_rating = 0 } = ratings;
  return ((price_rating + service_rating + parking_rating + security_rating) / 4).toFixed(1);
};

const createStationIcon = (station, isPlannedStop, stopNumber) => {
  const rating = getOverallRating(station.ratings);
  const color = isPlannedStop ? "#10B981" : station.is_active ? "#F97316" : "#64748B";
  
  const iconHtml = renderToStaticMarkup(
    <div className="flex flex-col items-center">
      <div style={{ position: "relative" }}>
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
        {isPlannedStop && (
          <div
            style={{
              position: "absolute",
              top: "-8px",
              right: "-8px",
              backgroundColor: "#10B981",
              color: "white",
              borderRadius: "50%",
              width: "20px",
              height: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: "bold",
              border: "2px solid white",
            }}
          >
            {stopNumber}
          </div>
        )}
      </div>
      <div
        style={{
          backgroundColor: "#0F172A",
          color: "#F97316",
          fontSize: "10px",
          fontWeight: "bold",
          padding: "2px 6px",
          borderRadius: "4px",
          marginTop: "4px",
          fontFamily: "monospace",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        R${station.diesel_price?.toFixed(2)}
        {rating > 0 && (
          <span style={{ color: "#FBBF24", display: "flex", alignItems: "center" }}>
            <Star size={8} fill="#FBBF24" />
            {rating}
          </span>
        )}
      </div>
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: "custom-marker",
    iconSize: [50, 70],
    iconAnchor: [25, 70],
    popupAnchor: [0, -65],
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

function MapClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

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
  fuelPlan,
  onMapClick,
  mapStyle = "dark",
  theme = "dark",
}) {
  const mapRef = useRef(null);

  const center = useMemo(() => {
    if (routeData?.route_geometry?.length > 0) {
      const lats = routeData.route_geometry.map((p) => p[0]);
      const lngs = routeData.route_geometry.map((p) => p[1]);
      return [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2];
    }
    return [-26.5, -49.5];
  }, [routeData]);

  const plannedStopIds = useMemo(() => {
    if (!fuelPlan?.stops) return new Map();
    const map = new Map();
    fuelPlan.stops.forEach((stop, index) => {
      map.set(stop.station.id, index + 1);
    });
    return map;
  }, [fuelPlan]);

  const tileLayer = TILE_LAYERS[mapStyle] || TILE_LAYERS.dark;

  return (
    <MapContainer ref={mapRef} center={center} zoom={6} className="h-full w-full" data-testid="map-container">
      <TileLayer attribution={tileLayer.attribution} url={tileLayer.url} />
      <MapClickHandler onMapClick={onMapClick} />
      <MapBoundsUpdater routeData={routeData} />

      {/* Route Line */}
      {routeData?.route_geometry?.length > 1 && (
        <Polyline positions={routeData.route_geometry} color="#F97316" weight={5} opacity={0.9} />
      )}

      {/* Route Points */}
      {routeData?.route_points?.map((point, index) => (
        <Marker
          key={`route-point-${index}`}
          position={[point.lat, point.lng]}
          icon={createRoutePointIcon(
            index === 0 ? "origin" : index === routeData.route_points.length - 1 ? "destination" : "waypoint"
          )}
        >
          <Popup>
            <div className="text-sm font-medium">{point.name}</div>
            <div className="text-xs text-gray-500">
              {index === 0 ? "Origem" : index === routeData.route_points.length - 1 ? "Destino" : `Parada ${index}`}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Fuel Limit */}
      {routeData?.fuel_limit_point && !fuelPlan && (
        <Marker
          position={[routeData.fuel_limit_point.latitude, routeData.fuel_limit_point.longitude]}
          icon={createRoutePointIcon("fuelLimit")}
        >
          <Popup>
            <div className="text-sm font-medium text-red-500">Limite de Combustível</div>
            <div className="text-xs">{routeData.fuel_limit_point.distance_from_origin} km</div>
          </Popup>
        </Marker>
      )}

      {/* Gap indicators */}
      {fuelPlan?.gaps?.map((gap, index) => (
        <CircleMarker
          key={`gap-${index}`}
          center={routeData?.route_geometry?.[Math.floor(routeData.route_geometry.length * (gap.start_km / routeData.total_distance))] || [-25, -49]}
          radius={20}
          pathOptions={{ color: "#EF4444", fillColor: "#EF4444", fillOpacity: 0.3 }}
        >
          <Popup>
            <div className="text-sm font-medium text-red-500">Trecho sem postos</div>
            <div className="text-xs">{gap.start_km}km - {gap.end_km}km</div>
            <div className="text-xs text-gray-500">{gap.suggestion}</div>
          </Popup>
        </CircleMarker>
      ))}

      {/* Station Markers */}
      {stations.map((station) => {
        const stopNumber = plannedStopIds.get(station.id);
        return (
          <Marker
            key={station.id}
            position={[station.latitude, station.longitude]}
            icon={createStationIcon(station, !!stopNumber, stopNumber)}
            eventHandlers={{ click: () => setSelectedStation(station) }}
          >
            <Popup>
              <div className="p-1 min-w-[180px]">
                <div className="font-medium text-sm">{station.name}</div>
                {station.city && <div className="text-xs text-gray-500">{station.city}</div>}
                <div className="text-orange-500 font-mono font-bold text-lg">
                  R$ {station.diesel_price?.toFixed(2)}/L
                </div>
                {station.ratings && (
                  <div className="flex items-center gap-1 text-xs mt-1">
                    <Star size={12} className="text-yellow-400 fill-yellow-400" />
                    <span>{getOverallRating(station.ratings)}</span>
                    <span className="text-gray-400">({station.ratings.price_rating}P {station.ratings.service_rating}A {station.ratings.parking_rating}E {station.ratings.security_rating}S)</span>
                  </div>
                )}
                {station.parking && (
                  <div className="text-xs text-gray-500 mt-1">
                    Estacionamento: {
                      station.parking.parking_type === "free" ? "Grátis" :
                      station.parking.parking_type === "paid" ? "Pago" :
                      `Min. ${station.parking.min_fuel_liters}L`
                    }
                  </div>
                )}
                {stopNumber && (
                  <div className="mt-1 text-xs bg-green-500/20 text-green-600 px-2 py-0.5 rounded inline-block">
                    Parada #{stopNumber} do plano
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* New Station */}
      {selectedStation?.isNew && (
        <Marker
          position={[selectedStation.latitude, selectedStation.longitude]}
          icon={createStationIcon({ ...selectedStation, is_active: true }, false)}
        >
          <Popup><div className="text-sm">Novo posto</div></Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
