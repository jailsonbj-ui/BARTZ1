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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FuelStationCreate(BaseModel):
    name: str
    latitude: float
    longitude: float
    diesel_price: float
    is_active: bool = True

class FuelStationUpdate(BaseModel):
    name: Optional[str] = None
    diesel_price: Optional[float] = None
    is_active: Optional[bool] = None

class Vehicle(BaseModel):
    current_liters: float
    consumption_rate: float  # km per liter
    tank_capacity: float

class RoutePoint(BaseModel):
    name: str
    latitude: float
    longitude: float

class RouteRequest(BaseModel):
    origin: RoutePoint
    destination: RoutePoint
    waypoints: List[RoutePoint] = []
    vehicle: Vehicle

class RecommendationRequest(BaseModel):
    route_distance: float  # km
    vehicle: Vehicle
    stations: List[FuelStation]

class ServiceOrderRequest(BaseModel):
    station_name: str
    station_location: str
    coordinates: str
    fuel_amount: Optional[float] = None

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

# ========== ROUTE & AUTONOMY CALCULATION ==========

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

@api_router.post("/calculate-route")
async def calculate_route(request: RouteRequest):
    """Calculate route distance and autonomy"""
    points = [request.origin] + request.waypoints + [request.destination]
    
    total_distance = 0
    segments = []
    
    for i in range(len(points) - 1):
        distance = calculate_distance(
            points[i].latitude, points[i].longitude,
            points[i+1].latitude, points[i+1].longitude
        )
        total_distance += distance
        segments.append({
            "from": points[i].name,
            "to": points[i+1].name,
            "distance": round(distance, 2)
        })
    
    # Calculate autonomy
    autonomy = request.vehicle.current_liters * request.vehicle.consumption_rate
    fuel_needed = total_distance / request.vehicle.consumption_rate
    
    # Calculate where fuel will run out
    fuel_limit_distance = autonomy
    fuel_limit_point = None
    
    if autonomy < total_distance:
        cumulative_distance = 0
        for i in range(len(points) - 1):
            segment_distance = calculate_distance(
                points[i].latitude, points[i].longitude,
                points[i+1].latitude, points[i+1].longitude
            )
            if cumulative_distance + segment_distance >= autonomy:
                # Interpolate the exact point
                remaining = autonomy - cumulative_distance
                ratio = remaining / segment_distance
                fuel_limit_point = {
                    "latitude": points[i].latitude + ratio * (points[i+1].latitude - points[i].latitude),
                    "longitude": points[i].longitude + ratio * (points[i+1].longitude - points[i].longitude),
                    "distance_from_origin": round(autonomy, 2)
                }
                break
            cumulative_distance += segment_distance
    
    return {
        "total_distance": round(total_distance, 2),
        "segments": segments,
        "autonomy": round(autonomy, 2),
        "fuel_needed": round(fuel_needed, 2),
        "can_complete_route": autonomy >= total_distance,
        "fuel_limit_point": fuel_limit_point,
        "route_points": [{"name": p.name, "lat": p.latitude, "lng": p.longitude} for p in points]
    }

# ========== AI RECOMMENDATION ==========

@api_router.post("/recommend-station")
async def recommend_station(request: RecommendationRequest):
    """Use AI to recommend the best fuel station"""
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
        f"- {s.name}: R$ {s.diesel_price:.2f}/L (Coordenadas: {s.latitude}, {s.longitude})"
        for s in available_stations
    ])
    
    chat = LlmChat(
        api_key=api_key,
        session_id=f"recommendation-{uuid.uuid4()}",
        system_message="Você é um assistente especializado em logística de frotas. Responda de forma concisa e profissional em português."
    ).with_model("openai", "gpt-5.2")
    
    prompt = f"""Analise os postos de combustível disponíveis e recomende o melhor para abastecimento:

Autonomia atual do veículo: {autonomy:.1f} km
Distância total da rota: {request.route_distance:.1f} km
Capacidade do tanque: {request.vehicle.tank_capacity} litros
Combustível atual: {request.vehicle.current_liters} litros

Postos disponíveis:
{stations_info}

Recomende o posto com melhor custo-benefício considerando o preço do diesel. Responda em formato JSON com os campos:
- station_name: nome do posto recomendado
- reason: motivo da recomendação (máximo 2 frases)
- savings_tip: dica de economia (1 frase)"""

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
            "name": "Posto Ipiranga - Porto Alegre",
            "latitude": -30.0346,
            "longitude": -51.2177,
            "diesel_price": 5.89,
            "is_active": True
        },
        {
            "name": "Posto BR - Curitiba",
            "latitude": -25.4284,
            "longitude": -49.2733,
            "diesel_price": 5.75,
            "is_active": True
        },
        {
            "name": "Posto Shell - Registro",
            "latitude": -24.4872,
            "longitude": -47.8439,
            "diesel_price": 5.65,
            "is_active": True
        },
        {
            "name": "Posto Texaco - São Paulo",
            "latitude": -23.5505,
            "longitude": -46.6333,
            "diesel_price": 5.95,
            "is_active": True
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
