import { useEffect, useMemo, useCallback, useState, useRef } from "react";
import mapboxgl from "mapbox-gl";
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";
import { Plus, X, Layers, Map as MapIcon, Globe, Car, MapPin, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

// Set Mapbox access token
mapboxgl.accessToken = MAPBOX_TOKEN;

// Station icon types and colors
const STATION_ICONS = {
  fuel: { name: "Combustível", path: "M15 14h10v12h-10z M17 10h6v4h-6z M13 20h4v6h-4z" },
  star: { name: "Estrela", path: "M20 8l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" },
  circle: { name: "Círculo", path: "M20 12a8 8 0 100 16 8 8 0 000-16z" },
  square: { name: "Quadrado", path: "M12 12h16v16h-16z" },
  diamond: { name: "Losango", path: "M20 8l10 12-10 12-10-12z" },
  truck: { name: "Caminhão", path: "M10 16h14v8h-14z M24 18h4l3 4v2h-7z M13 26a2 2 0 100-4 2 2 0 000 4z M25 26a2 2 0 100-4 2 2 0 000 4z" },
  shell: { name: "Shell", path: "M20 8c-6 0-10 6-10 12s4 8 10 8 10-2 10-8-4-12-10-12z M14 18c0-3 2-6 6-6" },
  petrobras: { name: "Petrobras", path: "M20 8l8 6-3 10h-10l-3-10z M20 12v8 M16 16h8" },
  ipiranga: { name: "Ipiranga", path: "M12 12h16v12h-16z M20 8v4 M16 24v4 M24 24v4" },
  ale: { name: "ALE", path: "M20 8l10 16h-20z M20 14l4 8h-8z" },
  flag: { name: "Bandeira", path: "M12 8v20 M12 8h12l-4 6 4 6h-12" },
  pin: { name: "Pin", path: "M20 6c-5 0-9 4-9 9 0 7 9 15 9 15s9-8 9-15c0-5-4-9-9-9z M20 12a3 3 0 110 6 3 3 0 010-6z" },
  gas: { name: "Bomba", path: "M12 10h10v14h-10z M22 12h4v8h-4z M14 24h6v4h-6z M17 6v4" },
  drop: { name: "Gota", path: "M20 6c-6 10-10 14-10 18a10 10 0 0020 0c0-4-4-8-10-18z" },
};

// Cores claras/pastel para melhor visibilidade
const STATION_COLORS = {
  orange: { name: "Laranja", hex: "#FDBA74" },
  blue: { name: "Azul", hex: "#93C5FD" },
  green: { name: "Verde", hex: "#6EE7B7" },
  red: { name: "Vermelho", hex: "#FCA5A5" },
  purple: { name: "Roxo", hex: "#C4B5FD" },
  yellow: { name: "Amarelo", hex: "#FDE047" },
  pink: { name: "Rosa", hex: "#F9A8D4" },
  cyan: { name: "Ciano", hex: "#67E8F9" },
  lime: { name: "Lima", hex: "#BEF264" },
  amber: { name: "Âmbar", hex: "#FCD34D" },
  white: { name: "Branco", hex: "#F8FAFC" },
  teal: { name: "Turquesa", hex: "#5EEAD4" },
};

// Price ranking colors
const PRICE_RANKING_COLORS = {
  best: "#10B981",
  worst: "#EF4444",
  normal: null,
};

// Export for use in ControlPanel
export { STATION_ICONS, STATION_COLORS };

// Utility: Escape HTML to prevent XSS
const escapeHtml = (text) => {
  if (text === null || text === undefined) return '';
  const str = String(text);
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

// Utility: Sanitize number for display
const sanitizeNumber = (num, decimals = 2) => {
  const parsed = parseFloat(num);
  if (isNaN(parsed)) return '0.00';
  return parsed.toFixed(decimals);
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
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const popupRef = useRef(null);
  const geocoderRef = useRef(null);
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isCreatingStation, setIsCreatingStation] = useState(false);
  const [newStationPosition, setNewStationPosition] = useState(null);
  const [showTraffic, setShowTraffic] = useState(true);
  const [mapType, setMapType] = useState("hybrid");
  const [showLayersMenu, setShowLayersMenu] = useState(false);
  const [searchMarker, setSearchMarker] = useState(null);

  // Calculate planned stop IDs
  const plannedStopIds = useMemo(() => {
    if (!fuelPlan?.stops) return new Map();
    const stopMap = new Map();
    fuelPlan.stops.forEach((stop, index) => {
      stopMap.set(stop.station.id, index + 1);
    });
    return stopMap;
  }, [fuelPlan]);

  // Calculate price rankings by state
  const priceRankings = useMemo(() => {
    const rankings = new Map();
    const stationsByState = new Map();
    
    stations.forEach(station => {
      if (station.is_active === false) return;
      if (!station.diesel_price) return;
      
      let state = "UNKNOWN";
      if (station.city) {
        const match = station.city.match(/-([A-Z]{2})$/);
        if (match) {
          state = match[1];
        } else {
          const parts = station.city.split(/[-,]/);
          if (parts.length > 1) {
            state = parts[parts.length - 1].trim().toUpperCase();
          }
        }
      }
      
      if (!stationsByState.has(state)) {
        stationsByState.set(state, []);
      }
      stationsByState.get(state).push(station);
    });
    
    stationsByState.forEach((stateStations) => {
      if (stateStations.length < 2) return;
      
      const sorted = [...stateStations].sort((a, b) => a.diesel_price - b.diesel_price);
      const bestCount = Math.min(3, Math.floor(sorted.length / 2));
      
      for (let i = 0; i < bestCount; i++) {
        rankings.set(sorted[i].id, "best");
      }
      
      const worstCount = Math.min(3, Math.floor(sorted.length / 2));
      for (let i = 0; i < worstCount; i++) {
        const worstIndex = sorted.length - 1 - i;
        if (!rankings.has(sorted[worstIndex].id)) {
          rankings.set(sorted[worstIndex].id, "worst");
        }
      }
    });
    
    return rankings;
  }, [stations]);

  // Get marker color based on station state
  const getMarkerColor = useCallback((station, isPlannedStop, priceRanking) => {
    if (isPlannedStop) return "#10B981";
    if (station.is_active === false) return "#64748B";
    if (priceRanking === "best") return PRICE_RANKING_COLORS.best;
    if (priceRanking === "worst") return PRICE_RANKING_COLORS.worst;
    return STATION_COLORS[station.marker_color]?.hex || "#F97316";
  }, []);

  // Create station marker element using DOM APIs (XSS-safe)
  const createStationMarkerElement = useCallback((station, isPlannedStop, stopNumber, priceRanking) => {
    const color = getMarkerColor(station, isPlannedStop, priceRanking);
    const isActive = station.is_active !== false;
    const opacity = isActive ? 1 : 0.6;
    
    const el = document.createElement('div');
    el.className = 'station-marker';
    el.style.cssText = `width: 40px; height: 56px; cursor: pointer; opacity: ${opacity};`;
    
    // Create SVG using DOM APIs (XSS-safe)
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "40");
    svg.setAttribute("height", "56");
    svg.setAttribute("viewBox", "0 0 40 56");
    
    // Defs for shadow
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    filter.setAttribute("id", `shadow-${escapeHtml(station.id)}`);
    filter.setAttribute("x", "-50%");
    filter.setAttribute("y", "-50%");
    filter.setAttribute("width", "200%");
    filter.setAttribute("height", "200%");
    
    const feDropShadow = document.createElementNS("http://www.w3.org/2000/svg", "feDropShadow");
    feDropShadow.setAttribute("dx", "0");
    feDropShadow.setAttribute("dy", "2");
    feDropShadow.setAttribute("stdDeviation", "2");
    feDropShadow.setAttribute("flood-color", "#000");
    feDropShadow.setAttribute("flood-opacity", "0.3");
    filter.appendChild(feDropShadow);
    defs.appendChild(filter);
    svg.appendChild(defs);
    
    // Main circle
    const borderColor = priceRanking === "best" ? "#065F46" : priceRanking === "worst" ? "#7F1D1D" : "white";
    const borderWidth = priceRanking ? 4 : 3;
    
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "20");
    circle.setAttribute("cy", "20");
    circle.setAttribute("r", "16");
    circle.setAttribute("fill", color);
    circle.setAttribute("stroke", borderColor);
    circle.setAttribute("stroke-width", String(borderWidth));
    circle.setAttribute("filter", `url(#shadow-${escapeHtml(station.id)})`);
    svg.appendChild(circle);
    
    // Badge for planned stop or price ranking
    if (isPlannedStop) {
      const badgeCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      badgeCircle.setAttribute("cx", "32");
      badgeCircle.setAttribute("cy", "8");
      badgeCircle.setAttribute("r", "8");
      badgeCircle.setAttribute("fill", "#10B981");
      badgeCircle.setAttribute("stroke", "white");
      badgeCircle.setAttribute("stroke-width", "2");
      svg.appendChild(badgeCircle);
      
      const badgeText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      badgeText.setAttribute("x", "32");
      badgeText.setAttribute("y", "12");
      badgeText.setAttribute("text-anchor", "middle");
      badgeText.setAttribute("fill", "white");
      badgeText.setAttribute("font-size", "10");
      badgeText.setAttribute("font-weight", "bold");
      badgeText.textContent = String(stopNumber);
      svg.appendChild(badgeText);
    } else if (priceRanking === "best") {
      const badgeCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      badgeCircle.setAttribute("cx", "32");
      badgeCircle.setAttribute("cy", "8");
      badgeCircle.setAttribute("r", "8");
      badgeCircle.setAttribute("fill", "#10B981");
      badgeCircle.setAttribute("stroke", "white");
      badgeCircle.setAttribute("stroke-width", "2");
      svg.appendChild(badgeCircle);
      
      const badgeText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      badgeText.setAttribute("x", "32");
      badgeText.setAttribute("y", "12");
      badgeText.setAttribute("text-anchor", "middle");
      badgeText.setAttribute("fill", "white");
      badgeText.setAttribute("font-size", "10");
      badgeText.setAttribute("font-weight", "bold");
      badgeText.textContent = "★";
      svg.appendChild(badgeText);
    } else if (priceRanking === "worst") {
      const badgeCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      badgeCircle.setAttribute("cx", "32");
      badgeCircle.setAttribute("cy", "8");
      badgeCircle.setAttribute("r", "8");
      badgeCircle.setAttribute("fill", "#EF4444");
      badgeCircle.setAttribute("stroke", "white");
      badgeCircle.setAttribute("stroke-width", "2");
      svg.appendChild(badgeCircle);
      
      const badgeText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      badgeText.setAttribute("x", "32");
      badgeText.setAttribute("y", "12");
      badgeText.setAttribute("text-anchor", "middle");
      badgeText.setAttribute("fill", "white");
      badgeText.setAttribute("font-size", "10");
      badgeText.setAttribute("font-weight", "bold");
      badgeText.textContent = "!";
      svg.appendChild(badgeText);
    }
    
    // Inactive line
    if (!isActive) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", "8");
      line.setAttribute("y1", "8");
      line.setAttribute("x2", "32");
      line.setAttribute("y2", "32");
      line.setAttribute("stroke", "#EF4444");
      line.setAttribute("stroke-width", "3");
      svg.appendChild(line);
    }
    
    // Price background rect
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "5");
    rect.setAttribute("y", "42");
    rect.setAttribute("width", "30");
    rect.setAttribute("height", "14");
    rect.setAttribute("rx", "3");
    rect.setAttribute("fill", "#0F172A");
    svg.appendChild(rect);
    
    // Price text
    const priceText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    priceText.setAttribute("x", "20");
    priceText.setAttribute("y", "52");
    priceText.setAttribute("text-anchor", "middle");
    priceText.setAttribute("fill", isActive ? color : '#64748B');
    priceText.setAttribute("font-size", "9");
    priceText.setAttribute("font-weight", "bold");
    priceText.setAttribute("font-family", "monospace");
    priceText.textContent = `R$${sanitizeNumber(station.diesel_price)}`;
    svg.appendChild(priceText);
    
    el.appendChild(svg);
    return el;
  }, [getMarkerColor]);

  // Create popup content element (XSS-safe using DOM APIs)
  const createStationPopupElement = useCallback((station, isPlannedStop, stopNumber, priceRanking) => {
    const container = document.createElement('div');
    container.style.cssText = 'padding: 8px; min-width: 180px; font-family: system-ui, sans-serif;';
    
    // Station name
    const nameDiv = document.createElement('div');
    nameDiv.style.cssText = 'font-weight: 600; font-size: 14px; color: #1f2937;';
    nameDiv.textContent = station.name || 'Posto sem nome';
    container.appendChild(nameDiv);
    
    // City
    if (station.city) {
      const cityDiv = document.createElement('div');
      cityDiv.style.cssText = 'font-size: 12px; color: #6b7280;';
      cityDiv.textContent = station.city;
      container.appendChild(cityDiv);
    }
    
    // Price
    const priceColor = priceRanking === "best" ? "#10B981" : priceRanking === "worst" ? "#EF4444" : "#F97316";
    const priceDiv = document.createElement('div');
    priceDiv.style.cssText = `font-family: monospace; font-weight: 700; font-size: 18px; margin-top: 4px; color: ${priceColor};`;
    
    const priceSpan = document.createElement('span');
    priceSpan.textContent = `R$ ${sanitizeNumber(station.diesel_price)}/L`;
    priceDiv.appendChild(priceSpan);
    
    if (priceRanking === "best") {
      const labelSpan = document.createElement('span');
      labelSpan.style.cssText = 'font-size: 11px; font-weight: 400; margin-left: 4px;';
      labelSpan.textContent = '★ Melhor preço';
      priceDiv.appendChild(labelSpan);
    } else if (priceRanking === "worst") {
      const labelSpan = document.createElement('span');
      labelSpan.style.cssText = 'font-size: 11px; font-weight: 400; margin-left: 4px;';
      labelSpan.textContent = '⚠ Preço alto';
      priceDiv.appendChild(labelSpan);
    }
    container.appendChild(priceDiv);
    
    // Inactive badge
    if (!station.is_active) {
      const inactiveDiv = document.createElement('div');
      inactiveDiv.style.cssText = 'font-size: 11px; background: #fee2e2; color: #dc2626; padding: 2px 8px; border-radius: 4px; margin-top: 4px; display: inline-block;';
      inactiveDiv.textContent = 'INATIVO';
      container.appendChild(inactiveDiv);
    }
    
    // Planned stop badge
    if (isPlannedStop) {
      const plannedDiv = document.createElement('div');
      plannedDiv.style.cssText = 'margin-top: 8px; font-size: 11px; background: #d1fae5; color: #059669; padding: 4px 8px; border-radius: 4px; display: inline-block;';
      plannedDiv.textContent = `Parada #${stopNumber} do plano`;
      container.appendChild(plannedDiv);
    }
    
    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.style.cssText = 'margin-top: 8px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 4px; background: #3b82f6; color: white; font-size: 11px; padding: 6px 8px; border-radius: 4px; border: none; cursor: pointer;';
    copyBtn.textContent = '📋 Copiar Link Google Maps';
    copyBtn.addEventListener('click', () => {
      const lat = sanitizeNumber(station.latitude, 6);
      const lng = sanitizeNumber(station.longitude, 6);
      const mapsLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      navigator.clipboard.writeText(mapsLink).then(() => {
        alert('Link copiado!');
      });
    });
    container.appendChild(copyBtn);
    
    return container;
  }, []);

  // Create search marker popup element (XSS-safe)
  const createSearchPopupElement = useCallback((marker, onCreateClick) => {
    const container = document.createElement('div');
    container.style.cssText = 'padding: 8px; font-family: system-ui, sans-serif;';
    
    const nameDiv = document.createElement('div');
    nameDiv.style.cssText = 'font-weight: 600; font-size: 14px; color: #1f2937;';
    nameDiv.textContent = marker.name || 'Local selecionado';
    container.appendChild(nameDiv);
    
    const coordsDiv = document.createElement('div');
    coordsDiv.style.cssText = 'font-size: 11px; color: #6b7280; margin-top: 4px;';
    coordsDiv.textContent = `${sanitizeNumber(marker.lat, 6)}, ${sanitizeNumber(marker.lng, 6)}`;
    container.appendChild(coordsDiv);
    
    const createBtn = document.createElement('button');
    createBtn.style.cssText = 'margin-top: 8px; width: 100%; background: #10B981; color: white; font-size: 12px; padding: 8px; border-radius: 6px; border: none; cursor: pointer; font-weight: 600;';
    createBtn.textContent = '+ Criar Posto Aqui';
    createBtn.addEventListener('click', onCreateClick);
    container.appendChild(createBtn);
    
    return container;
  }, []);

  // Create route point marker element (XSS-safe)
  const createRoutePointElement = useCallback((type) => {
    const colors = {
      origin: "#10B981",
      destination: "#EF4444",
      waypoint: "#3B82F6",
    };
    
    const el = document.createElement('div');
    el.style.cursor = 'pointer';
    
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "32");
    svg.setAttribute("height", "32");
    svg.setAttribute("viewBox", "0 0 32 32");
    
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "16");
    circle.setAttribute("cy", "16");
    circle.setAttribute("r", "14");
    circle.setAttribute("fill", colors[type] || colors.waypoint);
    circle.setAttribute("stroke", "white");
    circle.setAttribute("stroke-width", "2");
    svg.appendChild(circle);
    
    if (type === 'origin') {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M16 8l6 10h-12z");
      path.setAttribute("fill", "white");
      svg.appendChild(path);
    } else if (type === 'destination') {
      const innerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      innerCircle.setAttribute("cx", "16");
      innerCircle.setAttribute("cy", "16");
      innerCircle.setAttribute("r", "5");
      innerCircle.setAttribute("fill", "white");
      svg.appendChild(innerCircle);
    } else {
      const innerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      innerCircle.setAttribute("cx", "16");
      innerCircle.setAttribute("cy", "16");
      innerCircle.setAttribute("r", "4");
      innerCircle.setAttribute("fill", "white");
      svg.appendChild(innerCircle);
    }
    
    el.appendChild(svg);
    return el;
  }, []);

  // Create new station marker element (XSS-safe)
  const createNewStationMarkerElement = useCallback(() => {
    const el = document.createElement('div');
    
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "40");
    svg.setAttribute("height", "40");
    svg.setAttribute("viewBox", "0 0 40 40");
    
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "20");
    circle.setAttribute("cy", "20");
    circle.setAttribute("r", "18");
    circle.setAttribute("fill", "#10B981");
    circle.setAttribute("stroke", "white");
    circle.setAttribute("stroke-width", "3");
    circle.setAttribute("stroke-dasharray", "5,3");
    svg.appendChild(circle);
    
    const vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    vLine.setAttribute("x1", "20");
    vLine.setAttribute("y1", "10");
    vLine.setAttribute("x2", "20");
    vLine.setAttribute("y2", "30");
    vLine.setAttribute("stroke", "white");
    vLine.setAttribute("stroke-width", "3");
    svg.appendChild(vLine);
    
    const hLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    hLine.setAttribute("x1", "10");
    hLine.setAttribute("y1", "20");
    hLine.setAttribute("x2", "30");
    hLine.setAttribute("y2", "20");
    hLine.setAttribute("stroke", "white");
    hLine.setAttribute("stroke-width", "3");
    svg.appendChild(hLine);
    
    el.appendChild(svg);
    return el;
  }, []);

  // Create search result marker element (XSS-safe)
  const createSearchMarkerElement = useCallback(() => {
    const el = document.createElement('div');
    el.style.cursor = 'pointer';
    
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "40");
    svg.setAttribute("height", "50");
    svg.setAttribute("viewBox", "0 0 40 50");
    
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M20 0 C9 0 0 9 0 20 C0 35 20 50 20 50 C20 50 40 35 40 20 C40 9 31 0 20 0 Z");
    path.setAttribute("fill", "#EF4444");
    path.setAttribute("stroke", "white");
    path.setAttribute("stroke-width", "2");
    svg.appendChild(path);
    
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "20");
    circle.setAttribute("cy", "18");
    circle.setAttribute("r", "8");
    circle.setAttribute("fill", "white");
    svg.appendChild(circle);
    
    el.appendChild(svg);
    return el;
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapType === "hybrid" ? "mapbox://styles/mapbox/satellite-streets-v12" : "mapbox://styles/mapbox/dark-v11",
      center: [-49.5, -26.5],
      zoom: 6,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-left');
    map.addControl(new mapboxgl.ScaleControl(), 'bottom-left');
    
    // Add geocoder
    const geocoder = new MapboxGeocoder({
      accessToken: MAPBOX_TOKEN,
      mapboxgl: mapboxgl,
      placeholder: 'Buscar local no mapa...',
      countries: 'br',
      language: 'pt-BR',
      marker: false,
    });
    
    geocoderRef.current = geocoder;
    map.addControl(geocoder, 'top-right');

    geocoder.on('result', (e) => {
      const { center, place_name, text } = e.result;
      setSearchMarker({
        lng: center[0],
        lat: center[1],
        name: place_name || text,
        placeName: text,
        city: place_name,
      });
    });

    geocoder.on('clear', () => {
      setSearchMarker(null);
    });

    map.on('load', () => {
      setMapLoaded(true);
      
      // Add traffic layer source
      if (!map.getSource('mapbox-traffic')) {
        map.addSource('mapbox-traffic', {
          type: 'vector',
          url: 'mapbox://mapbox.mapbox-traffic-v1'
        });
      }
    });

    map.on('click', (e) => {
      if (isCreatingStation) {
        setNewStationPosition({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [isCreatingStation, mapType]);

  // Update map style when mapType changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    
    const style = mapType === "hybrid" 
      ? "mapbox://styles/mapbox/satellite-streets-v12" 
      : mapType === "satellite"
      ? "mapbox://styles/mapbox/satellite-v9"
      : "mapbox://styles/mapbox/dark-v11";
    
    mapRef.current.setStyle(style);
  }, [mapType, mapLoaded]);

  // Update traffic layer
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    
    const map = mapRef.current;
    
    const handleStyleLoad = () => {
      if (showTraffic) {
        if (!map.getSource('mapbox-traffic')) {
          map.addSource('mapbox-traffic', {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-traffic-v1'
          });
        }
        
        if (!map.getLayer('traffic-layer')) {
          map.addLayer({
            id: 'traffic-layer',
            type: 'line',
            source: 'mapbox-traffic',
            'source-layer': 'traffic',
            paint: {
              'line-width': 2,
              'line-color': [
                'match',
                ['get', 'congestion'],
                'low', '#10B981',
                'moderate', '#F59E0B',
                'heavy', '#EF4444',
                'severe', '#7C3AED',
                '#6B7280'
              ]
            }
          });
        }
      } else {
        if (map.getLayer('traffic-layer')) {
          map.removeLayer('traffic-layer');
        }
      }
    };
    
    map.on('style.load', handleStyleLoad);
    
    return () => {
      map.off('style.load', handleStyleLoad);
    };
  }, [showTraffic, mapLoaded]);

  // Update route on map
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    
    const map = mapRef.current;
    
    const updateRoute = () => {
      // Remove existing route
      if (map.getLayer('route-line')) {
        map.removeLayer('route-line');
      }
      if (map.getSource('route')) {
        map.removeSource('route');
      }

      if (routeData?.route_geometry?.length > 1) {
        // Convert [lat, lng] to [lng, lat] for Mapbox
        const coordinates = routeData.route_geometry.map(point => [point[1], point[0]]);
        
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: coordinates
            }
          }
        });

        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#F97316',
            'line-width': 5,
            'line-opacity': 0.9
          }
        });

        // Fit bounds to route
        const bounds = new mapboxgl.LngLatBounds();
        coordinates.forEach(coord => bounds.extend(coord));
        map.fitBounds(bounds, { padding: 50 });
      }
    };

    if (map.isStyleLoaded()) {
      updateRoute();
    } else {
      map.on('style.load', updateRoute);
    }
  }, [routeData, mapLoaded]);

  // Update station markers
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    
    const map = mapRef.current;
    
    // Remove old markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    // Add station markers
    stations.forEach(station => {
      const stopNumber = plannedStopIds.get(station.id);
      const isPlannedStop = !!stopNumber;
      const priceRanking = priceRankings.get(station.id);
      
      const el = createStationMarkerElement(station, isPlannedStop, stopNumber, priceRanking);
      
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([station.longitude, station.latitude])
        .addTo(map);

      // Add click handler for popup
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Close existing popup
        if (popupRef.current) {
          popupRef.current.remove();
        }

        const popupContent = createStationPopupElement(station, isPlannedStop, stopNumber, priceRanking);
        
        const popup = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: true,
          maxWidth: '300px',
        })
          .setLngLat([station.longitude, station.latitude])
          .setDOMContent(popupContent)
          .addTo(map);

        popupRef.current = popup;
        setSelectedStation(station);
      });

      markersRef.current[station.id] = marker;
    });
  }, [stations, plannedStopIds, priceRankings, mapLoaded, setSelectedStation, createStationMarkerElement, createStationPopupElement]);

  // Add route point markers
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !routeData?.route_points) return;
    
    const map = mapRef.current;
    
    routeData.route_points.forEach((point, index) => {
      const type = index === 0 ? "origin" : index === routeData.route_points.length - 1 ? "destination" : "waypoint";
      const el = createRoutePointElement(type);

      new mapboxgl.Marker({ element: el })
        .setLngLat([point.lng, point.lat])
        .addTo(map);
    });
  }, [routeData, mapLoaded, createRoutePointElement]);

  // Search marker
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    
    const map = mapRef.current;
    
    // Remove existing search marker
    if (markersRef.current['search-marker']) {
      markersRef.current['search-marker'].remove();
      delete markersRef.current['search-marker'];
    }

    if (searchMarker) {
      const el = createSearchMarkerElement();

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([searchMarker.lng, searchMarker.lat])
        .addTo(map);

      // Add popup with create station button
      el.addEventListener('click', () => {
        if (popupRef.current) popupRef.current.remove();
        
        const popupContent = createSearchPopupElement(searchMarker, () => {
          setNewStationPosition({
            lat: searchMarker.lat,
            lng: searchMarker.lng,
            suggestedName: searchMarker.placeName || "",
            suggestedCity: searchMarker.city || "",
          });
          if (popupRef.current) popupRef.current.remove();
        });
        
        const popup = new mapboxgl.Popup({ closeButton: true, maxWidth: '280px' })
          .setLngLat([searchMarker.lng, searchMarker.lat])
          .setDOMContent(popupContent)
          .addTo(map);

        popupRef.current = popup;
      });

      markersRef.current['search-marker'] = marker;
      
      map.flyTo({
        center: [searchMarker.lng, searchMarker.lat],
        zoom: 14,
      });
    }
  }, [searchMarker, mapLoaded, createSearchMarkerElement, createSearchPopupElement]);

  // Handle new station position
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    
    const map = mapRef.current;
    
    // Remove existing new station marker
    if (markersRef.current['new-station']) {
      markersRef.current['new-station'].remove();
      delete markersRef.current['new-station'];
    }

    if (newStationPosition) {
      const el = createNewStationMarkerElement();

      const marker = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat([newStationPosition.lng, newStationPosition.lat])
        .addTo(map);

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        setNewStationPosition(prev => ({
          ...prev,
          lat: lngLat.lat,
          lng: lngLat.lng,
        }));
      });

      markersRef.current['new-station'] = marker;
    }
  }, [newStationPosition, mapLoaded, createNewStationMarkerElement]);

  const handleConfirmNewStation = useCallback(() => {
    if (newStationPosition && onCreateStation) {
      onCreateStation(newStationPosition);
      setIsCreatingStation(false);
      setNewStationPosition(null);
      setSearchMarker(null);
      if (geocoderRef.current) {
        geocoderRef.current.clear();
      }
    }
  }, [newStationPosition, onCreateStation]);

  const handleCancelCreation = useCallback(() => {
    setIsCreatingStation(false);
    setNewStationPosition(null);
  }, []);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-900 text-red-400">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
          <p>Token do Mapbox não configurado</p>
          <p className="text-sm text-gray-500 mt-2">Configure REACT_APP_MAPBOX_TOKEN</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* Map Container */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Loading State */}
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
          <div className="text-center text-gray-400">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin" />
            <p>Carregando mapa...</p>
          </div>
        </div>
      )}

      {/* Top Left Controls */}
      <div className="absolute top-24 left-3 z-10 flex flex-col gap-2">
        {/* Create Station Button */}
        <Button
          data-testid="btn-create-station"
          onClick={() => setIsCreatingStation(!isCreatingStation)}
          className={`${isCreatingStation ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'} text-white shadow-lg`}
          size="sm"
        >
          {isCreatingStation ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          {isCreatingStation ? 'Cancelar' : 'Novo Posto'}
        </Button>

        {/* Layers Menu */}
        <div className="relative">
          <Button
            data-testid="btn-layers"
            onClick={() => setShowLayersMenu(!showLayersMenu)}
            className="bg-slate-800/90 hover:bg-slate-700 text-white shadow-lg"
            size="sm"
          >
            <Layers className="w-4 h-4 mr-1" />
            Camadas
          </Button>

          {showLayersMenu && (
            <div className="absolute top-full left-0 mt-1 bg-slate-800/95 backdrop-blur rounded-lg shadow-xl border border-white/10 p-3 min-w-[180px]">
              <div className="text-xs text-gray-400 mb-2 font-medium">Tipo de Mapa</div>
              <div className="space-y-1 mb-3">
                {[
                  { id: 'hybrid', label: 'Híbrido', icon: Globe },
                  { id: 'satellite', label: 'Satélite', icon: Globe },
                  { id: 'roadmap', label: 'Mapa', icon: MapIcon },
                ].map(type => (
                  <button
                    key={type.id}
                    onClick={() => setMapType(type.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                      mapType === type.id ? 'bg-orange-500/20 text-orange-400' : 'text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <type.icon className="w-4 h-4" />
                    {type.label}
                  </button>
                ))}
              </div>
              
              <div className="text-xs text-gray-400 mb-2 font-medium border-t border-white/10 pt-2">Camadas</div>
              <button
                onClick={() => setShowTraffic(!showTraffic)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                  showTraffic ? 'bg-green-500/20 text-green-400' : 'text-gray-300 hover:bg-white/10'
                }`}
              >
                <Car className="w-4 h-4" />
                Trânsito
                {showTraffic && <span className="ml-auto text-xs">✓</span>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New Station Confirmation */}
      {newStationPosition && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 bg-slate-800/95 backdrop-blur rounded-lg shadow-xl border border-white/10 p-4">
          <div className="text-center mb-3">
            <p className="text-white font-medium">Criar posto nesta localização?</p>
            <p className="text-xs text-gray-400 mt-1">
              {sanitizeNumber(newStationPosition.lat, 6)}, {sanitizeNumber(newStationPosition.lng, 6)}
            </p>
            {newStationPosition.suggestedName && (
              <p className="text-xs text-orange-400 mt-1">{escapeHtml(newStationPosition.suggestedName)}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleCancelCreation}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmNewStation}
              className="flex-1 bg-green-600 hover:bg-green-700"
              size="sm"
            >
              Confirmar
            </Button>
          </div>
        </div>
      )}

      {/* Creation Mode Indicator */}
      {isCreatingStation && !newStationPosition && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 bg-orange-500/90 backdrop-blur text-white px-4 py-2 rounded-full shadow-lg">
          <p className="text-sm font-medium flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Clique no mapa ou busque um local para criar o posto
          </p>
        </div>
      )}

      {/* Attribution */}
      <div className="absolute bottom-1 right-1 text-[10px] text-gray-500 bg-white/80 px-1 rounded">
        © Mapbox © OpenStreetMap
      </div>
    </div>
  );
}
