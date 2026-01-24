import { useState, useCallback, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Fuel, Truck, Navigation, MapPin, Plus, Trash2, Send, Copy, Check,
  Calculator, AlertTriangle, X, Search, Clock, Loader2, Star, Car, Shield,
} from "lucide-react";
import debounce from "@/utils/debounce";

// Star Rating Component
function StarRating({ value, onChange, label }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star === value ? 0 : star)}
            className="focus:outline-none"
          >
            <Star
              size={16}
              className={`transition-colors ${
                star <= value ? "text-yellow-400 fill-yellow-400" : "text-gray-600"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

// City Autocomplete Component
function CityAutocomplete({ value, onChange, onSelect, searchCities, placeholder, testId }) {
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }
      setIsSearching(true);
      const results = await searchCities(query);
      setSuggestions(results);
      setIsSearching(false);
    }, 300),
    [searchCities]
  );

  useEffect(() => {
    debouncedSearch(value);
  }, [value, debouncedSearch]);

  const handleSelect = (city) => {
    onSelect(city.display_name);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  return (
    <div className="relative">
      <Input
        data-testid={testId}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        placeholder={placeholder}
        className="bg-secondary border-white/10"
      />
      {isSearching && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
      )}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-white/10 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((city, index) => (
            <div
              key={index}
              onClick={() => handleSelect(city)}
              className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
            >
              <div className="font-medium">{city.name}</div>
              <div className="text-xs text-muted-foreground">{city.state}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
  fuelPlan,
  serviceOrder,
  generateServiceOrder,
  createStation,
  updateStation,
  deleteStation,
  searchCities,
  isLoading,
  theme,
}) {
  const [copied, setCopied] = useState(false);
  const [stationForm, setStationForm] = useState({
    name: "",
    diesel_price: 5.5,
    is_active: true,
    city: "",
    ratings: { price_rating: 0, service_rating: 0, parking_rating: 0, security_rating: 0 },
    parking: { has_parking: true, parking_type: "free", min_fuel_liters: null },
  });

  const autonomy = vehicle.current_liters * vehicle.consumption_rate;
  const autonomyPercent = Math.min((autonomy / (routeData?.total_distance || 1000)) * 100, 100);

  useEffect(() => {
    if (selectedStation && !selectedStation.isNew) {
      setStationForm({
        name: selectedStation.name || "",
        diesel_price: selectedStation.diesel_price || 5.5,
        is_active: selectedStation.is_active ?? true,
        city: selectedStation.city || "",
        ratings: selectedStation.ratings || { price_rating: 0, service_rating: 0, parking_rating: 0, security_rating: 0 },
        parking: selectedStation.parking || { has_parking: true, parking_type: "free", min_fuel_liters: null },
      });
    }
  }, [selectedStation]);

  const handleSaveStation = async () => {
    if (selectedStation?.isNew) {
      await createStation({
        name: stationForm.name,
        latitude: selectedStation.latitude,
        longitude: selectedStation.longitude,
        diesel_price: stationForm.diesel_price,
        is_active: stationForm.is_active,
        city: stationForm.city,
        ratings: stationForm.ratings,
        parking: stationForm.parking,
      });
    } else if (selectedStation) {
      await updateStation(selectedStation.id, {
        name: stationForm.name,
        diesel_price: stationForm.diesel_price,
        is_active: stationForm.is_active,
        ratings: stationForm.ratings,
        parking: stationForm.parking,
      });
    }
    setSelectedStation(null);
    setStationForm({
      name: "", diesel_price: 5.5, is_active: true, city: "",
      ratings: { price_rating: 0, service_rating: 0, parking_rating: 0, security_rating: 0 },
      parking: { has_parking: true, parking_type: "free", min_fuel_liters: null },
    });
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
      window.open(`https://wa.me/?text=${encodeURIComponent(serviceOrder.message)}`, "_blank");
    }
  };

  const panelBg = theme === 'light' ? 'bg-white/90' : 'bg-slate-950/90';

  return (
    <div
      data-testid="control-panel"
      className={`fixed top-14 right-0 h-[calc(100vh-56px)] w-full md:w-[420px] ${panelBg} backdrop-blur-xl border-l border-white/5 z-10 transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          <Tabs defaultValue="route" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-secondary">
              <TabsTrigger data-testid="tab-route" value="route" className="text-xs">
                <Navigation className="w-4 h-4 mr-1" /> Rota
              </TabsTrigger>
              <TabsTrigger data-testid="tab-vehicle" value="vehicle" className="text-xs">
                <Truck className="w-4 h-4 mr-1" /> Veículo
              </TabsTrigger>
              <TabsTrigger data-testid="tab-stations" value="stations" className="text-xs">
                <Fuel className="w-4 h-4 mr-1" /> Postos
              </TabsTrigger>
            </TabsList>

            {/* ROUTE TAB */}
            <TabsContent value="route" className="space-y-4">
              <Card className="bg-card border-white/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-heading uppercase tracking-wide flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-primary" /> Calculadora de Rota
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Origem</Label>
                    <CityAutocomplete
                      value={originCity}
                      onChange={setOriginCity}
                      onSelect={setOriginCity}
                      searchCities={searchCities}
                      placeholder="Digite a cidade de origem..."
                      testId="input-origin-city"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Destino</Label>
                    <CityAutocomplete
                      value={destinationCity}
                      onChange={setDestinationCity}
                      onSelect={setDestinationCity}
                      searchCities={searchCities}
                      placeholder="Digite a cidade de destino..."
                      testId="input-destination-city"
                    />
                  </div>

                  {waypointCities.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Paradas</Label>
                      {waypointCities.map((city, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <CityAutocomplete
                            value={city}
                            onChange={(v) => updateWaypoint(index, v)}
                            onSelect={(v) => updateWaypoint(index, v)}
                            searchCities={searchCities}
                            placeholder="Cidade..."
                            testId={`input-waypoint-${index}`}
                          />
                          <Button variant="ghost" size="icon" onClick={() => removeWaypoint(index)} className="h-8 w-8 text-destructive">
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button data-testid="btn-add-waypoint" variant="outline" size="sm" onClick={addWaypoint} className="w-full border-dashed">
                    <Plus className="w-4 h-4 mr-2" /> Adicionar Parada
                  </Button>

                  <Button data-testid="btn-calculate-route" onClick={calculateRoute} disabled={isLoading} className="w-full bg-primary">
                    {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Calculando...</> : "Calcular Rota"}
                  </Button>
                </CardContent>
              </Card>

              {/* Route Results */}
              {routeData && (
                <Card className="bg-card border-white/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-heading uppercase">Resultado da Rota</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-secondary rounded-lg p-3">
                        <div className="text-xs text-muted-foreground">Distância</div>
                        <div className="text-xl font-mono font-bold text-primary">{routeData.total_distance.toFixed(0)} km</div>
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
                        <span>{Math.floor(routeData.duration_minutes / 60)}h {Math.round(routeData.duration_minutes % 60)}min</span>
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Autonomia</span>
                        <span className={routeData.can_complete_route ? "text-green-500" : "text-red-500"}>{autonomyPercent.toFixed(0)}%</span>
                      </div>
                      <Progress value={autonomyPercent} className="h-2" />
                    </div>

                    {!routeData.can_complete_route && !fuelPlan && (
                      <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <div className="text-xs text-red-400">Autonomia insuficiente</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Fuel Plan */}
              {fuelPlan && (
                <Card className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-green-500/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-heading uppercase flex items-center gap-2 text-green-400">
                      <Fuel className="w-4 h-4" /> Plano de Abastecimento
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-secondary/50 rounded p-2">
                        <div className="text-lg font-bold text-green-400">{fuelPlan.total_stops}</div>
                        <div className="text-xs text-muted-foreground">Paradas</div>
                      </div>
                      <div className="bg-secondary/50 rounded p-2">
                        <div className="text-lg font-bold text-blue-400">{fuelPlan.total_fuel_liters.toFixed(0)}L</div>
                        <div className="text-xs text-muted-foreground">Total</div>
                      </div>
                      <div className="bg-secondary/50 rounded p-2">
                        <div className="text-lg font-bold text-yellow-400">R${fuelPlan.total_cost.toFixed(0)}</div>
                        <div className="text-xs text-muted-foreground">Custo</div>
                      </div>
                    </div>

                    {fuelPlan.stops.map((stop, index) => (
                      <div key={index} className="bg-secondary/30 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="bg-green-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-medium text-sm">{stop.station.name}</div>
                              <div className="text-xs text-muted-foreground">{stop.station.city} • {stop.distance_from_start}km</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-green-400">+{stop.fuel_to_add.toFixed(0)}L</div>
                            <div className="text-xs text-muted-foreground">R${stop.cost.toFixed(2)}</div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">{stop.reason}</div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs"
                          onClick={() => generateServiceOrder(stop.station, stop.fuel_to_add)}
                        >
                          <Send className="w-3 h-3 mr-1" /> Gerar Ordem
                        </Button>
                      </div>
                    ))}

                    {fuelPlan.gaps?.length > 0 && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2 text-red-400 font-medium text-sm">
                          <AlertTriangle className="w-4 h-4" /> Trechos sem postos
                        </div>
                        {fuelPlan.gaps.map((gap, index) => (
                          <div key={index} className="text-xs text-red-300/80">
                            {gap.start_km}km - {gap.end_km}km: {gap.suggestion}
                          </div>
                        ))}
                      </div>
                    )}

                    {fuelPlan.ai_summary && (
                      <div className="text-sm text-muted-foreground bg-secondary/50 rounded-lg p-3">
                        {fuelPlan.ai_summary}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Service Order */}
              {serviceOrder && (
                <Card className="bg-card border-white/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-heading uppercase">Ordem de Serviço</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="bg-secondary rounded-lg p-3 text-sm whitespace-pre-wrap font-mono">{serviceOrder.message}</div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleCopyMessage} className="flex-1">
                        {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                        {copied ? "Copiado!" : "Copiar"}
                      </Button>
                      <Button size="sm" onClick={handleWhatsAppShare} className="flex-1 bg-green-600 hover:bg-green-700">
                        <Send className="w-4 h-4 mr-1" /> WhatsApp
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
                  <CardTitle className="text-sm font-heading uppercase flex items-center gap-2">
                    <Truck className="w-4 h-4 text-primary" /> Dados do Caminhão
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Litros Atuais</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        data-testid="input-current-liters"
                        type="number"
                        value={vehicle.current_liters}
                        onChange={(e) => setVehicle({ ...vehicle, current_liters: parseFloat(e.target.value) || 0 })}
                        className="bg-secondary border-white/10 font-mono"
                      />
                      <span className="text-muted-foreground text-sm">L</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Consumo (km/L)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        data-testid="input-consumption-rate"
                        type="number"
                        step="0.1"
                        value={vehicle.consumption_rate}
                        onChange={(e) => setVehicle({ ...vehicle, consumption_rate: parseFloat(e.target.value) || 0 })}
                        className="bg-secondary border-white/10 font-mono"
                      />
                      <span className="text-muted-foreground text-sm">km/L</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Capacidade do Tanque</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        data-testid="input-tank-capacity"
                        type="number"
                        value={vehicle.tank_capacity}
                        onChange={(e) => setVehicle({ ...vehicle, tank_capacity: parseFloat(e.target.value) || 0 })}
                        className="bg-secondary border-white/10 font-mono"
                      />
                      <span className="text-muted-foreground text-sm">L</span>
                    </div>
                  </div>

                  <Separator className="bg-white/5" />

                  <div className="bg-secondary rounded-lg p-4">
                    <div className="text-xs text-muted-foreground mb-2">Autonomia</div>
                    <div className="text-3xl font-mono font-bold text-primary">{autonomy.toFixed(0)} km</div>
                  </div>

                  <Progress value={(vehicle.current_liters / vehicle.tank_capacity) * 100} className="h-3" />
                </CardContent>
              </Card>
            </TabsContent>

            {/* STATIONS TAB */}
            <TabsContent value="stations" className="space-y-4">
              {/* Station Editor */}
              {selectedStation && (
                <Card className="bg-card border-primary/30">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-heading uppercase">
                        {selectedStation.isNew ? "Novo Posto" : "Editar Posto"}
                      </CardTitle>
                      <Button variant="ghost" size="icon" onClick={() => setSelectedStation(null)} className="h-6 w-6">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Nome</Label>
                      <Input
                        data-testid="input-station-name"
                        value={stationForm.name}
                        onChange={(e) => setStationForm({ ...stationForm, name: e.target.value })}
                        placeholder="Nome do posto"
                        className="bg-secondary border-white/10"
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Cidade</Label>
                      <Input
                        value={stationForm.city}
                        onChange={(e) => setStationForm({ ...stationForm, city: e.target.value })}
                        placeholder="Cidade"
                        className="bg-secondary border-white/10"
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Preço Diesel (R$/L)</Label>
                      <Input
                        data-testid="input-diesel-price"
                        type="number"
                        step="0.01"
                        value={stationForm.diesel_price}
                        onChange={(e) => setStationForm({ ...stationForm, diesel_price: parseFloat(e.target.value) || 0 })}
                        className="bg-secondary border-white/10 font-mono"
                      />
                    </div>

                    <Separator className="bg-white/5" />

                    {/* Ratings */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground font-medium">Avaliações</Label>
                      <StarRating
                        label="Preço"
                        value={stationForm.ratings.price_rating}
                        onChange={(v) => setStationForm({ ...stationForm, ratings: { ...stationForm.ratings, price_rating: v } })}
                      />
                      <StarRating
                        label="Atendimento"
                        value={stationForm.ratings.service_rating}
                        onChange={(v) => setStationForm({ ...stationForm, ratings: { ...stationForm.ratings, service_rating: v } })}
                      />
                      <StarRating
                        label="Estacionamento"
                        value={stationForm.ratings.parking_rating}
                        onChange={(v) => setStationForm({ ...stationForm, ratings: { ...stationForm.ratings, parking_rating: v } })}
                      />
                      <StarRating
                        label="Segurança"
                        value={stationForm.ratings.security_rating}
                        onChange={(v) => setStationForm({ ...stationForm, ratings: { ...stationForm.ratings, security_rating: v } })}
                      />
                    </div>

                    <Separator className="bg-white/5" />

                    {/* Parking */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground font-medium">Estacionamento</Label>
                      <Select
                        value={stationForm.parking.parking_type}
                        onValueChange={(v) => setStationForm({
                          ...stationForm,
                          parking: { ...stationForm.parking, parking_type: v, min_fuel_liters: v === "with_min_fuel" ? 200 : null }
                        })}
                      >
                        <SelectTrigger className="bg-secondary border-white/10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">
                            <div className="flex items-center gap-2"><Car className="w-4 h-4 text-green-500" /> Grátis</div>
                          </SelectItem>
                          <SelectItem value="paid">
                            <div className="flex items-center gap-2"><Car className="w-4 h-4 text-yellow-500" /> Pago</div>
                          </SelectItem>
                          <SelectItem value="with_min_fuel">
                            <div className="flex items-center gap-2"><Fuel className="w-4 h-4 text-blue-500" /> Com abastecimento mínimo</div>
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      {stationForm.parking.parking_type === "with_min_fuel" && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Mínimo (litros)</Label>
                          <Input
                            type="number"
                            value={stationForm.parking.min_fuel_liters || ""}
                            onChange={(e) => setStationForm({
                              ...stationForm,
                              parking: { ...stationForm.parking, min_fuel_liters: parseFloat(e.target.value) || null }
                            })}
                            className="bg-secondary border-white/10 font-mono"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Ativo</Label>
                      <Switch
                        checked={stationForm.is_active}
                        onCheckedChange={(v) => setStationForm({ ...stationForm, is_active: v })}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button data-testid="btn-save-station" onClick={handleSaveStation} disabled={!stationForm.name} className="flex-1 bg-primary">
                        Salvar
                      </Button>
                      {!selectedStation.isNew && (
                        <Button variant="destructive" size="icon" onClick={() => deleteStation(selectedStation.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {!selectedStation && (
                <div className="text-center text-muted-foreground text-sm p-4 bg-secondary/50 rounded-lg border border-dashed border-white/10">
                  <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Use o botão <span className="text-green-400 font-medium">"Novo Posto"</span> no mapa</p>
                  <p className="text-xs mt-1">ou clique em um posto para editar</p>
                </div>
              )}

              {/* Station List */}
              <Card className="bg-card border-white/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-heading uppercase flex justify-between">
                    <span className="flex items-center gap-2"><Fuel className="w-4 h-4 text-primary" /> Postos</span>
                    <span className="text-xs font-normal text-muted-foreground">{stations.filter(s => s.is_active !== false).length} ativos / {stations.length}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {stations.map((station) => {
                    const rating = station.ratings ? 
                      ((station.ratings.price_rating + station.ratings.service_rating + station.ratings.parking_rating + station.ratings.security_rating) / 4).toFixed(1) : 0;
                    const isActive = station.is_active !== false;
                    return (
                      <div
                        key={station.id}
                        className={`p-3 rounded-lg border transition-all ${
                          selectedStation?.id === station.id ? "border-primary bg-primary/10" : "border-white/5 bg-secondary/50 hover:bg-secondary"
                        } ${!isActive ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <div 
                            className="flex items-center gap-2 flex-1 cursor-pointer"
                            onClick={() => setSelectedStation(station)}
                          >
                            <Fuel className={`w-4 h-4 ${isActive ? "text-primary" : "text-gray-500"}`} />
                            <div>
                              <div className="font-medium text-sm flex items-center gap-2">
                                {station.name}
                                {!isActive && (
                                  <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded uppercase">
                                    Inativo
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">{station.city}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <div className={`font-mono font-bold ${isActive ? "text-primary" : "text-gray-500"}`}>
                                R$ {station.diesel_price?.toFixed(2)}
                              </div>
                              {rating > 0 && (
                                <div className="flex items-center gap-1 justify-end text-xs">
                                  <Star size={10} className="text-yellow-400 fill-yellow-400" />
                                  {rating}
                                </div>
                              )}
                            </div>
                            {/* Quick Toggle Button */}
                            <button
                              data-testid={`btn-toggle-active-${station.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStation(station.id, { is_active: !isActive });
                              }}
                              className={`p-1.5 rounded-full transition-colors ${
                                isActive 
                                  ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" 
                                  : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                              }`}
                              title={isActive ? "Desativar posto" : "Ativar posto"}
                            >
                              <div className={`w-2 h-2 rounded-full ${isActive ? "bg-green-400" : "bg-red-400"}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
