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
    marker_icon: str = "fuel"
    marker_color: str = "orange"
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
    marker_icon: Optional[str] = None
    marker_color: Optional[str] = None

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

# ========== GEOCODING (Google Maps) ==========

GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY')

async def google_places_autocomplete(query: str) -> List[dict]:
    """Fast city search using Google Places Autocomplete"""
    if not GOOGLE_MAPS_API_KEY:
        return []
    
    import urllib.request
    import urllib.parse
    import json as json_module
    import ssl
    
    try:
        params = urllib.parse.urlencode({
            "input": query,
            "types": "(cities)",
            "components": "country:br",
            "key": GOOGLE_MAPS_API_KEY,
            "language": "pt-BR"
        })
        url = f"https://maps.googleapis.com/maps/api/place/autocomplete/json?{params}"
        
        req = urllib.request.Request(url)
        ctx = ssl.create_default_context()
        
        with urllib.request.urlopen(req, timeout=10, context=ctx) as response:
            data = json_module.loads(response.read().decode())
        
        if data.get("status") != "OK":
            logger.warning(f"Google Places status: {data.get('status')} - {data.get('error_message', '')}")
            return []
        
        results = []
        for prediction in data.get("predictions", [])[:8]:
            place_id = prediction.get("place_id")
            description = prediction.get("description", "")
            
            # Get coordinates from place details
            detail_params = urllib.parse.urlencode({
                "place_id": place_id,
                "fields": "geometry,name,address_components",
                "key": GOOGLE_MAPS_API_KEY,
                "language": "pt-BR"
            })
            detail_url = f"https://maps.googleapis.com/maps/api/place/details/json?{detail_params}"
            
            detail_req = urllib.request.Request(detail_url)
            with urllib.request.urlopen(detail_req, timeout=10, context=ctx) as detail_response:
                detail_data = json_module.loads(detail_response.read().decode())
            
            if detail_data.get("status") == "OK":
                place = detail_data.get("result", {})
                location = place.get("geometry", {}).get("location", {})
                
                # Extract state
                state = ""
                for comp in place.get("address_components", []):
                    if "administrative_area_level_1" in comp.get("types", []):
                        state = comp.get("short_name", "")
                        break
                
                results.append({
                    "name": place.get("name", description.split(",")[0]),
                    "state": state,
                    "display_name": description,
                    "latitude": location.get("lat"),
                    "longitude": location.get("lng"),
                    "place_id": place_id
                })
        
        return results
    except Exception as e:
        logger.error(f"Google Places error: {e}")
    return []

async def google_geocode(query: str) -> Optional[GeocodingResult]:
    """Geocode using Google Geocoding API"""
    if not GOOGLE_MAPS_API_KEY:
        return None
    
    import urllib.request
    import urllib.parse
    import json as json_module
    import ssl
    
    try:
        params = urllib.parse.urlencode({
            "address": f"{query}, Brasil",
            "key": GOOGLE_MAPS_API_KEY,
            "language": "pt-BR",
            "region": "br"
        })
        url = f"https://maps.googleapis.com/maps/api/geocode/json?{params}"
        
        req = urllib.request.Request(url)
        ctx = ssl.create_default_context()
        
        with urllib.request.urlopen(req, timeout=10, context=ctx) as response:
            data = json_module.loads(response.read().decode())
        
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
        logger.error(f"Google Geocode error: {e}")
    return None

async def google_directions(origin: tuple, destination: tuple, waypoints: List[tuple] = None) -> dict:
    """Get route using Google Directions API"""
    if not GOOGLE_MAPS_API_KEY:
        return None
    
    import urllib.request
    import urllib.parse
    import json as json_module
    import ssl
    
    try:
        params = {
            "origin": f"{origin[0]},{origin[1]}",
            "destination": f"{destination[0]},{destination[1]}",
            "key": GOOGLE_MAPS_API_KEY,
            "mode": "driving",
            "language": "pt-BR",
            "region": "br"
        }
        
        if waypoints:
            wp_str = "|".join([f"{wp[0]},{wp[1]}" for wp in waypoints])
            params["waypoints"] = wp_str
        
        url = f"https://maps.googleapis.com/maps/api/directions/json?{urllib.parse.urlencode(params)}"
        
        req = urllib.request.Request(url)
        ctx = ssl.create_default_context()
        
        with urllib.request.urlopen(req, timeout=30, context=ctx) as response:
            data = json_module.loads(response.read().decode())
        
        if data.get("status") != "OK":
            logger.warning(f"Google Directions status: {data.get('status')} - {data.get('error_message', '')}")
            return None
        
        if not data.get("routes"):
            return None
        
        route = data["routes"][0]
        
        # Calculate totals
        total_distance = sum(leg["distance"]["value"] for leg in route["legs"]) / 1000
        total_duration = sum(leg["duration"]["value"] for leg in route["legs"]) / 60
        
        # Decode polyline
        geometry = []
        for leg in route["legs"]:
            for step in leg["steps"]:
                points = decode_google_polyline(step["polyline"]["points"])
                geometry.extend(points)
        
        return {
            "distance": total_distance,
            "duration": total_duration,
            "geometry": geometry,  # [lng, lat] format
            "overview_polyline": route.get("overview_polyline", {}).get("points", "")
        }
    except Exception as e:
        logger.error(f"Google Directions error: {e}")
    return None

def decode_google_polyline(polyline_str: str) -> List[List[float]]:
    """Decode Google polyline to coordinates [lng, lat]"""
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

@api_router.get("/search-cities")
async def search_cities(query: str):
    """Search cities using Google Places API"""
    if len(query) < 2:
        return []
    
    # Try Google Places first (fast)
    results = await google_places_autocomplete(query)
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
    """Geocode a location using Google"""
    
    # Try Google Geocoding
    result = await google_geocode(query)
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
    """Calculate route using Google Directions API"""
    locations = []
    
    origin = await geocode_location(request.origin_city)
    if not origin:
        raise HTTPException(status_code=400, detail=f"Cidade não encontrada: {request.origin_city}")
    locations.append({"name": origin.name, "lat": origin.latitude, "lng": origin.longitude})
    
    waypoint_coords = []
    for wp_city in request.waypoint_cities:
        if wp_city.strip():
            wp = await geocode_location(wp_city)
            if wp:
                locations.append({"name": wp.name, "lat": wp.latitude, "lng": wp.longitude})
                waypoint_coords.append((wp.latitude, wp.longitude))
    
    dest = await geocode_location(request.destination_city)
    if not dest:
        raise HTTPException(status_code=400, detail=f"Cidade não encontrada: {request.destination_city}")
    locations.append({"name": dest.name, "lat": dest.latitude, "lng": dest.longitude})
    
    # Try Google Directions first
    route_data = await google_directions(
        (origin.latitude, origin.longitude),
        (dest.latitude, dest.longitude),
        waypoint_coords if waypoint_coords else None
    )
    
    # Fallback to OSRM if Google fails
    if not route_data:
        coordinates = [(loc["lat"], loc["lng"]) for loc in locations]
        route_data = await get_route_from_osrm(coordinates)
    
    if not route_data:
        raise HTTPException(status_code=500, detail="Erro ao calcular rota. Tente novamente.")
    
    total_distance = route_data["distance"]
    autonomy = request.vehicle.current_liters * request.vehicle.consumption_rate
    fuel_needed = total_distance / request.vehicle.consumption_rate
    
    # Calculate fuel limit point
    fuel_limit_point = None
    if autonomy < total_distance and route_data.get("geometry"):
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
    
    # Convert geometry to [lat, lng] for frontend
    route_geometry = [[coord[1], coord[0]] for coord in route_data.get("geometry", [])]
    
    return {
        "total_distance": round(total_distance, 2),
        "duration_minutes": round(route_data.get("duration", 0), 0),
        "autonomy": round(autonomy, 2),
        "fuel_needed": round(fuel_needed, 2),
        "can_complete_route": autonomy >= total_distance,
        "fuel_limit_point": fuel_limit_point,
        "route_points": locations,
        "route_geometry": route_geometry,
        "overview_polyline": route_data.get("overview_polyline", "")
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
    """
    Plan multiple fuel stops for long routes - OPTIMIZED FOR TRUCKS
    
    Rules:
    1. Minimize number of stops (prefer large refuels)
    2. Minimum refuel: 100 liters (not worth stopping for less)
    3. Partial refuel only if cheaper station ahead (>5% savings)
    4. Arrive at destination with at least 20% tank capacity
    5. Prioritize lowest price per liter
    """
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    
    route_distance = request.route_distance
    vehicle = request.vehicle
    stations = [s for s in request.stations if s.get('is_active', True)]  # Only active stations
    route_geometry = request.route_geometry
    
    logger.info(f"Planning fuel stops for {route_distance}km route with {len(stations)} active stations")
    
    # Configuration for trucks
    MIN_REFUEL_LITERS = 100  # Minimum worth stopping for
    DESTINATION_RESERVE_PERCENT = 0.20  # 20% reserve at destination
    SAFETY_MARGIN_KM = 50  # Don't run on empty
    CHEAPER_THRESHOLD = 0.95  # 5% cheaper to justify partial fill
    
    # Calculate key values
    max_autonomy = vehicle.tank_capacity * vehicle.consumption_rate
    destination_reserve_liters = vehicle.tank_capacity * DESTINATION_RESERVE_PERCENT
    destination_reserve_km = destination_reserve_liters * vehicle.consumption_rate
    
    current_fuel = vehicle.current_liters
    current_distance = 0
    
    fuel_stops = []
    gaps = []
    
    iteration = 0
    max_iterations = 15  # Trucks shouldn't need more than 15 stops
    
    while current_distance < route_distance and iteration < max_iterations:
        iteration += 1
        
        # Calculate how far we can go
        effective_autonomy = (current_fuel * vehicle.consumption_rate) - SAFETY_MARGIN_KM
        max_reach = current_distance + effective_autonomy
        
        # Calculate fuel at destination if we go straight
        remaining_distance = route_distance - current_distance
        fuel_at_destination = current_fuel - (remaining_distance / vehicle.consumption_rate)
        
        logger.info(f"Iteration {iteration}: at {current_distance:.0f}km, fuel {current_fuel:.0f}L, can reach {max_reach:.0f}km, dest fuel would be {fuel_at_destination:.0f}L")
        
        # Can we reach destination with 20% reserve?
        if fuel_at_destination >= destination_reserve_liters:
            logger.info(f"Can reach destination with {fuel_at_destination:.0f}L reserve!")
            break
        
        # Need to stop - find the BEST station (lowest price) within our range
        # Search from current position to max reach, but leave margin
        search_start = current_distance + 100  # Don't stop immediately after starting
        search_end = max_reach - SAFETY_MARGIN_KM
        
        if search_end <= search_start:
            search_end = max_reach - 20
        
        # Get all stations in range
        available_stations = find_stations_in_range(
            stations, route_geometry,
            search_start, search_end,
            route_distance, max_deviation=50
        )
        
        logger.info(f"Found {len(available_stations)} stations between {search_start:.0f}km and {search_end:.0f}km")
        
        if not available_stations:
            # No station found - report gap
            gaps.append({
                "start_km": int(search_start),
                "end_km": int(search_end),
                "suggestion": f"Cadastre um posto entre {int(search_start)}km e {int(search_end)}km da origem."
            })
            # Assume we somehow get fuel and continue
            current_distance = search_end
            current_fuel = vehicle.tank_capacity * 0.7
            continue
        
        # Sort by price (lowest first), then by score
        available_stations.sort(key=lambda s: (s.get('diesel_price', 99), -s.get('score', 0)))
        
        # Find the cheapest station
        best_station = available_stations[0]
        best_price = best_station.get('diesel_price', 99)
        stop_distance = best_station['distance_from_start']
        
        # Calculate fuel state at this stop
        distance_traveled = stop_distance - current_distance
        fuel_used = distance_traveled / vehicle.consumption_rate
        fuel_at_arrival = max(0, current_fuel - fuel_used)
        
        # Look ahead: is there a SIGNIFICANTLY cheaper station further?
        # We can reach it if we fill up here
        lookahead_start = stop_distance + 100
        lookahead_end = stop_distance + max_autonomy - 100
        
        future_stations = find_stations_in_range(
            stations, route_geometry,
            lookahead_start, min(lookahead_end, route_distance - 50),
            route_distance, max_deviation=50
        )
        
        # Find if there's a much cheaper station ahead
        cheaper_station = None
        for fs in future_stations:
            if fs.get('diesel_price', 99) < best_price * CHEAPER_THRESHOLD:
                cheaper_station = fs
                break
        
        # Decide refuel strategy
        if cheaper_station:
            # PARTIAL FILL: Just enough to reach the cheaper station + safety
            next_stop_dist = cheaper_station['distance_from_start']
            km_to_cheaper = next_stop_dist - stop_distance
            fuel_needed_to_reach = (km_to_cheaper + SAFETY_MARGIN_KM) / vehicle.consumption_rate
            
            fuel_to_add = max(MIN_REFUEL_LITERS, fuel_needed_to_reach - fuel_at_arrival)
            fuel_to_add = min(fuel_to_add, vehicle.tank_capacity - fuel_at_arrival)
            
            price_diff = ((best_price - cheaper_station.get('diesel_price', 99)) / best_price) * 100
            reason = f"Parcial ({fuel_to_add:.0f}L) - posto {price_diff:.1f}% mais barato em {km_to_cheaper:.0f}km"
        else:
            # FULL FILL: This is the best option, fill up completely
            fuel_to_add = vehicle.tank_capacity - fuel_at_arrival
            
            # But check if we even need that much to finish the route with 20% reserve
            remaining_after_stop = route_distance - stop_distance
            fuel_needed_to_finish = (remaining_after_stop / vehicle.consumption_rate) + destination_reserve_liters
            
            if fuel_at_arrival + fuel_to_add > fuel_needed_to_finish + MIN_REFUEL_LITERS:
                # We would have too much fuel - optimize
                optimal_fuel = fuel_needed_to_finish - fuel_at_arrival
                if optimal_fuel >= MIN_REFUEL_LITERS:
                    fuel_to_add = optimal_fuel
                    reason = f"Otimizado para chegar com {DESTINATION_RESERVE_PERCENT*100:.0f}% reserva"
                else:
                    # Not worth stopping for less than minimum
                    # Check if we can skip this stop entirely
                    can_reach_next = False
                    for ns in future_stations:
                        ns_dist = ns['distance_from_start']
                        fuel_at_ns = fuel_at_arrival - ((ns_dist - stop_distance) / vehicle.consumption_rate)
                        if fuel_at_ns > MIN_REFUEL_LITERS / vehicle.consumption_rate:
                            can_reach_next = True
                            break
                    
                    if can_reach_next and fuel_at_arrival * vehicle.consumption_rate > 150:
                        # Skip this stop, continue to next
                        logger.info(f"Skipping {best_station.get('name')} - not worth stopping")
                        current_distance = stop_distance
                        current_fuel = fuel_at_arrival
                        continue
                    
                    fuel_to_add = vehicle.tank_capacity - fuel_at_arrival
                    reason = "Completar tanque - melhor preço da região"
            else:
                reason = "Completar tanque - melhor preço da região"
        
        # Ensure minimum refuel
        if fuel_to_add < MIN_REFUEL_LITERS:
            # Check if we really need to stop
            fuel_to_dest = fuel_at_arrival - ((route_distance - stop_distance) / vehicle.consumption_rate)
            if fuel_to_dest >= destination_reserve_liters:
                # Can skip this stop
                logger.info("Skipping stop - can reach destination with reserve")
                current_distance = stop_distance
                current_fuel = fuel_at_arrival
                continue
            fuel_to_add = MIN_REFUEL_LITERS
        
        # Add the stop
        fuel_stops.append({
            "station": {
                "id": best_station.get('id'),
                "name": best_station.get('name'),
                "city": best_station.get('city'),
                "diesel_price": best_station.get('diesel_price'),
                "latitude": best_station.get('latitude'),
                "longitude": best_station.get('longitude'),
                "ratings": best_station.get('ratings', {}),
                "score": best_station.get('score', 0)
            },
            "distance_from_start": round(stop_distance, 0),
            "fuel_at_arrival": round(fuel_at_arrival, 1),
            "fuel_to_add": round(fuel_to_add, 1),
            "fuel_after_stop": round(fuel_at_arrival + fuel_to_add, 1),
            "cost": round(fuel_to_add * best_station.get('diesel_price', 5.5), 2),
            "reason": reason
        })
        
        # Update state
        current_distance = stop_distance
        current_fuel = fuel_at_arrival + fuel_to_add
        
        logger.info(f"Added stop at {best_station.get('name')} ({stop_distance:.0f}km), +{fuel_to_add:.0f}L @ R${best_station.get('diesel_price')}/L")
    
    # ======= CONSOLIDATE NEARBY STOPS (200km rule) =======
    # If two stops are within 200km, keep only the cheaper one and fill more there
    CONSOLIDATION_DISTANCE = 200  # km
    
    if len(fuel_stops) >= 2:
        consolidated_stops = []
        i = 0
        while i < len(fuel_stops):
            current_stop = fuel_stops[i]
            
            # Check if there's another stop within 200km
            if i + 1 < len(fuel_stops):
                next_stop = fuel_stops[i + 1]
                distance_between = next_stop['distance_from_start'] - current_stop['distance_from_start']
                
                if distance_between <= CONSOLIDATION_DISTANCE:
                    # Choose the cheaper station and consolidate fuel
                    total_fuel_both = current_stop['fuel_to_add'] + next_stop['fuel_to_add']
                    
                    current_price = current_stop['station']['diesel_price']
                    next_price = next_stop['station']['diesel_price']
                    
                    if current_price <= next_price:
                        # Keep current stop, fill more
                        winner = dict(current_stop)
                        winner['fuel_to_add'] = min(total_fuel_both, vehicle.tank_capacity - 50)  # Leave some margin
                        winner['cost'] = winner['fuel_to_add'] * winner['station']['diesel_price']
                        winner['reason'] = f"Completar tanque - melhor preço ({distance_between:.0f}km mais barato que {next_stop['station']['name']})"
                        consolidated_stops.append(winner)
                        logger.info(f"Consolidated: keeping {current_stop['station']['name']} (R${current_price:.2f}) over {next_stop['station']['name']} (R${next_price:.2f})")
                    else:
                        # Keep next stop, fill more there
                        winner = dict(next_stop)
                        winner['fuel_to_add'] = min(total_fuel_both, vehicle.tank_capacity - 50)
                        winner['cost'] = winner['fuel_to_add'] * winner['station']['diesel_price']
                        winner['reason'] = f"Completar tanque - melhor preço ({distance_between:.0f}km mais barato que {current_stop['station']['name']})"
                        consolidated_stops.append(winner)
                        logger.info(f"Consolidated: keeping {next_stop['station']['name']} (R${next_price:.2f}) over {current_stop['station']['name']} (R${current_price:.2f})")
                    
                    i += 2  # Skip both stops
                    continue
            
            # No consolidation needed
            consolidated_stops.append(current_stop)
            i += 1
        
        if len(consolidated_stops) < len(fuel_stops):
            logger.info(f"Consolidation reduced stops from {len(fuel_stops)} to {len(consolidated_stops)}")
            fuel_stops = consolidated_stops
    
    # Calculate final fuel at destination
    final_distance = route_distance - current_distance
    final_fuel = current_fuel - (final_distance / vehicle.consumption_rate)
    
    # Calculate totals
    total_fuel = sum(stop['fuel_to_add'] for stop in fuel_stops)
    total_cost = sum(stop['cost'] for stop in fuel_stops)
    avg_price = total_cost / total_fuel if total_fuel > 0 else 0
    
    logger.info(f"Plan complete: {len(fuel_stops)} stops, {total_fuel:.0f}L, R${total_cost:.2f}, arrives with {final_fuel:.0f}L")
    
    # Generate AI analysis
    ai_summary = None
    if api_key and fuel_stops:
        try:
            chat = LlmChat(
                api_key=api_key,
                session_id=f"fuel-plan-{uuid.uuid4()}",
                system_message="Você é um especialista em logística de frotas de caminhões. Analise planos de abastecimento de forma concisa e profissional."
            ).with_model("openai", "gpt-5.2")
            
            stops_text = "\n".join([
                f"- Km {stop['distance_from_start']:.0f}: {stop['station']['name']} ({stop['station']['city']}) - +{stop['fuel_to_add']:.0f}L @ R${stop['station']['diesel_price']:.2f} = R${stop['cost']:.2f}"
                for stop in fuel_stops
            ])
            
            prompt = f"""Analise este plano de abastecimento para carreta:

ROTA: {route_distance:.0f}km
TANQUE: {vehicle.tank_capacity}L | CONSUMO: {vehicle.consumption_rate}km/L
COMBUSTÍVEL INICIAL: {vehicle.current_liters}L

PARADAS PLANEJADAS:
{stops_text}

TOTAIS:
- {len(fuel_stops)} paradas
- {total_fuel:.0f}L total
- R$ {total_cost:.2f} custo total  
- R$ {avg_price:.2f}/L preço médio
- Chegada no destino com {final_fuel:.0f}L ({(final_fuel/vehicle.tank_capacity)*100:.0f}% do tanque)

Dê sua avaliação em 2-3 frases: o plano está otimizado? Alguma sugestão?"""
            
            ai_summary = await chat.send_message(UserMessage(text=prompt))
        except Exception as e:
            logger.error(f"AI summary error: {e}")
    
    return {
        "stops": fuel_stops,
        "total_stops": len(fuel_stops),
        "total_fuel_liters": round(total_fuel, 1),
        "total_cost": round(total_cost, 2),
        "avg_price_per_liter": round(avg_price, 2),
        "final_fuel_liters": round(final_fuel, 1),
        "final_fuel_percent": round((final_fuel / vehicle.tank_capacity) * 100, 0),
        "gaps": gaps,
        "has_gaps": len(gaps) > 0,
        "ai_summary": ai_summary
    }



# ========== AI ROUTE ADVISOR ==========

class AIAdvisorRequest(BaseModel):
    route_distance: float
    origin: str
    destination: str
    vehicle: Vehicle
    fuel_plan: Optional[dict] = None
    question: Optional[str] = None

@api_router.post("/ai-advisor")
async def ai_route_advisor(request: AIAdvisorRequest):
    """Get AI advice for route planning and fuel optimization"""
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    
    if not api_key:
        return {"advice": "IA não disponível. Configure a chave EMERGENT_LLM_KEY."}
    
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"advisor-{uuid.uuid4()}",
            system_message="""Você é um especialista em logística de frotas de caminhões no Brasil.
Seu papel é aconselhar motoristas e gestores sobre:
- Melhor estratégia de abastecimento
- Otimização de custos
- Segurança na estrada
- Planejamento de paradas

Seja direto, prático e use linguagem simples. Sempre considere:
1. Custo total da viagem
2. Número de paradas (menos é melhor para carretas)
3. Segurança (nunca ficar com tanque vazio)
4. Chegar no destino com reserva de combustível"""
        ).with_model("openai", "gpt-5.2")
        
        # Build context
        autonomy = request.vehicle.tank_capacity * request.vehicle.consumption_rate
        current_autonomy = request.vehicle.current_liters * request.vehicle.consumption_rate
        
        context = f"""VIAGEM: {request.origin} → {request.destination}
DISTÂNCIA: {request.route_distance:.0f} km

VEÍCULO:
- Tanque: {request.vehicle.tank_capacity}L
- Consumo: {request.vehicle.consumption_rate} km/L
- Autonomia máxima: {autonomy:.0f} km
- Combustível atual: {request.vehicle.current_liters}L ({current_autonomy:.0f} km)"""
        
        if request.fuel_plan and request.fuel_plan.get('stops'):
            stops = request.fuel_plan['stops']
            stops_text = "\n".join([
                f"  {i+1}. Km {s.get('distance_from_start', 0):.0f}: {s.get('station', {}).get('name', 'Posto')} - +{s.get('fuel_to_add', 0):.0f}L @ R${s.get('station', {}).get('diesel_price', 5.5):.2f}"
                for i, s in enumerate(stops)
            ])
            context += f"""

PLANO ATUAL ({len(stops)} paradas):
{stops_text}

TOTAIS:
- Litros: {request.fuel_plan.get('total_fuel_liters', 0):.0f}L
- Custo: R$ {request.fuel_plan.get('total_cost', 0):.2f}
- Preço médio: R$ {request.fuel_plan.get('avg_price_per_liter', 0):.2f}/L
- Chegada com: {request.fuel_plan.get('final_fuel_percent', 0):.0f}% do tanque"""
        
        question = request.question or "Analise esta rota e me dê sua recomendação para otimizar o abastecimento."
        
        prompt = f"""{context}

PERGUNTA DO USUÁRIO:
{question}

Responda de forma clara e objetiva (máximo 4-5 frases)."""
        
        advice = await chat.send_message(UserMessage(text=prompt))
        
        return {
            "advice": advice,
            "route_summary": {
                "distance": request.route_distance,
                "origin": request.origin,
                "destination": request.destination,
                "autonomy": autonomy,
                "current_range": current_autonomy
            }
        }
    except Exception as e:
        logger.error(f"AI Advisor error: {e}")
        return {"advice": f"Erro ao consultar IA: {str(e)}"}


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


# ========== FULL ORDER GENERATION ==========

class FullOrderRequest(BaseModel):
    origin: str
    destination: str
    route_distance: float
    stops: list
    total_fuel: float
    total_cost: float

@api_router.post("/generate-full-order")
async def generate_full_order(request: FullOrderRequest):
    """Generate complete fueling order for all stops"""
    
    ordinals = ["1ª", "2ª", "3ª", "4ª", "5ª", "6ª", "7ª", "8ª", "9ª", "10ª", "11ª", "12ª"]
    
    lines = [
        f"🚛 *ORDEM DE ABASTECIMENTO*",
        f"📍 Rota: {request.origin} → {request.destination}",
        f"📏 Distância: {request.route_distance:.0f} km",
        f"",
        f"*PARADAS:*",
    ]
    
    for i, stop in enumerate(request.stops):
        station = stop.get('station', {})
        ordinal = ordinals[i] if i < len(ordinals) else f"{i+1}ª"
        is_complete = stop.get('isComplete', False)
        
        # Get coordinates for maps link
        lat = station.get('latitude', 0)
        lng = station.get('longitude', 0)
        maps_link = f"https://maps.google.com/?q={lat},{lng}"
        
        # Determine fuel instruction
        if is_complete:
            fuel_instruction = "COMPLETAR"
        else:
            fuel_instruction = f"{stop.get('fuel_to_add', 0):.0f}L"
        
        lines.append(f"")
        lines.append(f"*{ordinal} abastecida*")
        lines.append(f"⛽ Posto: {station.get('name', 'N/A')}")
        lines.append(f"📌 Local: {station.get('city', 'N/A')}")
        lines.append(f"🛣️ Km {stop.get('distance_from_start', 0):.0f}")
        lines.append(f"💧 {fuel_instruction}")
        lines.append(f"🗺️ {maps_link}")
    
    lines.append(f"")
    lines.append(f"─────────────────")
    lines.append(f"*RESUMO:*")
    lines.append(f"⛽ Total estimado: {request.total_fuel:.0f}L")
    
    message = "\n".join(lines)
    
    return {
        "message": message,
        "stops_count": len(request.stops),
        "origin": request.origin,
        "destination": request.destination
    }


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
