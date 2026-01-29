import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import MapView from "@/components/MapView";
import ControlPanel from "@/components/ControlPanel";
import { Fuel, PanelRightClose, PanelRightOpen, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Available themes
const THEMES = {
  dark: {
    name: "Escuro",
    bg: "bg-slate-950",
    accent: "text-orange-500",
    map: "dark"
  },
  ocean: {
    name: "Oceano",
    bg: "bg-blue-950",
    accent: "text-cyan-400",
    map: "dark"
  },
  forest: {
    name: "Floresta",
    bg: "bg-emerald-950",
    accent: "text-emerald-400",
    map: "dark"
  },
  sunset: {
    name: "Pôr do Sol",
    bg: "bg-amber-950",
    accent: "text-amber-400",
    map: "dark"
  },
  midnight: {
    name: "Meia-Noite",
    bg: "bg-indigo-950",
    accent: "text-violet-400",
    map: "dark"
  },
  light: {
    name: "Claro",
    bg: "bg-gray-100",
    accent: "text-blue-600",
    map: "streets"
  }
};

export default function FleetDashboard() {
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("route");
  const [routeData, setRouteData] = useState(null);
  const [directionsResponse, setDirectionsResponse] = useState(null);
  const [mapStyle, setMapStyle] = useState("dark");
  const [theme, setTheme] = useState("dark");
  const [vehicle, setVehicle] = useState({
    current_liters: 200,
    consumption_rate: 2.5,
    tank_capacity: 850,
  });
  const [fuelInputMode, setFuelInputMode] = useState("liters"); // "liters" or "percentage"
  const [originCity, setOriginCity] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [waypointCities, setWaypointCities] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [serviceOrder, setServiceOrder] = useState(null);
  const [fuelPlan, setFuelPlan] = useState(null);
  const [aiResponse, setAiResponse] = useState(null);
  const [planModified, setPlanModified] = useState(false);

  useEffect(() => {
    fetchStations();
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const fetchStations = async () => {
    try {
      const response = await axios.get(`${API}/stations`);
      setStations(response.data);
      if (response.data.length === 0) {
        await axios.post(`${API}/seed-stations`);
        const seededResponse = await axios.get(`${API}/stations`);
        setStations(seededResponse.data);
        toast.success("Postos de exemplo carregados!");
      }
    } catch (error) {
      console.error("Error fetching stations:", error);
      toast.error("Erro ao carregar postos");
    }
  };

  const searchCities = async (query) => {
    if (query.length < 2) return [];
    try {
      const response = await axios.get(`${API}/search-cities`, { params: { query } });
      return response.data;
    } catch (error) {
      console.error("Error searching cities:", error);
      return [];
    }
  };

  const calculateRoute = useCallback(async () => {
    if (!originCity.trim() || !destinationCity.trim()) {
      toast.error("Selecione origem e destino!");
      return;
    }
    
    setIsLoading(true);
    setFuelPlan(null);
    setAiResponse(null);
    setPlanModified(false);
    setDirectionsResponse(null);
    
    try {
      const response = await axios.post(`${API}/calculate-route`, {
        origin_city: originCity,
        destination_city: waypointCities.filter(c => c.trim()).length > 0 ? destinationCity : destinationCity,
        waypoint_cities: waypointCities.filter(c => c.trim()),
        vehicle,
      });
      
      // Add unique ID to force re-render of route
      const routeWithId = { ...response.data, id: Date.now() };
      setRouteData(routeWithId);
      
      // Get Google Directions for draggable route
      if (window.google && window.google.maps) {
        const directionsService = new window.google.maps.DirectionsService();
        
        const waypts = waypointCities
          .filter(c => c.trim())
          .map(city => ({
            location: city,
            stopover: true
          }));
        
        directionsService.route(
          {
            origin: originCity,
            destination: destinationCity,
            waypoints: waypts,
            travelMode: window.google.maps.TravelMode.DRIVING,
            region: 'BR'
          },
          (result, status) => {
            if (status === 'OK') {
              setDirectionsResponse(result);
            } else {
              console.log('Directions request failed:', status);
              // Keep using Polyline as fallback
            }
          }
        );
      }
      
      // Auto-plan fuel stops when:
      // 1. Distance > autonomy (won't make it), OR
      // 2. Final fuel would be less than 30% of tank (risky), OR
      // 3. Route is longer than 500km (good to have options)
      const fuelNeeded = response.data.total_distance / vehicle.consumption_rate;
      const finalFuel = vehicle.current_liters - fuelNeeded;
      const finalFuelPercent = (finalFuel / vehicle.tank_capacity) * 100;
      
      const shouldPlanStops = 
        response.data.total_distance > response.data.autonomy || 
        finalFuelPercent < 30 ||
        response.data.total_distance > 500;
      
      if (shouldPlanStops && stations.length > 0) {
        await planFuelStops(routeWithId);
      }
      
      toast.success(`Rota: ${response.data.total_distance.toFixed(0)} km`);
    } catch (error) {
      console.error("Error calculating route:", error);
      toast.error(error.response?.data?.detail || "Erro ao calcular rota");
    } finally {
      setIsLoading(false);
    }
  }, [originCity, destinationCity, waypointCities, vehicle]);

  const planFuelStops = async (routeInfo) => {
    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/plan-fuel-stops`, {
        route_distance: routeInfo.total_distance,
        route_geometry: routeInfo.route_geometry,
        vehicle,
        stations,
      });
      setFuelPlan(response.data);
      
      if (response.data.has_gaps) {
        toast.warning(`Atenção: ${response.data.gaps.length} trecho(s) sem postos cadastrados`);
      } else {
        toast.success(`Plano: ${response.data.total_stops} paradas, R$ ${response.data.total_cost.toFixed(2)}`);
      }
    } catch (error) {
      console.error("Error planning fuel stops:", error);
      toast.error("Erro ao planejar abastecimentos");
    } finally {
      setIsLoading(false);
    }
  };

  const generateServiceOrder = async (station, fuelAmount) => {
    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/generate-service-order`, {
        station_name: station.name,
        station_location: station.city || `${station.latitude.toFixed(4)}, ${station.longitude.toFixed(4)}`,
        coordinates: `${station.latitude},${station.longitude}`,
        fuel_amount: fuelAmount || (vehicle.tank_capacity - vehicle.current_liters),
      });
      setServiceOrder(response.data);
      toast.success("Ordem gerada!");
    } catch (error) {
      console.error("Error generating service order:", error);
      toast.error("Erro ao gerar ordem");
    } finally {
      setIsLoading(false);
    }
  };

  const createStation = async (stationData) => {
    try {
      const response = await axios.post(`${API}/stations`, stationData);
      setStations([...stations, response.data]);
      toast.success("Posto criado!");
      return response.data;
    } catch (error) {
      console.error("Error creating station:", error);
      toast.error("Erro ao criar posto");
      throw error;
    }
  };

  const updateStation = async (stationId, updateData) => {
    try {
      const response = await axios.put(`${API}/stations/${stationId}`, updateData);
      setStations(stations.map((s) => (s.id === stationId ? response.data : s)));
      toast.success("Posto atualizado!");
      return response.data;
    } catch (error) {
      console.error("Error updating station:", error);
      toast.error("Erro ao atualizar posto");
      throw error;
    }
  };

  const deleteStation = async (stationId) => {
    try {
      await axios.delete(`${API}/stations/${stationId}`);
      setStations(stations.filter((s) => s.id !== stationId));
      setSelectedStation(null);
      toast.success("Posto removido!");
    } catch (error) {
      console.error("Error deleting station:", error);
      toast.error("Erro ao remover posto");
    }
  };

  const handleCreateStation = (coords) => {
    setSelectedStation({
      isNew: true,
      latitude: coords.lat,
      longitude: coords.lng,
      name: coords.suggestedName || "",
      city: coords.suggestedCity || "",
      diesel_price: 5.50,
      is_active: true,
      ratings: { price_rating: 0, service_rating: 0, parking_rating: 0, security_rating: 0 },
      parking: { has_parking: true, parking_type: "free", min_fuel_liters: null },
    });
    setActiveTab("stations"); // Switch to stations tab
    setIsPanelOpen(true);
  };

  const handleAskAI = async (currentFuelPlan) => {
    if (!routeData) {
      toast.error("Calcule uma rota primeiro!");
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/ai-advisor`, {
        route_distance: routeData.total_distance,
        origin: originCity,
        destination: destinationCity,
        vehicle: vehicle,
        fuel_plan: currentFuelPlan,
      });
      
      setAiResponse(response.data.advice);
      toast.success("Consulta concluída!");
    } catch (error) {
      console.error("Error asking AI:", error);
      toast.error("Erro ao consultar IA");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateFuelPlan = (updatedPlan) => {
    setFuelPlan(updatedPlan);
    toast.success("Plano atualizado!");
    setPlanModified(true);
  };

  const handleGenerateFullOrder = async (currentFuelPlan) => {
    if (!currentFuelPlan?.stops?.length) {
      toast.error("Nenhuma parada no plano!");
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/generate-full-order`, {
        origin: originCity,
        destination: destinationCity,
        route_distance: routeData?.total_distance || 0,
        stops: currentFuelPlan.stops,
        total_fuel: currentFuelPlan.total_fuel_liters,
        total_cost: currentFuelPlan.total_cost,
      });
      
      setServiceOrder(response.data);
      toast.success("Ordem de abastecimento gerada!");
    } catch (error) {
      console.error("Error generating full order:", error);
      toast.error("Erro ao gerar ordem");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleComplete = (stopIndex, isComplete) => {
    if (!fuelPlan?.stops) return;
    
    const newStops = [...fuelPlan.stops];
    newStops[stopIndex] = {
      ...newStops[stopIndex],
      isComplete: isComplete,
    };
    
    setFuelPlan({
      ...fuelPlan,
      stops: newStops,
    });
    setPlanModified(true);
  };

  const handleReanalyze = async (currentFuelPlan) => {
    if (!routeData) {
      toast.error("Calcule uma rota primeiro!");
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/ai-advisor`, {
        route_distance: routeData.total_distance,
        origin: originCity,
        destination: destinationCity,
        vehicle: vehicle,
        fuel_plan: currentFuelPlan,
        question: "O plano foi modificado manualmente. Analise se as alterações são viáveis e se o veículo conseguirá completar a rota com segurança. Verifique se há risco de ficar sem combustível."
      });
      
      setAiResponse(response.data.advice);
      setPlanModified(false);
      toast.success("Reanálise concluída!");
    } catch (error) {
      console.error("Error reanalyzing:", error);
      toast.error("Erro ao reanalisar");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddStationToPlan = async (stationId, fuelToAdd) => {
    if (!fuelPlan || !routeData) {
      toast.error("Calcule uma rota primeiro!");
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/add-station-to-plan`, {
        station_id: stationId,
        fuel_to_add: fuelToAdd,
        current_plan: fuelPlan,
        route_distance: routeData.total_distance,
        route_geometry: routeData.route_geometry,
        tank_capacity: vehicle.tank_capacity
      });
      
      setFuelPlan(response.data);
      setPlanModified(true);
      toast.success("Posto adicionado ao plano!");
    } catch (error) {
      console.error("Error adding station to plan:", error);
      toast.error("Erro ao adicionar posto");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearPlan = () => {
    setRouteData(null);
    setDirectionsResponse(null);
    setFuelPlan(null);
    setOriginCity("");
    setDestinationCity("");
    setWaypointCities([]);
    setAiResponse(null);
    setServiceOrder(null);
    setPlanModified(false);
    setActiveTab("route");
    toast.success("Plano limpo! Pronto para novo cálculo.");
  };

  const handleRouteChanged = useCallback(async (newDirections) => {
    if (!newDirections || !newDirections.routes || !newDirections.routes[0]) return;
    
    const route = newDirections.routes[0];
    const leg = route.legs[0];
    
    // Extract new waypoints from the dragged route
    const newWaypoints = [];
    if (route.legs.length > 1) {
      for (let i = 0; i < route.legs.length - 1; i++) {
        newWaypoints.push(route.legs[i].end_address);
      }
    }
    
    // Get via_waypoints (intermediate points added by dragging)
    route.legs.forEach(leg => {
      if (leg.via_waypoints && leg.via_waypoints.length > 0) {
        leg.via_waypoints.forEach(wp => {
          newWaypoints.push(`${wp.lat()},${wp.lng()}`);
        });
      }
    });
    
    // Calculate total distance
    let totalDistance = 0;
    route.legs.forEach(leg => {
      totalDistance += leg.distance.value;
    });
    totalDistance = totalDistance / 1000; // Convert to km
    
    // Update the directions response
    setDirectionsResponse(newDirections);
    
    // Update route data with new distance
    if (routeData) {
      const newRouteData = {
        ...routeData,
        id: Date.now(),
        total_distance: totalDistance,
      };
      setRouteData(newRouteData);
      
      // Recalculate fuel plan
      setPlanModified(true);
      toast.info(`Rota ajustada: ${totalDistance.toFixed(0)} km. Clique em "Reanalisar" para atualizar o plano.`);
    }
  }, [routeData]);

  const addWaypoint = () => setWaypointCities([...waypointCities, ""]);
  const removeWaypoint = (index) => setWaypointCities(waypointCities.filter((_, i) => i !== index));
  const updateWaypoint = (index, value) => setWaypointCities(waypointCities.map((wp, i) => (i === index ? value : wp)));

  const toggleMapStyle = () => {
    const styles = ["dark", "satellite", "streets"];
    const currentIndex = styles.indexOf(mapStyle);
    setMapStyle(styles[(currentIndex + 1) % styles.length]);
  };

  const currentTheme = THEMES[theme] || THEMES.dark;

  return (
    <div 
      data-testid="fleet-dashboard" 
      className={`relative h-screen w-screen overflow-hidden transition-colors duration-300 ${currentTheme.bg}`}
    >
      {/* Header */}
      <header className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3 ${currentTheme.bg}/95 backdrop-blur-md border-b border-white/10`}>
        <div className="flex items-center gap-2">
          <h1 className={`font-heading text-xl font-bold tracking-tight ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
            BARTZ
          </h1>
          <span className={`text-sm ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
            - Gestão inteligente de abastecimento
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Theme Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                data-testid="theme-selector-btn"
                variant="ghost"
                size="icon"
                className={`${theme === 'light' ? 'text-gray-700' : 'text-muted-foreground'} hover:text-foreground`}
              >
                <Palette className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-white/10">
              {Object.entries(THEMES).map(([key, t]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => {
                    setTheme(key);
                    setMapStyle(t.map);
                  }}
                  className={`cursor-pointer ${theme === key ? 'bg-accent' : ''}`}
                >
                  <div className={`w-3 h-3 rounded-full mr-2 ${t.bg}`} />
                  {t.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            data-testid="toggle-panel-btn"
            variant="ghost"
            size="icon"
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className={`${theme === 'light' ? 'text-gray-700' : 'text-muted-foreground'} hover:text-foreground`}
          >
            {isPanelOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {/* Map */}
      <div className="absolute inset-0 pt-14">
        <MapView
          stations={stations}
          selectedStation={selectedStation}
          setSelectedStation={setSelectedStation}
          routeData={routeData}
          fuelPlan={fuelPlan}
          onCreateStation={handleCreateStation}
          mapStyle={mapStyle}
          theme={theme}
        />
      </div>

      {/* Control Panel */}
      <ControlPanel
        isOpen={isPanelOpen}
        stations={stations}
        selectedStation={selectedStation}
        setSelectedStation={setSelectedStation}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        vehicle={vehicle}
        setVehicle={setVehicle}
        fuelInputMode={fuelInputMode}
        setFuelInputMode={setFuelInputMode}
        originCity={originCity}
        setOriginCity={setOriginCity}
        destinationCity={destinationCity}
        setDestinationCity={setDestinationCity}
        waypointCities={waypointCities}
        addWaypoint={addWaypoint}
        removeWaypoint={removeWaypoint}
        updateWaypoint={updateWaypoint}
        routeData={routeData}
        calculateRoute={calculateRoute}
        fuelPlan={fuelPlan}
        serviceOrder={serviceOrder}
        generateServiceOrder={generateServiceOrder}
        createStation={createStation}
        updateStation={updateStation}
        deleteStation={deleteStation}
        searchCities={searchCities}
        isLoading={isLoading}
        theme={theme}
        onAskAI={handleAskAI}
        aiResponse={aiResponse}
        onUpdateFuelPlan={handleUpdateFuelPlan}
        onGenerateFullOrder={handleGenerateFullOrder}
        onToggleComplete={handleToggleComplete}
        onReanalyze={handleReanalyze}
        planModified={planModified}
        onAddStationToPlan={handleAddStationToPlan}
        onClearPlan={handleClearPlan}
      />
    </div>
  );
}
