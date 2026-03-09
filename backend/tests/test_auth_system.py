"""
Authentication System API Tests
Tests for: login, me endpoint, user CRUD, access logs, protected routes
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthLogin:
    """Login endpoint tests - /api/auth/login"""
    
    def test_login_with_valid_admin_credentials(self):
        """Test login with JAI/123 returns token and user data"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "JAI",
            "password": "123"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user"
        
        user = data["user"]
        assert user["username"] == "JAI"
        assert user["role"] == "admin"
        assert "permissions" in user
        assert isinstance(data["token"], str)
        assert len(data["token"]) > 0
        
        # Store token for other tests
        TestAuthLogin.admin_token = data["token"]
        TestAuthLogin.admin_user = user
        print(f"Login successful - User: {user['username']}, Role: {user['role']}")
    
    def test_login_with_invalid_username(self):
        """Test login with wrong username returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "WRONG_USER",
            "password": "123"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data
        print(f"Invalid username error: {data['detail']}")
    
    def test_login_with_invalid_password(self):
        """Test login with wrong password returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "JAI",
            "password": "WRONG_PASSWORD"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data
        print(f"Invalid password error: {data['detail']}")
    
    def test_login_with_empty_credentials(self):
        """Test login with empty credentials returns error"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "",
            "password": ""
        })
        # Should return 401 or 422
        assert response.status_code in [401, 422], f"Expected 401 or 422, got {response.status_code}"


class TestAuthMe:
    """Me endpoint tests - /api/auth/me"""
    
    def test_me_with_valid_token(self):
        """Test GET /api/auth/me with valid token returns user info"""
        token = getattr(TestAuthLogin, 'admin_token', None)
        if not token:
            # Login first
            login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "username": "JAI",
                "password": "123"
            })
            assert login_response.status_code == 200
            token = login_response.json()["token"]
        
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["username"] == "JAI"
        assert data["role"] == "admin"
        assert "permissions" in data
        print(f"Me endpoint - User: {data['username']}, Permissions: {data['permissions']}")
    
    def test_me_without_token(self):
        """Test GET /api/auth/me without token returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_me_with_invalid_token(self):
        """Test GET /api/auth/me with invalid token returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": "Bearer invalid_token_here"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestUsersCRUD:
    """User management tests - /api/users (requires admin)"""
    
    @classmethod
    def get_admin_token(cls):
        token = getattr(TestAuthLogin, 'admin_token', None)
        if not token:
            login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "username": "JAI",
                "password": "123"
            })
            assert login_response.status_code == 200
            token = login_response.json()["token"]
        return token
    
    def test_list_users_as_admin(self):
        """Test GET /api/users returns user list for admin"""
        token = self.get_admin_token()
        
        response = requests.get(f"{BASE_URL}/api/users", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        
        # Should include the admin user JAI
        usernames = [u["username"] for u in data]
        assert "JAI" in usernames, "Admin user JAI should be in the list"
        
        # Verify JAI user data
        jai = next((u for u in data if u["username"] == "JAI"), None)
        assert jai is not None
        assert jai["role"] == "admin"
        assert "password" not in jai, "Password should not be returned"
        print(f"Users list: {usernames}")
    
    def test_list_users_without_auth(self):
        """Test GET /api/users without authentication returns 401"""
        response = requests.get(f"{BASE_URL}/api/users")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_create_new_user(self):
        """Test POST /api/users creates a new user"""
        token = self.get_admin_token()
        
        new_user = {
            "username": "TEST_novo_usuario",
            "password": "senha123",
            "name": "Usuario Teste",
            "role": "monitor",
            "permissions": ["view_history"]
        }
        
        response = requests.post(f"{BASE_URL}/api/users", 
                                json=new_user, 
                                headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["username"] == "TEST_novo_usuario"
        
        TestUsersCRUD.created_user_id = data["id"]
        print(f"Created user: {data['username']} with ID: {data['id']}")
    
    def test_create_duplicate_user_fails(self):
        """Test POST /api/users with existing username returns 400"""
        token = self.get_admin_token()
        
        duplicate_user = {
            "username": "JAI",  # Already exists
            "password": "senha123",
            "name": "Duplicate",
            "role": "monitor",
            "permissions": []
        }
        
        response = requests.post(f"{BASE_URL}/api/users",
                                json=duplicate_user,
                                headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 400, f"Expected 400 for duplicate user, got {response.status_code}"
    
    def test_update_user(self):
        """Test PUT /api/users/{id} updates user"""
        token = self.get_admin_token()
        user_id = getattr(TestUsersCRUD, 'created_user_id', None)
        
        if not user_id:
            pytest.skip("No user created to update")
        
        update_data = {
            "name": "Usuario Atualizado",
            "role": "monitor",
            "permissions": ["view_history", "edit_stations"]
        }
        
        response = requests.put(f"{BASE_URL}/api/users/{user_id}",
                               json=update_data,
                               headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("User updated successfully")
    
    def test_delete_user(self):
        """Test DELETE /api/users/{id} deletes user"""
        token = self.get_admin_token()
        user_id = getattr(TestUsersCRUD, 'created_user_id', None)
        
        if not user_id:
            pytest.skip("No user created to delete")
        
        response = requests.delete(f"{BASE_URL}/api/users/{user_id}",
                                  headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"User {user_id} deleted successfully")
    
    def test_admin_cannot_delete_self(self):
        """Test admin cannot delete their own account"""
        token = self.get_admin_token()
        
        # Get admin's own ID
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert me_response.status_code == 200
        admin_id = me_response.json()["id"]
        
        # Try to delete self
        response = requests.delete(f"{BASE_URL}/api/users/{admin_id}",
                                  headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 400, f"Expected 400 when deleting self, got {response.status_code}"
        print("Correctly prevented admin from deleting self")


class TestAccessLogs:
    """Access logs tests - /api/access-logs"""
    
    def test_access_logs_as_admin(self):
        """Test GET /api/access-logs returns access history for admin"""
        # Login first to ensure we have a log entry
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "JAI",
            "password": "123"
        })
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        response = requests.get(f"{BASE_URL}/api/access-logs", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        
        # Should have at least one login entry
        if len(data) > 0:
            log = data[0]
            assert "id" in log
            assert "username" in log
            assert "action" in log
            assert "timestamp" in log
            print(f"Found {len(data)} access log entries")
            print(f"Most recent: {log['username']} - {log['action']} at {log['timestamp']}")
        else:
            print("No access logs found (this may be OK if DB was just cleaned)")
    
    def test_access_logs_without_auth(self):
        """Test GET /api/access-logs without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/access-logs")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestProtectedEndpoints:
    """Test that other endpoints work with auth when needed"""
    
    def test_stations_endpoint_is_public(self):
        """Stations endpoint should be accessible without auth"""
        response = requests.get(f"{BASE_URL}/api/stations")
        assert response.status_code == 200, "Stations endpoint should be public"
    
    def test_route_calculation_is_public(self):
        """Route calculation should be accessible without auth"""
        route_data = {
            "origin_city": "São Paulo",
            "destination_city": "Curitiba",
            "waypoint_cities": [],
            "vehicle": {
                "current_liters": 200,
                "consumption_rate": 2.5,
                "tank_capacity": 500
            }
        }
        response = requests.post(f"{BASE_URL}/api/calculate-route", json=route_data)
        assert response.status_code == 200, "Route calculation should be public"


class TestLoginAndDashboardFlow:
    """Test complete login flow"""
    
    def test_complete_login_flow(self):
        """Test complete login -> get user -> access protected resource"""
        # 1. Login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "JAI",
            "password": "123"
        })
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        user = login_response.json()["user"]
        
        print(f"Step 1: Login successful - User: {user['username']}")
        
        # 2. Verify token with /me endpoint
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert me_response.status_code == 200
        me_data = me_response.json()
        assert me_data["username"] == user["username"]
        
        print(f"Step 2: Token validated - User confirmed: {me_data['username']}")
        
        # 3. Access admin endpoint (users list)
        users_response = requests.get(f"{BASE_URL}/api/users", headers={
            "Authorization": f"Bearer {token}"
        })
        assert users_response.status_code == 200
        users = users_response.json()
        assert len(users) > 0
        
        print(f"Step 3: Admin endpoint accessible - Found {len(users)} users")
        
        # 4. Access logs
        logs_response = requests.get(f"{BASE_URL}/api/access-logs", headers={
            "Authorization": f"Bearer {token}"
        })
        assert logs_response.status_code == 200
        
        print("Step 4: Access logs endpoint working")
        
        print("\n✅ Complete login flow successful!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
