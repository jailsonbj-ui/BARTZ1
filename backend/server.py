from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ========== MODELS ==========

class FuelStation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    latitude: float
    longitude: float
    diesel_price: float
    is_active: bool = True
    address: Optional[str] = None
    city: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FuelStationCreate(BaseModel):
    name: str
    latitude: float
    longitude: float
    diesel_price: float
    is_active: bool = True
    address: Optional[str] = None
    city: Optional[str] = None

class FuelStationUpdate(BaseModel):
    name: Optional[str] = None
    diesel_price: Optional[float] = None
    is_active: Optional[bool] = None

class Vehicle(BaseModel):
    current_liters: float
    consumption_rate: float  # km per liter
    tank_capacity: float

class RouteRequest(BaseModel):
    origin_city: str
    destination_city: str
    waypoint_cities: List[str] = []
    vehicle: Vehicle

class GeocodingResult(BaseModel):
    name: str
    latitude: float
    longitude: float
    display_name: str

class RecommendationRequest(BaseModel):
    route_distance: float  # km
    vehicle: Vehicle
    stations: List[FuelStation]
    route_geometry: Optional[List[List[float]]] = None

class ServiceOrderRequest(BaseModel):
    station_name: str
    station_location: str
    coordinates: str
    fuel_amount: Optional[float] = None

# ========== GEOCODING SERVICE ==========

# Known Brazilian cities coordinates (fallback)
KNOWN_CITIES = {
    "porto alegre": {"lat": -30.0346, "lng": -51.2177, "name": "Porto Alegre, RS"},
    "sao paulo": {"lat": -23.5505, "lng": -46.6333, "name": "São Paulo, SP"},
    "são paulo": {"lat": -23.5505, "lng": -46.6333, "name": "São Paulo, SP"},
    "curitiba": {"lat": -25.4290, "lng": -49.2671, "name": "Curitiba, PR"},
    "florianopolis": {"lat": -27.5954, "lng": -48.5480, "name": "Florianópolis, SC"},
    "florianópolis": {"lat": -27.5954, "lng": -48.5480, "name": "Florianópolis, SC"},
    "campinas": {"lat": -22.9099, "lng": -47.0626, "name": "Campinas, SP"},
    "santos": {"lat": -23.9608, "lng": -46.3336, "name": "Santos, SP"},
    "rio de janeiro": {"lat": -22.9068, "lng": -43.1729, "name": "Rio de Janeiro, RJ"},
    "belo horizonte": {"lat": -19.9167, "lng": -43.9345, "name": "Belo Horizonte, MG"},
    "registro": {"lat": -24.4872, "lng": -47.8439, "name": "Registro, SP"},
    "joinville": {"lat": -26.3045, "lng": -48.8487, "name": "Joinville, SC"},
    "blumenau": {"lat": -26.9194, "lng": -49.0661, "name": "Blumenau, SC"},
    "caxias do sul": {"lat": -29.1678, "lng": -51.1794, "name": "Caxias do Sul, RS"},
    "pelotas": {"lat": -31.7654, "lng": -52.3376, "name": "Pelotas, RS"},
    "londrina": {"lat": -23.3045, "lng": -51.1696, "name": "Londrina, PR"},
    "maringa": {"lat": -23.4210, "lng": -51.9331, "name": "Maringá, PR"},
    "maringá": {"lat": -23.4210, "lng": -51.9331, "name": "Maringá, PR"},
    "sorocaba": {"lat": -23.5015, "lng": -47.4526, "name": "Sorocaba, SP"},
    "ribeirao preto": {"lat": -21.1775, "lng": -47.8103, "name": "Ribeirão Preto, SP"},
    "ribeirão preto": {"lat": -21.1775, "lng": -47.8103, "name": "Ribeirão Preto, SP"},
}

def normalize_city_name(name: str) -> str:
    """Normalize city name for matching"""
    import unicodedata
    # Remove accents and convert to lowercase
    name = unicodedata.normalize('NFKD', name.lower())
    name = ''.join(c for c in name if not unicodedata.combining(c))
    # Remove state abbreviations like ", RS" or "- SP"
    for sep in [',', '-', '/']:
        if sep in name:
            name = name.split(sep)[0].strip()
    return name.strip()

async def geocode_location(query: str, country: str = "br") -> Optional[GeocodingResult]:
    """Geocode a location - first check known cities, then try Nominatim"""
    
    # Check known cities first
    normalized = normalize_city_name(query)
    if normalized in KNOWN_CITIES:
        city = KNOWN_CITIES[normalized]
        return GeocodingResult(
            name=city["name"],
            latitude=city["lat"],
            longitude=city["lng"],
            display_name=city["name"]
        )
    
    # Try Nominatim as fallback
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": query,
                    "countrycodes": country,
                    "format": "json",
                    "limit": 1,
                    "addressdetails": 1
                },
                headers={"User-Agent": "SmartFuel/1.0"},
                timeout=10.0
            )
            results = response.json()
            if results:
                result = results[0]
                return GeocodingResult(
                    name=query,
                    latitude=float(result["lat"]),
                    longitude=float(result["lon"]),
                    display_name=result["display_name"]
                )
        except Exception as e:
            logger.error(f"Geocoding error: {e}")
    
    # Return None if city not found
    return None

@api_router.get("/geocode")
async def geocode_endpoint(query: str):
    """Search for a location by name"""
    async with httpx.AsyncClient() as http_client:
        try:
            response = await http_client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": query,
                    "countrycodes": "br",
                    "format": "json",
                    "limit": 5,
                    "addressdetails": 1
                },
                headers={"User-Agent": "SmartFuel/1.0"},
                timeout=10.0
            )
            results = response.json()
            return [
                {
                    "name": r.get("name", query),
                    "latitude": float(r["lat"]),
                    "longitude": float(r["lon"]),
                    "display_name": r["display_name"],
                    "type": r.get("type", ""),
                    "class": r.get("class", "")
                }
                for r in results
            ]
        except Exception as e:
            logger.error(f"Geocoding error: {e}")
            raise HTTPException(status_code=500, detail=f"Geocoding failed: {str(e)}")

@api_router.get("/search-stations")
async def search_stations(query: str):
    """Search for fuel stations using Nominatim"""
    async with httpx.AsyncClient() as http_client:
        try:
            # Search for fuel stations
            response = await http_client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": f"posto combustível {query}",
                    "countrycodes": "br",
                    "format": "json",
                    "limit": 10,
                    "addressdetails": 1
                },
                headers={"User-Agent": "SmartFuel/1.0"},
                timeout=10.0
            )
            results = response.json()
            
            stations = []
            for r in results:
                addr = r.get("address", {})
                stations.append({
                    "name": r.get("name", f"Posto em {query}"),
                    "latitude": float(r["lat"]),
                    "longitude": float(r["lon"]),
                    "display_name": r["display_name"],
                    "city": addr.get("city") or addr.get("town") or addr.get("municipality", ""),
                    "state": addr.get("state", ""),
                    "address": f"{addr.get('road', '')} {addr.get('suburb', '')}".strip()
                })
            return stations
        except Exception as e:
            logger.error(f"Station search error: {e}")
            raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

# ========== ROUTING SERVICE (OSRM) ==========

async def get_route_from_osrm(coordinates: List[tuple]) -> dict:
    """Get route from OSRM (Open Source Routing Machine)"""
    # Format coordinates as "lon,lat;lon,lat;..."
    coords_str = ";".join([f"{lon},{lat}" for lat, lon in coordinates])
    
    async with httpx.AsyncClient() as http_client:
        try:
            response = await http_client.get(
                f"https://router.project-osrm.org/route/v1/driving/{coords_str}",
                params={
                    "overview": "full",
                    "geometries": "geojson",
                    "steps": "true"
                },
                timeout=30.0
            )
            data = response.json()
            
            if data.get("code") == "Ok" and data.get("routes"):
                route = data["routes"][0]
                return {
                    "distance": route["distance"] / 1000,  # Convert to km
                    "duration": route["duration"] / 60,    # Convert to minutes
                    "geometry": route["geometry"]["coordinates"],  # [lng, lat] pairs
                    "steps": route.get("legs", [{}])[0].get("steps", [])
                }
        except Exception as e:
            logger.error(f"OSRM routing error: {e}")
    return None

@api_router.post("/calculate-route")
async def calculate_route(request: RouteRequest):
    """Calculate route using real roads via OSRM"""
    
    # Geocode all locations
    locations = []
    
    # Origin
    origin = await geocode_location(request.origin_city)
    if not origin:
        raise HTTPException(status_code=400, detail=f"Não foi possível encontrar: {request.origin_city}")
    locations.append({"name": request.origin_city, "lat": origin.latitude, "lng": origin.longitude, "display": origin.display_name})
    
    # Waypoints
    for wp_city in request.waypoint_cities:
        if wp_city.strip():
            wp = await geocode_location(wp_city)
            if wp:
                locations.append({"name": wp_city, "lat": wp.latitude, "lng": wp.longitude, "display": wp.display_name})
    
    # Destination
    dest = await geocode_location(request.destination_city)
    if not dest:
        raise HTTPException(status_code=400, detail=f"Não foi possível encontrar: {request.destination_city}")
    locations.append({"name": request.destination_city, "lat": dest.latitude, "lng": dest.longitude, "display": dest.display_name})
    
    # Get route from OSRM
    coordinates = [(loc["lat"], loc["lng"]) for loc in locations]
    route_data = await get_route_from_osrm(coordinates)
    
    if not route_data:
        raise HTTPException(status_code=500, detail="Erro ao calcular rota. Tente novamente.")
    
    total_distance = route_data["distance"]
    
    # Calculate autonomy
    autonomy = request.vehicle.current_liters * request.vehicle.consumption_rate
    fuel_needed = total_distance / request.vehicle.consumption_rate
    
    # Calculate where fuel will run out along the route
    fuel_limit_point = None
    if autonomy < total_distance:
        # Find the point along the geometry where fuel runs out
        cumulative_distance = 0
        geometry = route_data["geometry"]
        
        for i in range(len(geometry) - 1):
            p1 = geometry[i]
            p2 = geometry[i + 1]
            
            # Calculate segment distance
            segment_distance = calculate_distance(p1[1], p1[0], p2[1], p2[0])
            
            if cumulative_distance + segment_distance >= autonomy:
                # Interpolate the exact point
                remaining = autonomy - cumulative_distance
                ratio = remaining / segment_distance if segment_distance > 0 else 0
                
                fuel_limit_point = {
                    "longitude": p1[0] + ratio * (p2[0] - p1[0]),
                    "latitude": p1[1] + ratio * (p2[1] - p1[1]),
                    "distance_from_origin": round(autonomy, 2)
                }
                break
            cumulative_distance += segment_distance
    
    # Convert geometry to [lat, lng] format for frontend
    route_geometry = [[coord[1], coord[0]] for coord in route_data["geometry"]]
    
    return {
        "total_distance": round(total_distance, 2),
        "duration_minutes": round(route_data["duration"], 0),
        "autonomy": round(autonomy, 2),
        "fuel_needed": round(fuel_needed, 2),
        "can_complete_route": autonomy >= total_distance,
        "fuel_limit_point": fuel_limit_point,
        "route_points": locations,
        "route_geometry": route_geometry  # Actual road path
    }

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points using Haversine formula (in km)"""
    import math
    R = 6371  # Earth's radius in km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

# ========== FUEL STATION CRUD ==========

@api_router.post("/stations", response_model=FuelStation)
async def create_station(station: FuelStationCreate):
    station_obj = FuelStation(**station.model_dump())
    doc = station_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.fuel_stations.insert_one(doc)
    return station_obj

@api_router.get("/stations", response_model=List[FuelStation])
async def get_stations():
    stations = await db.fuel_stations.find({}, {"_id": 0}).to_list(1000)
    for station in stations:
        if isinstance(station.get('created_at'), str):
            station['created_at'] = datetime.fromisoformat(station['created_at'])
    return stations

@api_router.get("/stations/{station_id}", response_model=FuelStation)
async def get_station(station_id: str):
    station = await db.fuel_stations.find_one({"id": station_id}, {"_id": 0})
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    if isinstance(station.get('created_at'), str):
        station['created_at'] = datetime.fromisoformat(station['created_at'])
    return station

@api_router.put("/stations/{station_id}", response_model=FuelStation)
async def update_station(station_id: str, update: FuelStationUpdate):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.fuel_stations.update_one(
        {"id": station_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Station not found")
    
    station = await db.fuel_stations.find_one({"id": station_id}, {"_id": 0})
    if isinstance(station.get('created_at'), str):
        station['created_at'] = datetime.fromisoformat(station['created_at'])
    return station

@api_router.delete("/stations/{station_id}")
async def delete_station(station_id: str):
    result = await db.fuel_stations.delete_one({"id": station_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Station not found")
    return {"message": "Station deleted successfully"}

# ========== STATIONS ALONG ROUTE ==========

def point_to_line_distance(point_lat, point_lng, line_coords):
    """Calculate minimum distance from a point to a polyline"""
    min_distance = float('inf')
    
    for i in range(len(line_coords) - 1):
        p1 = line_coords[i]
        p2 = line_coords[i + 1]
        
        # Simple perpendicular distance approximation
        dist = calculate_distance(point_lat, point_lng, (p1[0] + p2[0])/2, (p1[1] + p2[1])/2)
        min_distance = min(min_distance, dist)
    
    return min_distance

@api_router.post("/stations-along-route")
async def get_stations_along_route(route_geometry: List[List[float]], max_distance_km: float = 50):
    """Get stations within max_distance_km of the route"""
    stations = await db.fuel_stations.find({"is_active": True}, {"_id": 0}).to_list(1000)
    
    nearby_stations = []
    for station in stations:
        if isinstance(station.get('created_at'), str):
            station['created_at'] = datetime.fromisoformat(station['created_at'])
        
        # Check distance to route
        dist = point_to_line_distance(station['latitude'], station['longitude'], route_geometry)
        if dist <= max_distance_km:
            station['distance_to_route'] = round(dist, 2)
            nearby_stations.append(station)
    
    # Sort by price
    nearby_stations.sort(key=lambda s: s['diesel_price'])
    
    return nearby_stations

# ========== AI RECOMMENDATION ==========

@api_router.post("/recommend-station")
async def recommend_station(request: RecommendationRequest):
    """Use AI to recommend the best fuel station along the route"""
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    # Calculate autonomy
    autonomy = request.vehicle.current_liters * request.vehicle.consumption_rate
    
    # Filter stations within autonomy range and active
    available_stations = [s for s in request.stations if s.is_active]
    
    if not available_stations:
        return {
            "recommendation": None,
            "reason": "Nenhum posto ativo disponível na rota"
        }
    
    # Find cheapest station
    cheapest = min(available_stations, key=lambda s: s.diesel_price)
    
    # Build context for AI
    stations_info = "\n".join([
        f"- {s.name}: R$ {s.diesel_price:.2f}/L ({s.city or 'Localização não especificada'})"
        for s in available_stations[:10]  # Limit to 10 stations
    ])
    
    chat = LlmChat(
        api_key=api_key,
        session_id=f"recommendation-{uuid.uuid4()}",
        system_message="Você é um assistente especializado em logística de frotas. Responda de forma concisa e profissional em português."
    ).with_model("openai", "gpt-5.2")
    
    prompt = f"""Analise os postos de combustível ao longo da rota e recomende o melhor para abastecimento:

Autonomia atual do veículo: {autonomy:.1f} km
Distância total da rota: {request.route_distance:.1f} km
Capacidade do tanque: {request.vehicle.tank_capacity} litros
Combustível atual: {request.vehicle.current_liters} litros

Postos disponíveis ao longo da rota:
{stations_info}

Recomende o posto com melhor custo-benefício considerando o preço do diesel e a localização na rota. Responda de forma direta com:
1. Nome do posto recomendado
2. Motivo da recomendação (máximo 2 frases)
3. Uma dica de economia"""

    try:
        response = await chat.send_message(UserMessage(text=prompt))
        
        return {
            "recommendation": {
                "station": cheapest.model_dump(),
                "ai_analysis": response
            },
            "all_stations": [s.model_dump() for s in available_stations]
        }
    except Exception as e:
        logger.error(f"AI recommendation error: {e}")
        return {
            "recommendation": {
                "station": cheapest.model_dump(),
                "ai_analysis": f"Recomendamos o posto {cheapest.name} por ter o menor preço: R$ {cheapest.diesel_price:.2f}/L"
            },
            "all_stations": [s.model_dump() for s in available_stations]
        }

# ========== SERVICE ORDER GENERATOR ==========

@api_router.post("/generate-service-order")
async def generate_service_order(request: ServiceOrderRequest):
    """Generate a professional service order for WhatsApp"""
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    chat = LlmChat(
        api_key=api_key,
        session_id=f"service-order-{uuid.uuid4()}",
        system_message="Você é um assistente de frotas. Gere mensagens profissionais e concisas para motoristas."
    ).with_model("openai", "gpt-5.2")
    
    fuel_info = f"\nQuantidade a abastecer: {request.fuel_amount:.1f} litros" if request.fuel_amount else ""
    
    prompt = f"""Gere uma mensagem curta e profissional para enviar ao motorista via WhatsApp com as instruções de abastecimento:

Posto: {request.station_name}
Localização: {request.station_location}
Coordenadas: {request.coordinates}{fuel_info}

A mensagem deve:
1. Ser objetiva e profissional
2. Incluir o nome do posto
3. Incluir link do Google Maps com as coordenadas
4. Ter no máximo 4 linhas
5. Usar emojis moderadamente (máximo 3)"""

    try:
        response = await chat.send_message(UserMessage(text=prompt))
        
        # Generate Google Maps link
        coords = request.coordinates.replace(" ", "")
        maps_link = f"https://www.google.com/maps?q={coords}"
        
        return {
            "message": response,
            "maps_link": maps_link,
            "station": request.station_name
        }
    except Exception as e:
        logger.error(f"Service order error: {e}")
        coords = request.coordinates.replace(" ", "")
        maps_link = f"https://www.google.com/maps?q={coords}"
        
        fallback_message = f"""🚛 ORDEM DE ABASTECIMENTO

📍 Posto: {request.station_name}
📌 Local: {request.station_location}
🗺️ Mapa: {maps_link}
{f'⛽ Abastecer: {request.fuel_amount:.1f}L' if request.fuel_amount else ''}"""
        
        return {
            "message": fallback_message,
            "maps_link": maps_link,
            "station": request.station_name
        }

# ========== SEED DATA ==========

@api_router.post("/seed-stations")
async def seed_stations():
    """Populate database with sample fuel stations between Porto Alegre and São Paulo"""
    sample_stations = [
        {
            "name": "Posto Ipiranga - Zona Sul",
            "latitude": -30.1087,
            "longitude": -51.2217,
            "diesel_price": 5.89,
            "is_active": True,
            "city": "Porto Alegre",
            "address": "Av. Ipiranga, 6681"
        },
        {
            "name": "Auto Posto Curitiba Centro",
            "latitude": -25.4290,
            "longitude": -49.2671,
            "diesel_price": 5.75,
            "is_active": True,
            "city": "Curitiba",
            "address": "Rua XV de Novembro, 1234"
        },
        {
            "name": "Posto BR Registro",
            "latitude": -24.4872,
            "longitude": -47.8439,
            "diesel_price": 5.65,
            "is_active": True,
            "city": "Registro",
            "address": "BR-116, km 432"
        },
        {
            "name": "Posto Shell Campinas",
            "latitude": -22.9099,
            "longitude": -47.0626,
            "diesel_price": 5.78,
            "is_active": True,
            "city": "Campinas",
            "address": "Rod. Anhanguera, km 98"
        },
        {
            "name": "Posto Texaco São Paulo",
            "latitude": -23.5505,
            "longitude": -46.6333,
            "diesel_price": 5.95,
            "is_active": True,
            "city": "São Paulo",
            "address": "Av. Paulista, 1000"
        }
    ]
    
    # Clear existing stations
    await db.fuel_stations.delete_many({})
    
    created_stations = []
    for station_data in sample_stations:
        station_obj = FuelStation(**station_data)
        doc = station_obj.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.fuel_stations.insert_one(doc)
        created_stations.append(station_obj)
    
    return {"message": f"Created {len(created_stations)} sample stations", "stations": created_stations}

# ========== HEALTH CHECK ==========

@api_router.get("/")
async def root():
    return {"message": "Fleet Fuel Management API", "status": "operational"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
