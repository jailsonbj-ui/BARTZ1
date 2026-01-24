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
  const [routeData, setRouteData] = useState(null);
  const [mapStyle, setMapStyle] = useState("dark");
  const [theme, setTheme] = useState("dark");
  const [vehicle, setVehicle] = useState({
    current_liters: 200,
    consumption_rate: 2.5,
    tank_capacity: 500,
  });
  const [originCity, setOriginCity] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [waypointCities, setWaypointCities] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [serviceOrder, setServiceOrder] = useState(null);
  const [fuelPlan, setFuelPlan] = useState(null);
  const [aiResponse, setAiResponse] = useState(null);

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
    try {
      const response = await axios.post(`${API}/calculate-route`, {
        origin_city: originCity,
        destination_city: destinationCity,
        waypoint_cities: waypointCities.filter(c => c.trim()),
        vehicle,
      });
      setRouteData(response.data);
      
      // Auto-plan fuel stops for long routes
      if (response.data.total_distance > response.data.autonomy) {
        await planFuelStops(response.data);
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
      name: "",
      diesel_price: 5.50,
      is_active: true,
      ratings: { price_rating: 0, service_rating: 0, parking_rating: 0, security_rating: 0 },
      parking: { has_parking: true, parking_type: "free", min_fuel_liters: null },
    });
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
  };

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
      <header className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 ${currentTheme.bg}/95 backdrop-blur-md border-b border-white/10`}>
        <div className="flex items-center">
          <img 
            src="/bartz-logo.png" 
            alt="Bartz Logo" 
            className="h-10 w-auto object-contain"
            style={{ filter: theme === 'light' ? 'none' : 'brightness(1.1)' }}
          />
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
        vehicle={vehicle}
        setVehicle={setVehicle}
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
      />
    </div>
  );
}
