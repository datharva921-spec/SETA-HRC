def test_create_emergency_critical_triage(client, dispatcher_token):
    # Registration with acute chest pain must automatically receive Critical priority
    payload = {
        "patient_name": "G. Rao",
        "age": 58,
        "caller_name": "Sunita Rao",
        "phone": "9876543210",
        "location": "Residency Road, Bengaluru",
        "lat": 12.9716,
        "lng": 77.5946,
        "symptoms": "Severe chest pain radiating to left arm, heavy perspiration",
        "category": "Cardiac"
    }
    response = client.post(
        "/api/emergencies",
        json=payload,
        headers={"Authorization": f"Bearer {dispatcher_token}"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["priority"] == "Critical"
    assert "chest pain" in data["priority_reason"].lower()
    assert data["status"] == "New"
    assert len(data["history"]) >= 1


def test_triage_priority_queue_ordering(client, dispatcher_token):
    # Register Moderate emergency first
    client.post("/api/emergencies", json={
        "patient_name": "Moderate Patient", "age": 30, "caller_name": "Caller",
        "phone": "9999999999", "location": "Koramangala", "symptoms": "Minor sprain and scrape",
        "category": "Injury"
    }, headers={"Authorization": f"Bearer {dispatcher_token}"})

    # Register Critical emergency second
    client.post("/api/emergencies", json={
        "patient_name": "Critical Patient", "age": 60, "caller_name": "Caller",
        "phone": "9999999999", "location": "Indiranagar", "symptoms": "Unresponsive, not breathing",
        "category": "Cardiac"
    }, headers={"Authorization": f"Bearer {dispatcher_token}"})

    # Priority queue must place Critical patient ahead of Moderate patient regardless of arrival time
    resp = client.get("/api/triage/queue", headers={"Authorization": f"Bearer {dispatcher_token}"})
    assert resp.status_code == 200
    queue = resp.json()
    assert len(queue) >= 2
    # First item in queue must be Critical
    assert queue[0]["priority"] == "Critical"
