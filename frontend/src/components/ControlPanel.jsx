import { useState, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Fuel,
  Truck,
  Navigation,
  MapPin,
  Plus,
  Trash2,
  Sparkles,
  Send,
  Copy,
  Check,
  Calculator,
  AlertTriangle,
  X,
  Search,
  Clock,
  Loader2,
} from "lucide-react";
import debounce from "@/utils/debounce";

export default function ControlPanel({
  isOpen,
  stations,
  selectedStation,
  setSelectedStation,
  vehicle,
  setVehicle,
  originCity,
  setOriginCity,
  destinationCity,
  setDestinationCity,
  waypointCities,
  addWaypoint,
  removeWaypoint,
  updateWaypoint,
  routeData,
  calculateRoute,
  recommendation,
  getRecommendation,
  serviceOrder,
  generateServiceOrder,
  createStation,
  updateStation,
  deleteStation,
  searchStation,
  isLoading,
  stationsAlongRoute,
}) {
  const [copied, setCopied] = useState(false);
  const [stationForm, setStationForm] = useState({
    name: "",
    diesel_price: 5.5,
    is_active: true,
    city: "",
    address: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const autonomy = vehicle.current_liters * vehicle.consumption_rate;
  const autonomyPercent = Math.min((autonomy / (routeData?.total_distance || 1000)) * 100, 100);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (query.length < 3) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const results = await searchStation(query);
        setSearchResults(results);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearching(false);
      }
    }, 500),
    [searchStation]
  );

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
  };

  const selectSearchResult = (result) => {
    setSelectedStation({
      isNew: true,
      latitude: result.latitude,
      longitude: result.longitude,
      name: result.name || "",
      diesel_price: 5.50,
      is_active: true,
    });
    setStationForm({
      name: result.name || "",
      diesel_price: 5.50,
      is_active: true,
      city: result.city || "",
      address: result.address || "",
    });
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleSaveStation = async () => {
    if (selectedStation?.isNew) {
      await createStation({
        name: stationForm.name,
        latitude: selectedStation.latitude,
        longitude: selectedStation.longitude,
        diesel_price: stationForm.diesel_price,
        is_active: stationForm.is_active,
        city: stationForm.city,
        address: stationForm.address,
      });
      setSelectedStation(null);
      setStationForm({ name: "", diesel_price: 5.5, is_active: true, city: "", address: "" });
    } else if (selectedStation) {
      await updateStation(selectedStation.id, {
        name: stationForm.name || selectedStation.name,
        diesel_price: stationForm.diesel_price,
        is_active: stationForm.is_active,
      });
      setSelectedStation(null);
    }
  };

  const handleCopyMessage = () => {
    if (serviceOrder?.message) {
      navigator.clipboard.writeText(serviceOrder.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsAppShare = () => {
    if (serviceOrder?.message) {
      const encodedMessage = encodeURIComponent(serviceOrder.message);
      window.open(`https://wa.me/?text=${encodedMessage}`, "_blank");
    }
  };

  // Update form when station is selected
  const handleStationSelect = (station) => {
    setSelectedStation(station);
    setStationForm({
      name: station.name,
      diesel_price: station.diesel_price,
      is_active: station.is_active,
      city: station.city || "",
      address: station.address || "",
    });
  };

  return (
    <div
      data-testid="control-panel"
      className={`fixed top-14 right-0 h-[calc(100vh-56px)] w-full md:w-[400px] glass-panel z-10 transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          <Tabs defaultValue="route" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-secondary">
              <TabsTrigger data-testid="tab-route" value="route" className="text-xs">
                <Navigation className="w-4 h-4 mr-1" />
                Rota
              </TabsTrigger>
              <TabsTrigger data-testid="tab-vehicle" value="vehicle" className="text-xs">
                <Truck className="w-4 h-4 mr-1" />
                Veículo
              </TabsTrigger>
              <TabsTrigger data-testid="tab-stations" value="stations" className="text-xs">
                <Fuel className="w-4 h-4 mr-1" />
                Postos
              </TabsTrigger>
            </TabsList>

            {/* ROUTE TAB */}
            <TabsContent value="route" className="space-y-4">
              <Card className="bg-card border-white/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-heading uppercase tracking-wide flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-primary" />
                    Calculadora de Rota
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Cidade de Origem</Label>
                    <Input
                      data-testid="input-origin-city"
                      value={originCity}
                      onChange={(e) => setOriginCity(e.target.value)}
                      placeholder="Ex: Porto Alegre, RS"
                      className="bg-secondary border-white/10"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Cidade de Destino</Label>
                    <Input
                      data-testid="input-destination-city"
                      value={destinationCity}
                      onChange={(e) => setDestinationCity(e.target.value)}
                      placeholder="Ex: São Paulo, SP"
                      className="bg-secondary border-white/10"
                    />
                  </div>

                  {/* Waypoints */}
                  {waypointCities.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Paradas Intermediárias</Label>
                      {waypointCities.map((city, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            value={city}
                            onChange={(e) => updateWaypoint(index, e.target.value)}
                            placeholder={`Ex: Curitiba, PR`}
                            className="bg-secondary border-white/10 text-sm flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeWaypoint(index)}
                            className="h-8 w-8 text-destructive"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    data-testid="btn-add-waypoint"
                    variant="outline"
                    size="sm"
                    onClick={addWaypoint}
                    className="w-full border-dashed border-white/20"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Parada
                  </Button>

                  <Button
                    data-testid="btn-calculate-route"
                    onClick={calculateRoute}
                    disabled={isLoading}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-heading uppercase"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Calculando...
                      </>
                    ) : (
                      "Calcular Rota"
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Route Results */}
              {routeData && (
                <Card className="bg-card border-white/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-heading uppercase tracking-wide">
                      Resultado da Rota
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-secondary rounded-lg p-3">
                        <div className="text-xs text-muted-foreground">Distância Total</div>
                        <div className="text-xl font-mono font-bold text-primary">
                          {routeData.total_distance.toFixed(0)} km
                        </div>
                      </div>
                      <div className="bg-secondary rounded-lg p-3">
                        <div className="text-xs text-muted-foreground">Autonomia</div>
                        <div className={`text-xl font-mono font-bold ${routeData.can_complete_route ? "text-green-500" : "text-red-500"}`}>
                          {routeData.autonomy.toFixed(0)} km
                        </div>
                      </div>
                    </div>

                    {routeData.duration_minutes && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 rounded-lg p-2">
                        <Clock className="w-4 h-4" />
                        <span>Tempo estimado: {Math.floor(routeData.duration_minutes / 60)}h {Math.round(routeData.duration_minutes % 60)}min</span>
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Progresso da Autonomia</span>
                        <span className={routeData.can_complete_route ? "text-green-500" : "text-red-500"}>
                          {autonomyPercent.toFixed(0)}%
                        </span>
                      </div>
                      <Progress value={autonomyPercent} className="h-2" />
                    </div>

                    {!routeData.can_complete_route && (
                      <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <div className="text-xs">
                          <div className="font-medium text-red-400">Combustível Insuficiente</div>
                          <div className="text-red-400/70">
                            Limite em {routeData.fuel_limit_point?.distance_from_origin?.toFixed(0)} km
                          </div>
                        </div>
                      </div>
                    )}

                    {stationsAlongRoute.length > 0 && (
                      <div className="text-xs text-muted-foreground bg-blue-500/10 rounded-lg p-2">
                        <span className="text-blue-400 font-medium">{stationsAlongRoute.length} postos</span> encontrados ao longo da rota
                      </div>
                    )}

                    <Separator className="bg-white/5" />

                    <Button
                      data-testid="btn-get-recommendation"
                      onClick={getRecommendation}
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      {isLoading ? "Analisando..." : "Recomendação IA"}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* AI Recommendation */}
              {recommendation?.recommendation && (
                <Card className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-green-500/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-heading uppercase tracking-wide flex items-center gap-2 text-green-400">
                      <Sparkles className="w-4 h-4" />
                      Recomendação IA
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/20 rounded-lg">
                        <Fuel className="w-6 h-6 text-green-400" />
                      </div>
                      <div>
                        <div className="font-medium">{recommendation.recommendation.station.name}</div>
                        {recommendation.recommendation.station.city && (
                          <div className="text-xs text-muted-foreground">{recommendation.recommendation.station.city}</div>
                        )}
                        <div className="text-2xl font-mono font-bold text-green-400">
                          R$ {recommendation.recommendation.station.diesel_price.toFixed(2)}/L
                        </div>
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground bg-secondary/50 rounded-lg p-3">
                      {recommendation.recommendation.ai_analysis}
                    </div>

                    <Button
                      data-testid="btn-generate-order"
                      onClick={() => generateServiceOrder(recommendation.recommendation.station)}
                      disabled={isLoading}
                      className="w-full whatsapp-btn text-white"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Gerar Ordem para Motorista
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Service Order */}
              {serviceOrder && (
                <Card className="bg-card border-white/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-heading uppercase tracking-wide">
                      Ordem de Serviço
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="bg-secondary rounded-lg p-3 text-sm whitespace-pre-wrap font-mono">
                      {serviceOrder.message}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        data-testid="btn-copy-order"
                        variant="outline"
                        size="sm"
                        onClick={handleCopyMessage}
                        className="flex-1"
                      >
                        {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                        {copied ? "Copiado!" : "Copiar"}
                      </Button>
                      <Button
                        data-testid="btn-whatsapp-share"
                        size="sm"
                        onClick={handleWhatsAppShare}
                        className="flex-1 whatsapp-btn text-white"
                      >
                        <Send className="w-4 h-4 mr-1" />
                        WhatsApp
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* VEHICLE TAB */}
            <TabsContent value="vehicle" className="space-y-4">
              <Card className="bg-card border-white/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-heading uppercase tracking-wide flex items-center gap-2">
                    <Truck className="w-4 h-4 text-primary" />
                    Dados do Caminhão
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Litros Atuais no Tanque</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        data-testid="input-current-liters"
                        type="number"
                        value={vehicle.current_liters}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setVehicle({ ...vehicle, current_liters: isNaN(val) ? 0 : val });
                        }}
                        className="bg-secondary border-white/10 font-mono"
                      />
                      <span className="text-muted-foreground text-sm">L</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Média de Consumo</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        data-testid="input-consumption-rate"
                        type="number"
                        step="0.1"
                        value={vehicle.consumption_rate}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setVehicle({ ...vehicle, consumption_rate: isNaN(val) ? 0 : val });
                        }}
                        className="bg-secondary border-white/10 font-mono"
                      />
                      <span className="text-muted-foreground text-sm">km/L</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Capacidade Total do Tanque</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        data-testid="input-tank-capacity"
                        type="number"
                        value={vehicle.tank_capacity}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setVehicle({ ...vehicle, tank_capacity: isNaN(val) ? 0 : val });
                        }}
                        className="bg-secondary border-white/10 font-mono"
                      />
                      <span className="text-muted-foreground text-sm">L</span>
                    </div>
                  </div>

                  <Separator className="bg-white/5" />

                  <div className="bg-secondary rounded-lg p-4">
                    <div className="text-xs text-muted-foreground mb-2">Autonomia Calculada</div>
                    <div className="text-3xl font-mono font-bold text-primary">
                      {autonomy.toFixed(0)} km
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {vehicle.current_liters}L × {vehicle.consumption_rate} km/L
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Nível do Tanque</span>
                      <span className="font-mono">{((vehicle.current_liters / vehicle.tank_capacity) * 100).toFixed(0)}%</span>
                    </div>
                    <Progress value={(vehicle.current_liters / vehicle.tank_capacity) * 100} className="h-3" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* STATIONS TAB */}
            <TabsContent value="stations" className="space-y-4">
              {/* Search Bar */}
              <Card className="bg-card border-white/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-heading uppercase tracking-wide flex items-center gap-2">
                    <Search className="w-4 h-4 text-primary" />
                    Buscar Posto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="relative">
                    <Input
                      data-testid="input-search-station"
                      value={searchQuery}
                      onChange={handleSearchChange}
                      placeholder="Digite cidade e nome do posto..."
                      className="bg-secondary border-white/10 pr-10"
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  
                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="bg-secondary/80 rounded-lg border border-white/5 max-h-48 overflow-y-auto">
                      {searchResults.map((result, index) => (
                        <div
                          key={index}
                          onClick={() => selectSearchResult(result)}
                          className="p-2 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0"
                        >
                          <div className="font-medium text-sm">{result.name || "Posto"}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {result.city && `${result.city} • `}{result.display_name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    Busque por cidade ou nome do posto para adicionar
                  </p>
                </CardContent>
              </Card>

              {/* Station Editor */}
              {selectedStation && (
                <Card className="bg-card border-primary/30">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-heading uppercase tracking-wide">
                        {selectedStation.isNew ? "Novo Posto" : "Editar Posto"}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedStation(null)}
                        className="h-6 w-6"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Nome do Posto</Label>
                      <Input
                        data-testid="input-station-name"
                        value={stationForm.name || selectedStation.name || ""}
                        onChange={(e) => setStationForm({ ...stationForm, name: e.target.value })}
                        placeholder="Ex: Posto BR"
                        className="bg-secondary border-white/10"
                      />
                    </div>

                    {stationForm.city && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Cidade</Label>
                        <Input
                          value={stationForm.city}
                          onChange={(e) => setStationForm({ ...stationForm, city: e.target.value })}
                          className="bg-secondary border-white/10"
                          readOnly
                        />
                      </div>
                    )}

                    <div>
                      <Label className="text-xs text-muted-foreground">Preço do Diesel (R$/L)</Label>
                      <Input
                        data-testid="input-diesel-price"
                        type="number"
                        step="0.01"
                        value={stationForm.diesel_price}
                        onChange={(e) => setStationForm({ ...stationForm, diesel_price: parseFloat(e.target.value) })}
                        className="bg-secondary border-white/10 font-mono"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Posto Ativo na Rota</Label>
                      <Switch
                        data-testid="switch-station-active"
                        checked={stationForm.is_active}
                        onCheckedChange={(checked) => setStationForm({ ...stationForm, is_active: checked })}
                      />
                    </div>

                    <div className="text-xs text-muted-foreground bg-secondary rounded p-2 font-mono">
                      Coordenadas: {selectedStation.latitude?.toFixed(4)}, {selectedStation.longitude?.toFixed(4)}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        data-testid="btn-save-station"
                        onClick={handleSaveStation}
                        disabled={!stationForm.name && selectedStation.isNew}
                        className="flex-1 bg-primary hover:bg-primary/90"
                      >
                        Salvar
                      </Button>
                      {!selectedStation.isNew && (
                        <Button
                          data-testid="btn-delete-station"
                          variant="destructive"
                          size="icon"
                          onClick={() => deleteStation(selectedStation.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Instructions */}
              {!selectedStation && (
                <div className="text-center text-muted-foreground text-sm p-4 bg-secondary/50 rounded-lg border border-dashed border-white/10">
                  <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Use a busca acima para encontrar postos</p>
                  <p className="text-xs mt-1">ou clique no mapa para adicionar manualmente</p>
                </div>
              )}

              {/* Station List */}
              <Card className="bg-card border-white/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-heading uppercase tracking-wide flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Fuel className="w-4 h-4 text-primary" />
                      Postos Cadastrados
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {stations.length} postos
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {stations.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-4">
                      Nenhum posto cadastrado
                    </div>
                  ) : (
                    stations.map((station) => (
                      <div
                        key={station.id}
                        data-testid={`station-card-${station.id}`}
                        onClick={() => handleStationSelect(station)}
                        className={`station-card p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedStation?.id === station.id
                            ? "border-primary bg-primary/10"
                            : "border-white/5 bg-secondary/50 hover:bg-secondary"
                        } ${!station.is_active ? "opacity-50" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded ${station.is_active ? "bg-primary/20" : "bg-gray-500/20"}`}>
                              <Fuel className={`w-4 h-4 ${station.is_active ? "text-primary" : "text-gray-500"}`} />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{station.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {station.city || `${station.latitude.toFixed(2)}, ${station.longitude.toFixed(2)}`}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-bold text-primary">
                              R$ {station.diesel_price.toFixed(2)}
                            </div>
                            <div className={`text-xs ${station.is_active ? "text-green-500" : "text-gray-500"}`}>
                              {station.is_active ? "Ativo" : "Inativo"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
