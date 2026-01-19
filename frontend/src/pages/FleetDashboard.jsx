import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import MapView from "@/components/MapView";
import ControlPanel from "@/components/ControlPanel";
import { Fuel, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function FleetDashboard() {
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [routeData, setRouteData] = useState(null);
  const [vehicle, setVehicle] = useState({
    current_liters: 200,
    consumption_rate: 2.5,
    tank_capacity: 400,
  });
  const [origin, setOrigin] = useState({
    name: "Porto Alegre",
    latitude: -30.0346,
    longitude: -51.2177,
  });
  const [destination, setDestination] = useState({
    name: "São Paulo",
    latitude: -23.5505,
    longitude: -46.6333,
  });
  const [waypoints, setWaypoints] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [serviceOrder, setServiceOrder] = useState(null);

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
    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/calculate-route`, {
        origin,
        destination,
        waypoints,
        vehicle,
      });
      setRouteData(response.data);
      
      if (!response.data.can_complete_route) {
        toast.warning("Autonomia insuficiente para completar a rota!");
      } else {
        toast.success(`Rota calculada: ${response.data.total_distance.toFixed(0)} km`);
      }
    } catch (error) {
      console.error("Error calculating route:", error);
      toast.error("Erro ao calcular rota");
    } finally {
      setIsLoading(false);
    }
  }, [origin, destination, waypoints, vehicle]);

  const getRecommendation = async () => {
    if (!routeData) {
      toast.error("Calcule a rota primeiro!");
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/recommend-station`, {
        route_distance: routeData.total_distance,
        vehicle,
        stations,
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
        station_location: `Lat: ${station.latitude.toFixed(4)}, Lng: ${station.longitude.toFixed(4)}`,
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
    setWaypoints([
      ...waypoints,
      { name: `Parada ${waypoints.length + 1}`, latitude: -26.5, longitude: -49.0 },
    ]);
  };

  const removeWaypoint = (index) => {
    setWaypoints(waypoints.filter((_, i) => i !== index));
  };

  const updateWaypoint = (index, data) => {
    setWaypoints(waypoints.map((wp, i) => (i === index ? { ...wp, ...data } : wp)));
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
        <Button
          data-testid="toggle-panel-btn"
          variant="ghost"
          size="icon"
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          className="text-muted-foreground hover:text-foreground"
        >
          {isPanelOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
        </Button>
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
          origin={origin}
          destination={destination}
          waypoints={waypoints}
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
        origin={origin}
        setOrigin={setOrigin}
        destination={destination}
        setDestination={setDestination}
        waypoints={waypoints}
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
        isLoading={isLoading}
      />
    </div>
  );
}
