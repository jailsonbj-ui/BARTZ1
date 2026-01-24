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

class ParkingInfo(BaseModel):
    has_parking: bool = True
    parking_type: str = "free"  # free, paid, with_min_fuel
    min_fuel_liters: Optional[float] = None

class StationRatings(BaseModel):
    price_rating: int = 0  # 0-5 stars
    service_rating: int = 0  # 0-5 stars
    parking_rating: int = 0  # 0-5 stars
    security_rating: int = 0  # 0-5 stars
    
    @property
    def overall_rating(self) -> float:
        total = self.price_rating + self.service_rating + self.parking_rating + self.security_rating
        return round(total / 4, 1) if total > 0 else 0

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
    ratings: StationRatings = Field(default_factory=StationRatings)
    parking: ParkingInfo = Field(default_factory=ParkingInfo)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FuelStationCreate(BaseModel):
    name: str
    latitude: float
    longitude: float
    diesel_price: float
    is_active: bool = True
    address: Optional[str] = None
    city: Optional[str] = None
    ratings: Optional[StationRatings] = None
    parking: Optional[ParkingInfo] = None

class FuelStationUpdate(BaseModel):
    name: Optional[str] = None
    diesel_price: Optional[float] = None
    is_active: Optional[bool] = None
    ratings: Optional[StationRatings] = None
    parking: Optional[ParkingInfo] = None

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

class FuelStop(BaseModel):
    station: dict
    distance_from_start: float
    fuel_to_add: float
    fuel_after_stop: float
    reason: str

class MultiStopPlanRequest(BaseModel):
    route_distance: float
    route_geometry: List[List[float]]
    vehicle: Vehicle
    stations: List[dict]

class ServiceOrderRequest(BaseModel):
    station_name: str
    station_location: str
    coordinates: str
    fuel_amount: Optional[float] = None

# ========== BRAZILIAN CITIES DATABASE ==========

BRAZILIAN_CITIES = [
    {"name": "Porto Alegre", "state": "RS", "lat": -30.0346, "lng": -51.2177},
    {"name": "São Paulo", "state": "SP", "lat": -23.5505, "lng": -46.6333},
    {"name": "Rio de Janeiro", "state": "RJ", "lat": -22.9068, "lng": -43.1729},
    {"name": "Curitiba", "state": "PR", "lat": -25.4290, "lng": -49.2671},
    {"name": "Florianópolis", "state": "SC", "lat": -27.5954, "lng": -48.5480},
    {"name": "Belo Horizonte", "state": "MG", "lat": -19.9167, "lng": -43.9345},
    {"name": "Brasília", "state": "DF", "lat": -15.7801, "lng": -47.9292},
    {"name": "Salvador", "state": "BA", "lat": -12.9714, "lng": -38.5014},
    {"name": "Recife", "state": "PE", "lat": -8.0476, "lng": -34.8770},
    {"name": "Fortaleza", "state": "CE", "lat": -3.7172, "lng": -38.5433},
    {"name": "Manaus", "state": "AM", "lat": -3.1190, "lng": -60.0217},
    {"name": "Belém", "state": "PA", "lat": -1.4558, "lng": -48.4902},
    {"name": "Goiânia", "state": "GO", "lat": -16.6869, "lng": -49.2648},
    {"name": "Campinas", "state": "SP", "lat": -22.9099, "lng": -47.0626},
    {"name": "São Bernardo do Campo", "state": "SP", "lat": -23.6914, "lng": -46.5646},
    {"name": "Santos", "state": "SP", "lat": -23.9608, "lng": -46.3336},
    {"name": "Ribeirão Preto", "state": "SP", "lat": -21.1775, "lng": -47.8103},
    {"name": "Sorocaba", "state": "SP", "lat": -23.5015, "lng": -47.4526},
    {"name": "Registro", "state": "SP", "lat": -24.4872, "lng": -47.8439},
    {"name": "Joinville", "state": "SC", "lat": -26.3045, "lng": -48.8487},
    {"name": "Blumenau", "state": "SC", "lat": -26.9194, "lng": -49.0661},
    {"name": "Caxias do Sul", "state": "RS", "lat": -29.1678, "lng": -51.1794},
    {"name": "Pelotas", "state": "RS", "lat": -31.7654, "lng": -52.3376},
    {"name": "Londrina", "state": "PR", "lat": -23.3045, "lng": -51.1696},
    {"name": "Maringá", "state": "PR", "lat": -23.4210, "lng": -51.9331},
    {"name": "Foz do Iguaçu", "state": "PR", "lat": -25.5163, "lng": -54.5854},
    {"name": "Cascavel", "state": "PR", "lat": -24.9554, "lng": -53.4560},
    {"name": "Ponta Grossa", "state": "PR", "lat": -25.0994, "lng": -50.1583},
    {"name": "Vitória", "state": "ES", "lat": -20.3155, "lng": -40.3128},
    {"name": "Vila Velha", "state": "ES", "lat": -20.3297, "lng": -40.2925},
    {"name": "Uberlândia", "state": "MG", "lat": -18.9186, "lng": -48.2772},
    {"name": "Juiz de Fora", "state": "MG", "lat": -21.7642, "lng": -43.3503},
    {"name": "Montes Claros", "state": "MG", "lat": -16.7350, "lng": -43.8617},
    {"name": "Natal", "state": "RN", "lat": -5.7945, "lng": -35.2110},
    {"name": "João Pessoa", "state": "PB", "lat": -7.1195, "lng": -34.8450},
    {"name": "Maceió", "state": "AL", "lat": -9.6498, "lng": -35.7089},
    {"name": "Aracaju", "state": "SE", "lat": -10.9472, "lng": -37.0731},
    {"name": "Teresina", "state": "PI", "lat": -5.0920, "lng": -42.8038},
    {"name": "São Luís", "state": "MA", "lat": -2.5307, "lng": -44.3068},
    {"name": "Campo Grande", "state": "MS", "lat": -20.4697, "lng": -54.6201},
    {"name": "Cuiabá", "state": "MT", "lat": -15.6014, "lng": -56.0979},
    {"name": "Porto Velho", "state": "RO", "lat": -8.7612, "lng": -63.9004},
    {"name": "Rio Branco", "state": "AC", "lat": -9.9754, "lng": -67.8249},
    {"name": "Macapá", "state": "AP", "lat": 0.0349, "lng": -51.0694},
    {"name": "Boa Vista", "state": "RR", "lat": 2.8235, "lng": -60.6758},
    {"name": "Palmas", "state": "TO", "lat": -10.2128, "lng": -48.3603},
    {"name": "Feira de Santana", "state": "BA", "lat": -12.2664, "lng": -38.9663},
    {"name": "Vitória da Conquista", "state": "BA", "lat": -14.8619, "lng": -40.8387},
    {"name": "Caruaru", "state": "PE", "lat": -8.2760, "lng": -35.9819},
    {"name": "Petrolina", "state": "PE", "lat": -9.3891, "lng": -40.5028},
    {"name": "Juazeiro", "state": "BA", "lat": -9.4163, "lng": -40.5003},
    {"name": "Governador Valadares", "state": "MG", "lat": -18.8510, "lng": -41.9493},
    {"name": "Ipatinga", "state": "MG", "lat": -19.4687, "lng": -42.5366},
    {"name": "Divinópolis", "state": "MG", "lat": -20.1389, "lng": -44.8842},
    {"name": "Uberaba", "state": "MG", "lat": -19.7473, "lng": -47.9318},
    {"name": "Passo Fundo", "state": "RS", "lat": -28.2576, "lng": -52.4091},
    {"name": "Santa Maria", "state": "RS", "lat": -29.6868, "lng": -53.8149},
    {"name": "Uruguaiana", "state": "RS", "lat": -29.7614, "lng": -57.0853},
    {"name": "Bagé", "state": "RS", "lat": -31.3289, "lng": -54.1069},
    {"name": "Chapecó", "state": "SC", "lat": -27.0963, "lng": -52.6158},
    {"name": "Criciúma", "state": "SC", "lat": -28.6775, "lng": -49.3697},
    {"name": "Lages", "state": "SC", "lat": -27.8157, "lng": -50.3263},
    {"name": "Guarapuava", "state": "PR", "lat": -25.3907, "lng": -51.4628},
    {"name": "Paranaguá", "state": "PR", "lat": -25.5205, "lng": -48.5095},
    {"name": "São José dos Campos", "state": "SP", "lat": -23.2237, "lng": -45.9009},
    {"name": "Piracicaba", "state": "SP", "lat": -22.7255, "lng": -47.6492},
    {"name": "Bauru", "state": "SP", "lat": -22.3246, "lng": -49.0871},
    {"name": "São José do Rio Preto", "state": "SP", "lat": -20.8113, "lng": -49.3758},
    {"name": "Presidente Prudente", "state": "SP", "lat": -22.1207, "lng": -51.3882},
    {"name": "Marília", "state": "SP", "lat": -22.2139, "lng": -49.9458},
    {"name": "Araçatuba", "state": "SP", "lat": -21.2090, "lng": -50.4327},
    {"name": "Araraquara", "state": "SP", "lat": -21.7845, "lng": -48.1780},
    {"name": "Franca", "state": "SP", "lat": -20.5387, "lng": -47.4008},
    {"name": "Limeira", "state": "SP", "lat": -22.5642, "lng": -47.4017},
    {"name": "Taubaté", "state": "SP", "lat": -23.0224, "lng": -45.5558},
    {"name": "Guarulhos", "state": "SP", "lat": -23.4538, "lng": -46.5333},
    {"name": "Osasco", "state": "SP", "lat": -23.5324, "lng": -46.7916},
    {"name": "Niterói", "state": "RJ", "lat": -22.8833, "lng": -43.1036},
    {"name": "Petrópolis", "state": "RJ", "lat": -22.5050, "lng": -43.1786},
    {"name": "Volta Redonda", "state": "RJ", "lat": -22.5202, "lng": -44.1042},
    {"name": "Campos dos Goytacazes", "state": "RJ", "lat": -21.7545, "lng": -41.3244},
]

def normalize_text(text: str) -> str:
    """Normalize text for matching"""
    import unicodedata
    text = unicodedata.normalize('NFKD', text.lower())
    text = ''.join(c for c in text if not unicodedata.combining(c))
    return text.strip()

def get_city_coords(city_name: str) -> Optional[dict]:
    """Get city coordinates from local database"""
    normalized = normalize_text(city_name)
    
    for city in BRAZILIAN_CITIES:
        city_norm = normalize_text(city["name"])
        city_full = normalize_text(f"{city['name']} {city['state']}")
        city_full2 = normalize_text(f"{city['name']}, {city['state']}")
        
        if normalized == city_norm or normalized == city_full or normalized == city_full2 or normalized in city_full:
            return {
                "name": f"{city['name']}, {city['state']}",
                "lat": city["lat"],
                "lng": city["lng"]
            }
    return None

@api_router.get("/search-cities")
async def search_cities(query: str):
    """Search for cities with autocomplete"""
    if len(query) < 2:
        return []
    
    normalized_query = normalize_text(query)
    results = []
    
    for city in BRAZILIAN_CITIES:
        city_name = normalize_text(city["name"])
        city_full = normalize_text(f"{city['name']} {city['state']}")
        
        if normalized_query in city_name or normalized_query in city_full:
            results.append({
                "name": city["name"],
                "state": city["state"],
                "display_name": f"{city['name']}, {city['state']}",
                "latitude": city["lat"],
                "longitude": city["lng"]
            })
    
    # Sort by relevance (starts with query first)
    results.sort(key=lambda x: (
        0 if normalize_text(x["name"]).startswith(normalized_query) else 1,
        x["name"]
    ))
    
    return results[:10]

# ========== GEOCODING (Nominatim - OpenStreetMap gratuito) ==========

GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY')

async def geocode_with_nominatim(query: str) -> List[dict]:
    """Geocode using Nominatim API (OpenStreetMap - free)"""
    import urllib.request
    import urllib.parse
    import json as json_module
    import ssl
    
    try:
        params = urllib.parse.urlencode({
            "q": query,
            "countrycodes": "br",
            "format": "json",
            "limit": 10,
            "addressdetails": 1
        })
        url = f"https://nominatim.openstreetmap.org/search?{params}"
        
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "SmartFuel/2.0 (contact@smartfuel.com.br)"}
        )
        
        ctx = ssl.create_default_context()
        with urllib.request.urlopen(req, timeout=15, context=ctx) as response:
            data = json_module.loads(response.read().decode())
        
        results = []
        seen = set()
        
        for item in data:
            addr = item.get("address", {})
            state = addr.get("state", "")
            city_name = item.get("name", addr.get("city", addr.get("town", addr.get("municipality", query))))
            
            key = f"{city_name}_{state}"
            if key in seen:
                continue
            seen.add(key)
            
            results.append({
                "name": city_name,
                "state": state,
                "display_name": f"{city_name}, {state}" if state else city_name,
                "latitude": float(item["lat"]),
                "longitude": float(item["lon"])
            })
        
        return results[:8]
    except Exception as e:
        logger.error(f"Nominatim error: {e}")
    return []

async def geocode_with_google(query: str) -> Optional[GeocodingResult]:
    """Geocode using Google Maps API"""
    if not GOOGLE_MAPS_API_KEY:
        return None
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={
                    "address": f"{query}, Brasil",
                    "key": GOOGLE_MAPS_API_KEY,
                    "language": "pt-BR",
                    "region": "br"
                },
                timeout=10.0
            )
            data = response.json()
            
            if data.get("status") == "OK" and data.get("results"):
                result = data["results"][0]
                location = result["geometry"]["location"]
                return GeocodingResult(
                    name=result.get("formatted_address", query),
                    latitude=location["lat"],
                    longitude=location["lng"],
                    display_name=result.get("formatted_address", query)
                )
        except Exception as e:
            logger.error(f"Google geocoding error: {e}")
    return None

@api_router.get("/search-cities")
async def search_cities(query: str):
    """Search for cities using Nominatim (OpenStreetMap)"""
    if len(query) < 2:
        return []
    
    # Try Nominatim first
    results = await geocode_with_nominatim(query)
    if results:
        return results
    
    # Fallback to local database
    normalized_query = normalize_text(query)
    local_results = []
    for city in BRAZILIAN_CITIES:
        city_name = normalize_text(city["name"])
        if normalized_query in city_name:
            local_results.append({
                "name": city["name"],
                "state": city["state"],
                "display_name": f"{city['name']}, {city['state']}",
                "latitude": city["lat"],
                "longitude": city["lng"]
            })
    return local_results[:10]

async def geocode_location(query: str) -> Optional[GeocodingResult]:
    """Geocode a location - try multiple sources"""
    
    # Try Nominatim (free)
    results = await geocode_with_nominatim(query)
    if results:
        r = results[0]
        return GeocodingResult(
            name=r["display_name"],
            latitude=r["latitude"],
            longitude=r["longitude"],
            display_name=r["display_name"]
        )
    
    # Try Google Maps
    result = await geocode_with_google(query)
    if result:
        return result
    
    # Fallback to local database
    city = get_city_coords(query)
    if city:
        return GeocodingResult(
            name=city["name"],
            latitude=city["lat"],
            longitude=city["lng"],
            display_name=city["name"]
        )
    
    return None

# ========== ROUTING (Google Directions or OSRM) ==========

async def get_route_from_google(coordinates: List[tuple]) -> dict:
    """Get route from Google Directions API"""
    if not GOOGLE_MAPS_API_KEY or len(coordinates) < 2:
        return None
    
    origin = f"{coordinates[0][0]},{coordinates[0][1]}"
    destination = f"{coordinates[-1][0]},{coordinates[-1][1]}"
    
    waypoints = ""
    if len(coordinates) > 2:
        waypoints = "|".join([f"{c[0]},{c[1]}" for c in coordinates[1:-1]])
    
    async with httpx.AsyncClient() as client:
        try:
            params = {
                "origin": origin,
                "destination": destination,
                "key": GOOGLE_MAPS_API_KEY,
                "mode": "driving",
                "language": "pt-BR",
                "region": "br"
            }
            if waypoints:
                params["waypoints"] = waypoints
            
            response = await client.get(
                "https://maps.googleapis.com/maps/api/directions/json",
                params=params,
                timeout=30.0
            )
            data = response.json()
            
            if data.get("status") == "OK" and data.get("routes"):
                route = data["routes"][0]
                
                # Calculate total distance and duration
                total_distance = sum(leg["distance"]["value"] for leg in route["legs"]) / 1000
                total_duration = sum(leg["duration"]["value"] for leg in route["legs"]) / 60
                
                # Decode polyline to get geometry
                geometry = []
                for leg in route["legs"]:
                    for step in leg["steps"]:
                        points = decode_polyline(step["polyline"]["points"])
                        geometry.extend(points)
                
                return {
                    "distance": total_distance,
                    "duration": total_duration,
                    "geometry": geometry  # [lng, lat] format
                }
        except Exception as e:
            logger.error(f"Google Directions error: {e}")
    
    return None

def decode_polyline(polyline_str: str) -> List[List[float]]:
    """Decode Google polyline encoding to coordinates"""
    index, lat, lng = 0, 0, 0
    coordinates = []
    
    while index < len(polyline_str):
        # Decode latitude
        shift, result = 0, 0
        while True:
            b = ord(polyline_str[index]) - 63
            index += 1
            result |= (b & 0x1f) << shift
            shift += 5
            if b < 0x20:
                break
        lat += (~(result >> 1) if result & 1 else result >> 1)
        
        # Decode longitude
        shift, result = 0, 0
        while True:
            b = ord(polyline_str[index]) - 63
            index += 1
            result |= (b & 0x1f) << shift
            shift += 5
            if b < 0x20:
                break
        lng += (~(result >> 1) if result & 1 else result >> 1)
        
        coordinates.append([lng / 1e5, lat / 1e5])
    
    return coordinates

# ========== ROUTING (OSRM) ==========

async def get_route_from_osrm(coordinates: List[tuple]) -> dict:
    """Get route from OSRM"""
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
                    "distance": route["distance"] / 1000,
                    "duration": route["duration"] / 60,
                    "geometry": route["geometry"]["coordinates"],
                }
        except Exception as e:
            logger.error(f"OSRM routing error: {e}")
    return None

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance using Haversine formula"""
    import math
    R = 6371
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

@api_router.post("/calculate-route")
async def calculate_route(request: RouteRequest):
    """Calculate route using Google Directions or OSRM"""
    locations = []
    
    origin = await geocode_location(request.origin_city)
    if not origin:
        raise HTTPException(status_code=400, detail=f"Cidade não encontrada: {request.origin_city}")
    locations.append({"name": origin.name, "lat": origin.latitude, "lng": origin.longitude})
    
    for wp_city in request.waypoint_cities:
        if wp_city.strip():
            wp = await geocode_location(wp_city)
            if wp:
                locations.append({"name": wp.name, "lat": wp.latitude, "lng": wp.longitude})
    
    dest = await geocode_location(request.destination_city)
    if not dest:
        raise HTTPException(status_code=400, detail=f"Cidade não encontrada: {request.destination_city}")
    locations.append({"name": dest.name, "lat": dest.latitude, "lng": dest.longitude})
    
    coordinates = [(loc["lat"], loc["lng"]) for loc in locations]
    
    # Try Google Directions first, fallback to OSRM
    route_data = await get_route_from_google(coordinates)
    if not route_data:
        route_data = await get_route_from_osrm(coordinates)
    
    if not route_data:
        raise HTTPException(status_code=500, detail="Erro ao calcular rota. Tente novamente.")
    
    total_distance = route_data["distance"]
    autonomy = request.vehicle.current_liters * request.vehicle.consumption_rate
    fuel_needed = total_distance / request.vehicle.consumption_rate
    
    # Calculate fuel limit point
    fuel_limit_point = None
    if autonomy < total_distance:
        cumulative_distance = 0
        geometry = route_data["geometry"]
        for i in range(len(geometry) - 1):
            p1 = geometry[i]
            p2 = geometry[i + 1]
            segment_distance = calculate_distance(p1[1], p1[0], p2[1], p2[0])
            if cumulative_distance + segment_distance >= autonomy:
                remaining = autonomy - cumulative_distance
                ratio = remaining / segment_distance if segment_distance > 0 else 0
                fuel_limit_point = {
                    "longitude": p1[0] + ratio * (p2[0] - p1[0]),
                    "latitude": p1[1] + ratio * (p2[1] - p1[1]),
                    "distance_from_origin": round(autonomy, 2)
                }
                break
            cumulative_distance += segment_distance
    
    route_geometry = [[coord[1], coord[0]] for coord in route_data["geometry"]]
    
    return {
        "total_distance": round(total_distance, 2),
        "duration_minutes": round(route_data["duration"], 0),
        "autonomy": round(autonomy, 2),
        "fuel_needed": round(fuel_needed, 2),
        "can_complete_route": autonomy >= total_distance,
        "fuel_limit_point": fuel_limit_point,
        "route_points": locations,
        "route_geometry": route_geometry
    }

# ========== STATION CRUD ==========

@api_router.post("/stations", response_model=FuelStation)
async def create_station(station: FuelStationCreate):
    station_data = station.model_dump()
    if station_data.get('ratings') is None:
        station_data['ratings'] = StationRatings().model_dump()
    if station_data.get('parking') is None:
        station_data['parking'] = ParkingInfo().model_dump()
    
    station_obj = FuelStation(**station_data)
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
        if 'ratings' not in station:
            station['ratings'] = StationRatings().model_dump()
        if 'parking' not in station:
            station['parking'] = ParkingInfo().model_dump()
    return stations

@api_router.put("/stations/{station_id}", response_model=FuelStation)
async def update_station(station_id: str, update: FuelStationUpdate):
    update_data = {}
    for k, v in update.model_dump().items():
        if v is not None:
            if isinstance(v, dict):
                update_data[k] = v
            else:
                update_data[k] = v
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.fuel_stations.update_one({"id": station_id}, {"$set": update_data})
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

# ========== MULTI-STOP FUEL PLANNING ==========

def calculate_station_score(station: dict) -> float:
    """Calculate overall score for a station (higher is better)"""
    ratings = station.get('ratings', {})
    price_rating = ratings.get('price_rating', 0)
    service_rating = ratings.get('service_rating', 0)
    parking_rating = ratings.get('parking_rating', 0)
    security_rating = ratings.get('security_rating', 0)
    
    rating_score = (price_rating * 2 + service_rating + parking_rating + security_rating) / 5
    price = station.get('diesel_price', 6.0)
    price_score = max(0, (7.0 - price))
    
    return (rating_score * 0.4) + (price_score * 0.6)

def find_stations_in_range(stations: List[dict], route_geometry: List[List[float]], 
                           min_distance: float, max_distance: float, 
                           total_distance: float, max_deviation: float = 100) -> List[dict]:
    """Find stations within a distance range along the route"""
    
    # Sample points along the route at regular intervals
    step = max(1, len(route_geometry) // 100)  # Sample ~100 points
    
    # Calculate cumulative distances for sampled points
    points_with_distance = []
    cumulative = 0
    prev_point = route_geometry[0] if route_geometry else None
    
    for i, point in enumerate(route_geometry):
        if i > 0:
            cumulative += calculate_distance(prev_point[0], prev_point[1], point[0], point[1])
        if i % step == 0 or i == len(route_geometry) - 1:
            points_with_distance.append((point, cumulative))
        prev_point = point
    
    # Find stations near route points in the range
    found_stations = []
    seen_ids = set()
    
    for station in stations:
        if not station.get('is_active', True):
            continue
        
        station_lat = station['latitude']
        station_lng = station['longitude']
        
        # Check distance to each sampled route point
        for point, dist_from_start in points_with_distance:
            if min_distance <= dist_from_start <= max_distance:
                dist_to_station = calculate_distance(point[0], point[1], station_lat, station_lng)
                
                if dist_to_station <= max_deviation:
                    station_id = station.get('id', f"{station_lat}_{station_lng}")
                    if station_id not in seen_ids:
                        seen_ids.add(station_id)
                        station_copy = dict(station)
                        station_copy['distance_from_start'] = dist_from_start
                        station_copy['distance_to_route'] = dist_to_station
                        station_copy['score'] = calculate_station_score(station)
                        found_stations.append(station_copy)
                    break
    
    # Sort by score (highest first), then by price
    found_stations.sort(key=lambda s: (-s['score'], s.get('diesel_price', 99)))
    
    return found_stations

@api_router.post("/plan-fuel-stops")
async def plan_fuel_stops(request: MultiStopPlanRequest):
    """Plan multiple fuel stops for long routes"""
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    
    route_distance = request.route_distance
    vehicle = request.vehicle
    stations = request.stations
    route_geometry = request.route_geometry
    
    logger.info(f"Planning fuel stops for {route_distance}km route with {len(stations)} stations")
    
    # Calculate autonomies
    max_autonomy = vehicle.tank_capacity * vehicle.consumption_rate
    current_fuel = vehicle.current_liters
    current_autonomy = current_fuel * vehicle.consumption_rate
    
    fuel_stops = []
    gaps = []
    current_distance = 0
    safety_margin = 50
    
    iteration = 0
    max_iterations = 20
    
    while current_distance < route_distance and iteration < max_iterations:
        iteration += 1
        effective_autonomy = (current_fuel * vehicle.consumption_rate) - safety_margin
        next_limit = current_distance + effective_autonomy
        
        logger.info(f"Iteration {iteration}: at {current_distance}km, fuel {current_fuel}L, can reach {next_limit}km")
        
        if next_limit >= route_distance:
            logger.info("Can reach destination!")
            break
        
        # Search for stations in the reachable range
        search_start = current_distance + 50  # Don't stop immediately
        search_end = min(next_limit - 50, route_distance - 50)
        
        if search_end <= search_start:
            search_end = next_limit - 20
        
        available_stations = find_stations_in_range(
            stations, route_geometry, 
            search_start, search_end, 
            route_distance, max_deviation=100
        )
        
        logger.info(f"Found {len(available_stations)} stations between {search_start}km and {search_end}km")
        
        if not available_stations:
            # No station found - report gap and assume we find fuel somehow
            gaps.append({
                "start_km": int(search_start),
                "end_km": int(search_end),
                "suggestion": f"Cadastre um posto entre {int(search_start)}km e {int(search_end)}km da origem."
            })
            current_distance = search_end
            current_fuel = vehicle.tank_capacity * 0.8
            continue
        
        # Pick the best station (first in sorted list)
        best = available_stations[0]
        stop_distance = best['distance_from_start']
        
        # Calculate fuel state at this stop
        distance_traveled = stop_distance - current_distance
        fuel_used = distance_traveled / vehicle.consumption_rate
        fuel_at_arrival = max(0, current_fuel - fuel_used)
        
        # Check if there's a cheaper station further ahead
        lookahead_start = stop_distance + 50
        lookahead_end = stop_distance + max_autonomy - 100
        
        future_stations = find_stations_in_range(
            stations, route_geometry,
            lookahead_start, min(lookahead_end, route_distance),
            route_distance, max_deviation=100
        )
        
        cheaper_ahead = any(s.get('diesel_price', 99) < best.get('diesel_price', 0) * 0.95 for s in future_stations)
        
        if cheaper_ahead and future_stations:
            # Partial fill - just enough to reach cheaper station
            next_stop_dist = future_stations[0]['distance_from_start']
            km_to_next = next_stop_dist - stop_distance
            fuel_needed = (km_to_next + safety_margin) / vehicle.consumption_rate
            fuel_to_add = max(50, min(fuel_needed - fuel_at_arrival, vehicle.tank_capacity - fuel_at_arrival))
            reason = f"Parcial - posto mais barato em {int(km_to_next)}km"
        else:
            # Fill up
            fuel_to_add = vehicle.tank_capacity - fuel_at_arrival
            reason = "Completar tanque - melhor opção na região"
        
        fuel_stops.append({
            "station": {
                "id": best.get('id'),
                "name": best.get('name'),
                "city": best.get('city'),
                "diesel_price": best.get('diesel_price'),
                "latitude": best.get('latitude'),
                "longitude": best.get('longitude'),
                "ratings": best.get('ratings', {}),
                "score": best.get('score', 0)
            },
            "distance_from_start": round(stop_distance, 0),
            "fuel_at_arrival": round(fuel_at_arrival, 1),
            "fuel_to_add": round(fuel_to_add, 1),
            "fuel_after_stop": round(fuel_at_arrival + fuel_to_add, 1),
            "cost": round(fuel_to_add * best.get('diesel_price', 5.5), 2),
            "reason": reason
        })
        
        # Update state
        current_distance = stop_distance
        current_fuel = fuel_at_arrival + fuel_to_add
        
        logger.info(f"Added stop at {best.get('name')} ({stop_distance}km), +{fuel_to_add}L")
    
    # Calculate totals
    total_fuel = sum(stop['fuel_to_add'] for stop in fuel_stops)
    total_cost = sum(stop['cost'] for stop in fuel_stops)
    
    logger.info(f"Plan complete: {len(fuel_stops)} stops, {total_fuel}L, R${total_cost}")
    
    # Generate AI summary
    ai_summary = None
    if api_key and fuel_stops:
        try:
            chat = LlmChat(
                api_key=api_key,
                session_id=f"fuel-plan-{uuid.uuid4()}",
                system_message="Você é um assistente de logística. Seja conciso."
            ).with_model("openai", "gpt-5.2")
            
            stops_text = "\n".join([
                f"- {stop['station']['name']} ({stop['station']['city']}): +{stop['fuel_to_add']:.0f}L = R${stop['cost']:.2f}"
                for stop in fuel_stops
            ])
            
            prompt = f"""Resuma o plano de abastecimento ({route_distance:.0f}km):
{stops_text}
Total: {total_fuel:.0f}L / R${total_cost:.2f}
(Máx 2 frases)"""
            
            ai_summary = await chat.send_message(UserMessage(text=prompt))
        except Exception as e:
            logger.error(f"AI summary error: {e}")
    
    return {
        "stops": fuel_stops,
        "total_stops": len(fuel_stops),
        "total_fuel_liters": round(total_fuel, 1),
        "total_cost": round(total_cost, 2),
        "gaps": gaps,
        "has_gaps": len(gaps) > 0,
        "ai_summary": ai_summary
    }

# ========== SERVICE ORDER ==========

@api_router.post("/generate-service-order")
async def generate_service_order(request: ServiceOrderRequest):
    """Generate service order for WhatsApp"""
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    
    coords = request.coordinates.replace(" ", "")
    maps_link = f"https://www.google.com/maps?q={coords}"
    
    if api_key:
        try:
            chat = LlmChat(
                api_key=api_key,
                session_id=f"service-order-{uuid.uuid4()}",
                system_message="Você é um assistente de frotas. Gere mensagens curtas e profissionais."
            ).with_model("openai", "gpt-5.2")
            
            fuel_info = f"\nAbastecer: {request.fuel_amount:.1f}L" if request.fuel_amount else ""
            
            prompt = f"""Gere uma mensagem curta para WhatsApp:
Posto: {request.station_name}
Local: {request.station_location}
Link: {maps_link}{fuel_info}

Máximo 4 linhas, use até 3 emojis."""
            
            message = await chat.send_message(UserMessage(text=prompt))
            return {"message": message, "maps_link": maps_link, "station": request.station_name}
        except Exception as e:
            logger.error(f"Service order error: {e}")
    
    message = f"🚛 ABASTECIMENTO\n📍 {request.station_name}\n📌 {request.station_location}\n🗺️ {maps_link}"
    if request.fuel_amount:
        message += f"\n⛽ {request.fuel_amount:.0f}L"
    
    return {"message": message, "maps_link": maps_link, "station": request.station_name}

# ========== SEED DATA ==========

@api_router.post("/seed-stations")
async def seed_stations():
    """Populate with sample stations"""
    sample_stations = [
        {
            "name": "Posto Ipiranga - Zona Sul",
            "latitude": -30.1087, "longitude": -51.2217,
            "diesel_price": 5.89, "is_active": True,
            "city": "Porto Alegre", "address": "Av. Ipiranga, 6681",
            "ratings": {"price_rating": 3, "service_rating": 4, "parking_rating": 5, "security_rating": 4},
            "parking": {"has_parking": True, "parking_type": "free", "min_fuel_liters": None}
        },
        {
            "name": "Auto Posto Curitiba Centro",
            "latitude": -25.4290, "longitude": -49.2671,
            "diesel_price": 5.75, "is_active": True,
            "city": "Curitiba", "address": "Rua XV de Novembro, 1234",
            "ratings": {"price_rating": 4, "service_rating": 3, "parking_rating": 4, "security_rating": 4},
            "parking": {"has_parking": True, "parking_type": "with_min_fuel", "min_fuel_liters": 200}
        },
        {
            "name": "Posto BR Registro",
            "latitude": -24.4872, "longitude": -47.8439,
            "diesel_price": 5.45, "is_active": True,
            "city": "Registro", "address": "BR-116, km 432",
            "ratings": {"price_rating": 5, "service_rating": 4, "parking_rating": 5, "security_rating": 5},
            "parking": {"has_parking": True, "parking_type": "free", "min_fuel_liters": None}
        },
        {
            "name": "Posto Shell Campinas",
            "latitude": -22.9099, "longitude": -47.0626,
            "diesel_price": 5.78, "is_active": True,
            "city": "Campinas", "address": "Rod. Anhanguera, km 98",
            "ratings": {"price_rating": 3, "service_rating": 5, "parking_rating": 4, "security_rating": 5},
            "parking": {"has_parking": True, "parking_type": "paid", "min_fuel_liters": None}
        },
        {
            "name": "Posto Texaco São Paulo",
            "latitude": -23.5505, "longitude": -46.6333,
            "diesel_price": 5.95, "is_active": True,
            "city": "São Paulo", "address": "Av. Paulista, 1000",
            "ratings": {"price_rating": 2, "service_rating": 5, "parking_rating": 2, "security_rating": 5},
            "parking": {"has_parking": True, "parking_type": "paid", "min_fuel_liters": None}
        },
        {
            "name": "Posto Petrobras Feira de Santana",
            "latitude": -12.2664, "longitude": -38.9663,
            "diesel_price": 5.55, "is_active": True,
            "city": "Feira de Santana", "address": "BR-324, km 512",
            "ratings": {"price_rating": 4, "service_rating": 4, "parking_rating": 5, "security_rating": 4},
            "parking": {"has_parking": True, "parking_type": "free", "min_fuel_liters": None}
        },
        {
            "name": "Auto Posto Salvador Norte",
            "latitude": -12.9714, "longitude": -38.5014,
            "diesel_price": 5.68, "is_active": True,
            "city": "Salvador", "address": "Av. Paralela, 3200",
            "ratings": {"price_rating": 3, "service_rating": 4, "parking_rating": 4, "security_rating": 4},
            "parking": {"has_parking": True, "parking_type": "with_min_fuel", "min_fuel_liters": 150}
        },
        {
            "name": "Posto Aracaju BR",
            "latitude": -10.9472, "longitude": -37.0731,
            "diesel_price": 5.62, "is_active": True,
            "city": "Aracaju", "address": "BR-101, km 89",
            "ratings": {"price_rating": 4, "service_rating": 3, "parking_rating": 5, "security_rating": 3},
            "parking": {"has_parking": True, "parking_type": "free", "min_fuel_liters": None}
        },
        {
            "name": "Posto Maceió Costa",
            "latitude": -9.6498, "longitude": -35.7089,
            "diesel_price": 5.72, "is_active": True,
            "city": "Maceió", "address": "AL-101, km 45",
            "ratings": {"price_rating": 3, "service_rating": 4, "parking_rating": 4, "security_rating": 4},
            "parking": {"has_parking": True, "parking_type": "paid", "min_fuel_liters": None}
        },
        {
            "name": "Posto Recife Sul",
            "latitude": -8.0576, "longitude": -34.8870,
            "diesel_price": 5.58, "is_active": True,
            "city": "Recife", "address": "BR-101 Sul, km 67",
            "ratings": {"price_rating": 4, "service_rating": 4, "parking_rating": 5, "security_rating": 4},
            "parking": {"has_parking": True, "parking_type": "free", "min_fuel_liters": None}
        },
    ]
    
    await db.fuel_stations.delete_many({})
    
    created = []
    for station_data in sample_stations:
        station_obj = FuelStation(**station_data)
        doc = station_obj.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.fuel_stations.insert_one(doc)
        created.append(station_obj)
    
    return {"message": f"Created {len(created)} stations", "stations": created}

# ========== HEALTH ==========

@api_router.get("/")
async def root():
    return {"message": "Fleet Fuel Management API v2", "status": "operational"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include router
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
