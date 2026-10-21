def test_login_success(client):
    response = client.post("/api/auth/login", json={
        "email": "dispatcher@test.com",
        "password": "Pass@123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "dispatcher@test.com"
    assert data["user"]["trusted_role"] == "dispatcher"


def test_login_invalid_password(client):
    response = client.post("/api/auth/login", json={
        "email": "dispatcher@test.com",
        "password": "WrongPassword"
    })
    assert response.status_code == 401


def test_register_new_user(client):
    response = client.post("/api/auth/register", json={
        "name": "Dr. Sarah",
        "email": "sarah@test.com",
        "password": "SecretPassword123",
        "role": "hospital"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["email"] == "sarah@test.com"
    assert data["user"]["trusted_role"] == "hospital"


def test_get_current_user(client, dispatcher_token):
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {dispatcher_token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "dispatcher@test.com"
    assert data["trusted_role"] == "dispatcher"


def test_admin_list_users(client, admin_token, dispatcher_token):
    # Dispatcher should be forbidden
    resp_disp = client.get("/api/auth/users", headers={"Authorization": f"Bearer {dispatcher_token}"})
    assert resp_disp.status_code == 403

    # Admin should succeed
    resp_admin = client.get("/api/auth/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp_admin.status_code == 200
    assert len(resp_admin.json()) >= 4
