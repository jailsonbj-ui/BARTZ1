"""
Fleet Management System API Tests
Tests for: stations CRUD, city search, route calculation, fuel planning, service orders
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndBasics:
    """Basic health and connectivity tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200


class TestStationsCRUD:
    """Station CRUD operations tests"""
    
    def test_get_stations_list(self):
        """Test GET /api/stations returns list"""
        response = requests.get(f"{BASE_URL}/api/stations")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have seeded stations
        assert len(data) > 0
    
    def test_create_station(self):
        """Test POST /api/stations creates new station"""
        station_data = {
            "name": "TEST_Posto Teste Automatizado",
            "latitude": -25.5,
            "longitude": -49.5,
            "diesel_price": 5.99,
            "is_active": True,
            "city": "Test City",
            "ratings": {
                "price_rating": 4,
                "service_rating": 3,
                "parking_rating": 5,
                "security_rating": 4
            },
            "parking": {
                "has_parking": True,
                "parking_type": "free",
                "min_fuel_liters": None
            }
        }
        response = requests.post(f"{BASE_URL}/api/stations", json=station_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == station_data["name"]
        assert data["diesel_price"] == station_data["diesel_price"]
        assert "id" in data
        assert data["ratings"]["price_rating"] == 4
        
        # Store ID for cleanup
        TestStationsCRUD.created_station_id = data["id"]
    
    def test_update_station(self):
        """Test PUT /api/stations/{id} updates station"""
        station_id = getattr(TestStationsCRUD, 'created_station_id', None)
        if not station_id:
            pytest.skip("No station created to update")
        
        update_data = {
            "name": "TEST_Posto Atualizado",
            "diesel_price": 6.25,
            "ratings": {
                "price_rating": 5,
                "service_rating": 5,
                "parking_rating": 5,
                "security_rating": 5
            }
        }
        response = requests.put(f"{BASE_URL}/api/stations/{station_id}", json=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "TEST_Posto Atualizado"
        assert data["diesel_price"] == 6.25
        assert data["ratings"]["price_rating"] == 5
    
    def test_delete_station(self):
        """Test DELETE /api/stations/{id} removes station"""
        station_id = getattr(TestStationsCRUD, 'created_station_id', None)
        if not station_id:
            pytest.skip("No station created to delete")
        
        response = requests.delete(f"{BASE_URL}/api/stations/{station_id}")
        assert response.status_code == 200
        
        # Verify deletion
        stations = requests.get(f"{BASE_URL}/api/stations").json()
        station_ids = [s["id"] for s in stations]
        assert station_id not in station_ids


class TestCitySearch:
    """City search autocomplete tests"""
    
    def test_search_cities_porto(self):
        """Test city search for Porto returns Porto Alegre"""
        response = requests.get(f"{BASE_URL}/api/search-cities", params={"query": "Porto"})
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Should find Porto Alegre
        city_names = [c.get("name", "").lower() for c in data]
        assert any("porto" in name for name in city_names)
    
    def test_search_cities_sao_paulo(self):
        """Test city search for São Paulo"""
        response = requests.get(f"{BASE_URL}/api/search-cities", params={"query": "São Paulo"})
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
    
    def test_search_cities_recife(self):
        """Test city search for Recife"""
        response = requests.get(f"{BASE_URL}/api/search-cities", params={"query": "Recife"})
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Should find Recife
        city_names = [c.get("name", "").lower() for c in data]
        assert any("recife" in name for name in city_names)
    
    def test_search_cities_short_query(self):
        """Test city search with short query returns empty"""
        response = requests.get(f"{BASE_URL}/api/search-cities", params={"query": "P"})
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        # Should return empty for single character
        assert len(data) == 0


class TestRouteCalculation:
    """Route calculation tests"""
    
    def test_route_porto_alegre_to_sao_paulo(self):
        """Test route calculation Porto Alegre -> São Paulo (~1100km)"""
        route_data = {
            "origin_city": "Porto Alegre",
            "destination_city": "São Paulo",
            "waypoint_cities": [],
            "vehicle": {
                "current_liters": 200,
                "consumption_rate": 2.5,
                "tank_capacity": 500
            }
        }
        response = requests.post(f"{BASE_URL}/api/calculate-route", json=route_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "total_distance" in data
        assert "autonomy" in data
        assert "route_geometry" in data
        
        # Distance should be approximately 1100km (road distance)
        distance = data["total_distance"]
        assert 900 < distance < 1400, f"Expected ~1100km, got {distance}km"
        
        # Autonomy should be 200 * 2.5 = 500km
        assert data["autonomy"] == 500
    
    def test_route_porto_alegre_to_recife(self):
        """Test route calculation Porto Alegre -> Recife (~3800-4000km)"""
        route_data = {
            "origin_city": "Porto Alegre",
            "destination_city": "Recife",
            "waypoint_cities": [],
            "vehicle": {
                "current_liters": 200,
                "consumption_rate": 2.5,
                "tank_capacity": 500
            }
        }
        response = requests.post(f"{BASE_URL}/api/calculate-route", json=route_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "total_distance" in data
        
        # Distance should be approximately 3800-4000km
        distance = data["total_distance"]
        assert 3500 < distance < 4500, f"Expected ~3800-4000km, got {distance}km"
        
        # Should not be able to complete route with 500km autonomy
        assert data["can_complete_route"] == False
    
    def test_route_with_waypoints(self):
        """Test route calculation with waypoints"""
        route_data = {
            "origin_city": "Porto Alegre",
            "destination_city": "São Paulo",
            "waypoint_cities": ["Curitiba"],
            "vehicle": {
                "current_liters": 200,
                "consumption_rate": 2.5,
                "tank_capacity": 500
            }
        }
        response = requests.post(f"{BASE_URL}/api/calculate-route", json=route_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "total_distance" in data
        assert "route_points" in data
        
        # Should have 3 points: origin, waypoint, destination
        assert len(data["route_points"]) == 3
    
    def test_route_invalid_city(self):
        """Test route calculation with invalid city returns error"""
        route_data = {
            "origin_city": "CidadeInexistente123",
            "destination_city": "São Paulo",
            "waypoint_cities": [],
            "vehicle": {
                "current_liters": 200,
                "consumption_rate": 2.5,
                "tank_capacity": 500
            }
        }
        response = requests.post(f"{BASE_URL}/api/calculate-route", json=route_data)
        assert response.status_code == 400


class TestFuelPlanning:
    """Multi-stop fuel planning tests"""
    
    def test_plan_fuel_stops(self):
        """Test fuel stop planning for long route"""
        # First get a route
        route_data = {
            "origin_city": "Porto Alegre",
            "destination_city": "Recife",
            "waypoint_cities": [],
            "vehicle": {
                "current_liters": 200,
                "consumption_rate": 2.5,
                "tank_capacity": 500
            }
        }
        route_response = requests.post(f"{BASE_URL}/api/calculate-route", json=route_data)
        assert route_response.status_code == 200
        route = route_response.json()
        
        # Get stations
        stations_response = requests.get(f"{BASE_URL}/api/stations")
        stations = stations_response.json()
        
        # Plan fuel stops
        plan_data = {
            "route_distance": route["total_distance"],
            "route_geometry": route["route_geometry"],
            "vehicle": {
                "current_liters": 200,
                "consumption_rate": 2.5,
                "tank_capacity": 500
            },
            "stations": stations
        }
        response = requests.post(f"{BASE_URL}/api/plan-fuel-stops", json=plan_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "stops" in data
        assert "total_stops" in data
        assert "total_fuel_liters" in data
        assert "total_cost" in data
        
        # Should have multiple stops for ~4000km route
        assert data["total_stops"] > 0
        assert data["total_fuel_liters"] > 0
        assert data["total_cost"] > 0


class TestServiceOrder:
    """Service order generation tests"""
    
    def test_generate_service_order(self):
        """Test service order generation for WhatsApp"""
        order_data = {
            "station_name": "Posto Teste",
            "station_location": "São Paulo, SP",
            "coordinates": "-23.5505,-46.6333",
            "fuel_amount": 300
        }
        response = requests.post(f"{BASE_URL}/api/generate-service-order", json=order_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "maps_link" in data
        assert "station" in data
        
        # Message should contain station name
        assert "Posto Teste" in data["message"] or "ABASTECIMENTO" in data["message"]
        
        # Maps link should be valid Google Maps URL
        assert "google.com/maps" in data["maps_link"]


class TestSeedData:
    """Seed data tests"""
    
    def test_seed_stations(self):
        """Test seed stations endpoint"""
        response = requests.post(f"{BASE_URL}/api/seed-stations")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data or "stations" in data or isinstance(data, list)


class TestBugFixes:
    """Tests for specific bug fixes"""
    
    def test_bug1_marker_icon_and_color_persistence(self):
        """
        Bug 1: Verify marker_icon and marker_color are saved correctly
        When editing a station, icon and color should persist after update
        """
        # Create a test station with custom icon and color
        station_data = {
            "name": "TEST_Bug1_Station",
            "latitude": -25.0,
            "longitude": -49.0,
            "diesel_price": 5.50,
            "is_active": True,
            "city": "Test City",
            "marker_icon": "fuel",
            "marker_color": "orange"
        }
        create_response = requests.post(f"{BASE_URL}/api/stations", json=station_data)
        assert create_response.status_code == 200
        created = create_response.json()
        station_id = created["id"]
        
        # Update with new icon and color
        update_data = {
            "marker_icon": "star",
            "marker_color": "blue"
        }
        update_response = requests.put(f"{BASE_URL}/api/stations/{station_id}", json=update_data)
        assert update_response.status_code == 200
        
        updated = update_response.json()
        assert updated["marker_icon"] == "star", "marker_icon should be 'star' after update"
        assert updated["marker_color"] == "blue", "marker_color should be 'blue' after update"
        
        # Verify persistence by fetching the station again
        get_response = requests.get(f"{BASE_URL}/api/stations")
        assert get_response.status_code == 200
        stations = get_response.json()
        
        station = next((s for s in stations if s["id"] == station_id), None)
        assert station is not None, "Station should exist"
        assert station["marker_icon"] == "star", "marker_icon should persist as 'star'"
        assert station["marker_color"] == "blue", "marker_color should persist as 'blue'"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/stations/{station_id}")
    
    def test_station_update_preserves_other_fields(self):
        """
        Verify that updating marker_icon/color doesn't affect other fields
        """
        # Create station
        station_data = {
            "name": "TEST_Preserve_Fields",
            "latitude": -26.0,
            "longitude": -50.0,
            "diesel_price": 6.00,
            "is_active": True,
            "city": "Preserve City",
            "ratings": {
                "price_rating": 5,
                "service_rating": 4,
                "parking_rating": 3,
                "security_rating": 2
            }
        }
        create_response = requests.post(f"{BASE_URL}/api/stations", json=station_data)
        assert create_response.status_code == 200
        created = create_response.json()
        station_id = created["id"]
        
        # Update only icon and color
        update_data = {
            "marker_icon": "diamond",
            "marker_color": "green"
        }
        update_response = requests.put(f"{BASE_URL}/api/stations/{station_id}", json=update_data)
        assert update_response.status_code == 200
        
        updated = update_response.json()
        
        # Verify other fields are preserved
        assert updated["name"] == "TEST_Preserve_Fields"
        assert updated["diesel_price"] == 6.00
        assert updated["city"] == "Preserve City"
        assert updated["ratings"]["price_rating"] == 5
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/stations/{station_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
