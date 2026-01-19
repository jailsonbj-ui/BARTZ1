import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import MapView from "@/components/MapView";
import ControlPanel from "@/components/ControlPanel";
import { Fuel, PanelRightClose, PanelRightOpen, Map, Satellite } from "lucide-react";
import { Button } from "@/components/ui/button";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function FleetDashboard() {
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [routeData, setRouteData] = useState(null);
  const [mapStyle, setMapStyle] = useState("dark"); // dark, satellite, streets
  const [vehicle, setVehicle] = useState({
    current_liters: 200,
    consumption_rate: 2.5,
    tank_capacity: 400,
  });
  const [originCity, setOriginCity] = useState("Porto Alegre, RS");
  const [destinationCity, setDestinationCity] = useState("São Paulo, SP");
  const [waypointCities, setWaypointCities] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [serviceOrder, setServiceOrder] = useState(null);
  const [stationsAlongRoute, setStationsAlongRoute] = useState([]);

  // Fetch stations on mount
  useEffect(() => {
    fetchStations();
  }, []);

  const fetchStations = async () => {
    try {
      const response = await axios.get(`${API}/stations`);
      setStations(response.data);
      if (response.data.length === 0) {
        // Seed sample data if empty
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

  const calculateRoute = useCallback(async () => {
    if (!originCity.trim() || !destinationCity.trim()) {
      toast.error("Informe origem e destino!");
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/calculate-route`, {
        origin_city: originCity,
        destination_city: destinationCity,
        waypoint_cities: waypointCities.filter(c => c.trim()),
        vehicle,
      });
      setRouteData(response.data);
      
      // Get stations along the route
      if (response.data.route_geometry) {
        try {
          const stationsResponse = await axios.post(`${API}/stations-along-route`, response.data.route_geometry, {
            params: { max_distance_km: 50 }
          });
          setStationsAlongRoute(stationsResponse.data);
        } catch (e) {
          console.error("Error getting stations along route:", e);
        }
      }
      
      if (!response.data.can_complete_route) {
        toast.warning("Autonomia insuficiente para completar a rota!");
      } else {
        toast.success(`Rota calculada: ${response.data.total_distance.toFixed(0)} km via rodovias`);
      }
    } catch (error) {
      console.error("Error calculating route:", error);
      toast.error(error.response?.data?.detail || "Erro ao calcular rota");
    } finally {
      setIsLoading(false);
    }
  }, [originCity, destinationCity, waypointCities, vehicle]);

  const getRecommendation = async () => {
    if (!routeData) {
      toast.error("Calcule a rota primeiro!");
      return;
    }
    
    setIsLoading(true);
    try {
      const stationsToAnalyze = stationsAlongRoute.length > 0 ? stationsAlongRoute : stations;
      const response = await axios.post(`${API}/recommend-station`, {
        route_distance: routeData.total_distance,
        vehicle,
        stations: stationsToAnalyze,
        route_geometry: routeData.route_geometry,
      });
      setRecommendation(response.data);
      toast.success("Recomendação gerada com IA!");
    } catch (error) {
      console.error("Error getting recommendation:", error);
      toast.error("Erro ao obter recomendação");
    } finally {
      setIsLoading(false);
    }
  };

  const generateServiceOrder = async (station) => {
    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/generate-service-order`, {
        station_name: station.name,
        station_location: station.city || `Lat: ${station.latitude.toFixed(4)}, Lng: ${station.longitude.toFixed(4)}`,
        coordinates: `${station.latitude},${station.longitude}`,
        fuel_amount: vehicle.tank_capacity - vehicle.current_liters,
      });
      setServiceOrder(response.data);
      toast.success("Ordem de serviço gerada!");
    } catch (error) {
      console.error("Error generating service order:", error);
      toast.error("Erro ao gerar ordem de serviço");
    } finally {
      setIsLoading(false);
    }
  };

  const searchStation = async (query) => {
    try {
      const response = await axios.get(`${API}/search-stations`, {
        params: { query }
      });
      return response.data;
    } catch (error) {
      console.error("Error searching stations:", error);
      toast.error("Erro na busca de postos");
      return [];
    }
  };

  const createStation = async (stationData) => {
    try {
      const response = await axios.post(`${API}/stations`, stationData);
      setStations([...stations, response.data]);
      toast.success("Posto criado com sucesso!");
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

  const handleMapClick = (latlng) => {
    setSelectedStation({
      isNew: true,
      latitude: latlng.lat,
      longitude: latlng.lng,
      name: "",
      diesel_price: 5.50,
      is_active: true,
    });
    setIsPanelOpen(true);
  };

  const addWaypoint = () => {
    setWaypointCities([...waypointCities, ""]);
  };

  const removeWaypoint = (index) => {
    setWaypointCities(waypointCities.filter((_, i) => i !== index));
  };

  const updateWaypoint = (index, value) => {
    setWaypointCities(waypointCities.map((wp, i) => (i === index ? value : wp)));
  };

  const toggleMapStyle = () => {
    const styles = ["dark", "satellite", "streets"];
    const currentIndex = styles.indexOf(mapStyle);
    const nextIndex = (currentIndex + 1) % styles.length;
    setMapStyle(styles[nextIndex]);
  };

  return (
    <div data-testid="fleet-dashboard" className="relative h-screen w-screen overflow-hidden bg-background">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Fuel className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight uppercase text-foreground">
              SmartFuel
            </h1>
            <p className="text-xs text-muted-foreground">Sistema de Gestão de Abastecimento</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            data-testid="toggle-map-style-btn"
            variant="ghost"
            size="icon"
            onClick={toggleMapStyle}
            className="text-muted-foreground hover:text-foreground"
            title={`Mapa: ${mapStyle === 'dark' ? 'Escuro' : mapStyle === 'satellite' ? 'Satélite' : 'Ruas'}`}
          >
            {mapStyle === 'satellite' ? <Satellite className="w-5 h-5" /> : <Map className="w-5 h-5" />}
          </Button>
          <Button
            data-testid="toggle-panel-btn"
            variant="ghost"
            size="icon"
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className="text-muted-foreground hover:text-foreground"
          >
            {isPanelOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {/* Map Container */}
      <div className="absolute inset-0 pt-14">
        <MapView
          stations={stations}
          selectedStation={selectedStation}
          setSelectedStation={setSelectedStation}
          routeData={routeData}
          recommendation={recommendation}
          onMapClick={handleMapClick}
          mapStyle={mapStyle}
          stationsAlongRoute={stationsAlongRoute}
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
        recommendation={recommendation}
        getRecommendation={getRecommendation}
        serviceOrder={serviceOrder}
        generateServiceOrder={generateServiceOrder}
        createStation={createStation}
        updateStation={updateStation}
        deleteStation={deleteStation}
        searchStation={searchStation}
        isLoading={isLoading}
        stationsAlongRoute={stationsAlongRoute}
      />
    </div>
  );
}
