import requests
import sys
import json
from datetime import datetime

class FleetFuelAPITester:
    def __init__(self, base_url="https://smartfuel-3.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_station_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}" if endpoint else self.base_url
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json() if response.text else {}
                except:
                    response_data = {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"Response: {response.text[:200]}...")
                response_data = {}

            self.test_results.append({
                "name": name,
                "method": method,
                "endpoint": endpoint,
                "expected_status": expected_status,
                "actual_status": response.status_code,
                "success": success,
                "response_preview": response.text[:100] if response.text else ""
            })

            return success, response_data

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.test_results.append({
                "name": name,
                "method": method,
                "endpoint": endpoint,
                "expected_status": expected_status,
                "actual_status": "ERROR",
                "success": False,
                "error": str(e)
            })
            return False, {}

    def test_health_endpoints(self):
        """Test basic health endpoints"""
        print("\n=== TESTING HEALTH ENDPOINTS ===")
        
        # Test root endpoint
        self.run_test("Root API", "GET", "", 200)
        
        # Test health check
        self.run_test("Health Check", "GET", "health", 200)

    def test_station_crud(self):
        """Test fuel station CRUD operations"""
        print("\n=== TESTING STATION CRUD ===")
        
        # Test get stations (should be empty or seeded)
        success, stations_data = self.run_test("Get All Stations", "GET", "stations", 200)
        
        # Test seed stations if empty
        if success and isinstance(stations_data, list) and len(stations_data) == 0:
            self.run_test("Seed Sample Stations", "POST", "seed-stations", 200)
            # Get stations again after seeding
            success, stations_data = self.run_test("Get Stations After Seed", "GET", "stations", 200)
        
        # Test create new station
        new_station_data = {
            "name": "Test Station API",
            "latitude": -26.5,
            "longitude": -49.0,
            "diesel_price": 5.45,
            "is_active": True
        }
        success, created_station = self.run_test("Create New Station", "POST", "stations", 200, new_station_data)
        
        if success and 'id' in created_station:
            self.created_station_id = created_station['id']
            
            # Test get single station
            self.run_test("Get Single Station", "GET", f"stations/{self.created_station_id}", 200)
            
            # Test update station
            update_data = {
                "name": "Updated Test Station",
                "diesel_price": 5.99,
                "is_active": False
            }
            self.run_test("Update Station", "PUT", f"stations/{self.created_station_id}", 200, update_data)
            
            # Test delete station
            self.run_test("Delete Station", "DELETE", f"stations/{self.created_station_id}", 200)
        
        # Test get non-existent station
        self.run_test("Get Non-existent Station", "GET", "stations/non-existent-id", 404)

    def test_route_calculation(self):
        """Test route calculation functionality"""
        print("\n=== TESTING ROUTE CALCULATION ===")
        
        route_data = {
            "origin": {
                "name": "Porto Alegre",
                "latitude": -30.0346,
                "longitude": -51.2177
            },
            "destination": {
                "name": "São Paulo", 
                "latitude": -23.5505,
                "longitude": -46.6333
            },
            "waypoints": [
                {
                    "name": "Curitiba",
                    "latitude": -25.4284,
                    "longitude": -49.2733
                }
            ],
            "vehicle": {
                "current_liters": 200,
                "consumption_rate": 2.5,
                "tank_capacity": 400
            }
        }
        
        success, route_result = self.run_test("Calculate Route", "POST", "calculate-route", 200, route_data)
        
        if success:
            # Verify route result structure
            required_fields = ['total_distance', 'autonomy', 'can_complete_route', 'route_points']
            missing_fields = [field for field in required_fields if field not in route_result]
            if missing_fields:
                print(f"⚠️  Missing fields in route result: {missing_fields}")
            else:
                print(f"✅ Route calculation returned all required fields")
                print(f"   Distance: {route_result.get('total_distance', 0)} km")
                print(f"   Autonomy: {route_result.get('autonomy', 0)} km")
                print(f"   Can complete: {route_result.get('can_complete_route', False)}")

    def test_ai_recommendation(self):
        """Test AI recommendation functionality"""
        print("\n=== TESTING AI RECOMMENDATION ===")
        
        # First get stations for recommendation
        success, stations_data = self.run_test("Get Stations for AI", "GET", "stations", 200)
        
        if success and stations_data:
            recommendation_data = {
                "route_distance": 1100.0,
                "vehicle": {
                    "current_liters": 200,
                    "consumption_rate": 2.5,
                    "tank_capacity": 400
                },
                "stations": stations_data
            }
            
            success, rec_result = self.run_test("AI Station Recommendation", "POST", "recommend-station", 200, recommendation_data)
            
            if success:
                if 'recommendation' in rec_result and rec_result['recommendation']:
                    print(f"✅ AI recommendation generated successfully")
                    if 'station' in rec_result['recommendation']:
                        station = rec_result['recommendation']['station']
                        print(f"   Recommended: {station.get('name', 'Unknown')} - R$ {station.get('diesel_price', 0):.2f}/L")
                else:
                    print(f"⚠️  AI recommendation returned but no recommendation found")

    def test_service_order_generation(self):
        """Test service order generation"""
        print("\n=== TESTING SERVICE ORDER GENERATION ===")
        
        service_order_data = {
            "station_name": "Test Station",
            "station_location": "Test Location, Test City",
            "coordinates": "-26.5,-49.0",
            "fuel_amount": 150.0
        }
        
        success, order_result = self.run_test("Generate Service Order", "POST", "generate-service-order", 200, service_order_data)
        
        if success:
            required_fields = ['message', 'maps_link', 'station']
            missing_fields = [field for field in required_fields if field not in order_result]
            if missing_fields:
                print(f"⚠️  Missing fields in service order: {missing_fields}")
            else:
                print(f"✅ Service order generated with all required fields")
                print(f"   Station: {order_result.get('station', 'Unknown')}")
                print(f"   Maps link: {order_result.get('maps_link', 'No link')}")

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Fleet Fuel Management API Tests")
        print(f"Base URL: {self.base_url}")
        
        try:
            self.test_health_endpoints()
            self.test_station_crud()
            self.test_route_calculation()
            self.test_ai_recommendation()
            self.test_service_order_generation()
            
        except Exception as e:
            print(f"❌ Test suite error: {str(e)}")
        
        # Print final results
        print(f"\n📊 FINAL RESULTS")
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.tests_passed < self.tests_run:
            print(f"\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    error_msg = result.get('error', f'Status {result.get("actual_status", "unknown")}')
                    print(f"  - {result['name']}: {error_msg}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = FleetFuelAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())