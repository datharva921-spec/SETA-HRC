def test_complete_emergency_coordination_lifecycle(
    client, dispatcher_token, hospital_token, paramedic_token
):
    # A. Log in as a dispatcher (verified by token fixture)
    headers_disp = {"Authorization": f"Bearer {dispatcher_token}"}
    headers_hosp = {"Authorization": f"Bearer {hospital_token}"}
    headers_para = {"Authorization": f"Bearer {paramedic_token}"}

    # B. Register demonstration emergency
    intake_resp = client.post("/api/emergencies", json={
        "patient_name": "Full Flow Patient",
        "age": 42,
        "caller_name": "Family Member",
        "phone": "9845012345",
        "location": "MG Road, Bengaluru",
        "lat": 12.9716,
        "lng": 77.5946,
        "symptoms": "Severe acute chest pain radiating to left jaw, clammy skin",
        "category": "Cardiac"
    }, headers=headers_disp)
    assert intake_resp.status_code == 201
    case = intake_resp.json()
    case_id = case["id"]
    assert case["priority"] == "Critical"

    # C. Generate transparent triage recommendation
    assert "chest pain" in case["priority_reason"].lower()

    # D. View updated priority queue
    queue_resp = client.get("/api/triage/queue", headers=headers_disp)
    assert queue_resp.status_code == 200
    assert any(c["id"] == case_id for c in queue_resp.json())

    # E. Retrieve hospital availability
    hosp_list_resp = client.get("/api/hospitals", headers=headers_disp)
    assert hosp_list_resp.status_code == 200
    hospitals = hosp_list_resp.json()
    assert len(hospitals) >= 2

    # F. Generate ranked hospital recommendations with explanations
    rec_resp = client.post(f"/api/emergencies/{case_id}/recommendations", headers=headers_disp)
    assert rec_resp.status_code == 200
    recommendations = rec_resp.json()
    assert len(recommendations) >= 2
    top_rec = recommendations[0]
    assert top_rec["rank"] == 1
    assert "factors" in top_rec
    assert "capability_fit" in top_rec["factors"]

    # G. Human approval for recommendation
    approval_resp = client.post(
        f"/api/emergencies/{case_id}/recommendations/approve",
        json={
            "hospital_id": top_rec["hospital_id"],
            "reason": "Top Cardiology capability fit with available ICU beds",
            "override": False
        },
        headers=headers_disp
    )
    assert approval_resp.status_code == 200
    assert approval_resp.json()["approval_status"] == "Approved"

    # H. Assign an available ambulance
    assign_resp = client.post("/api/dispatch/assign", json={
        "emergency_id": case_id,
        "ambulance_id": "A-01"
    }, headers=headers_disp)
    assert assign_resp.status_code == 200
    assert assign_resp.json()["status"] == "Dispatched"

    # I & J. Send referral and record hospital acceptance
    referral_resp = client.post(f"/api/referrals/{case_id}/decision", json={
        "decision": "Accepted",
        "reason": "Receiving trauma and cardiology resuscitation team prepared",
        "hospital_id": top_rec["hospital_id"],
        "reserve_icu": True
    }, headers=headers_hosp)
    assert referral_resp.status_code == 200
    assert referral_resp.json()["decision"] == "Accepted"

    # K. Verify transactional resource reservation and capacity decrement
    hosp_after = client.get(f"/api/hospitals/{top_rec['hospital_id']}", headers=headers_hosp).json()
    assert hosp_after["beds_reserved"] > 0
    assert hosp_after["icu_reserved"] > 0

    # L. Update ambulance and emergency status across transport progression
    for status_step in ["At scene", "Transporting", "Arrived"]:
        status_resp = client.patch("/api/ambulances/A-01/status", json={
            "status": status_step
        }, headers=headers_para)
        assert status_resp.status_code == 200
        # Check emergency status followed along
        em_check = client.get(f"/api/emergencies/{case_id}", headers=headers_disp).json()
        assert em_check["status"] == status_step

    # M. Complete the case
    close_resp = client.patch(f"/api/emergencies/{case_id}/status", json={
        "status": "Closed",
        "notes": "Patient successfully handed over to Emergency Cardiology department"
    }, headers=headers_disp)
    assert close_resp.status_code == 200
    assert close_resp.json()["status"] == "Closed"

    # Reset ambulance
    client.patch("/api/ambulances/A-01/status", json={"status": "Available"}, headers=headers_para)

    # N. Verify database records, audit history and analytics
    audit_resp = client.get("/api/audit", headers=headers_disp)
    assert audit_resp.status_code == 200
    audit_events = audit_resp.json()
    assert len(audit_events) >= 3

    metrics_resp = client.get("/api/dashboard/metrics", headers=headers_disp)
    assert metrics_resp.status_code == 200
    assert metrics_resp.json()["total_cases"] >= 1


def test_concurrent_reservation_capacity_limit(client, dispatcher_token, hospital_token):
    headers_disp = {"Authorization": f"Bearer {dispatcher_token}"}
    headers_hosp = {"Authorization": f"Bearer {hospital_token}"}
    
    # Create emergency
    intake = client.post("/api/emergencies", json={
        "patient_name": "Capacity Test Patient",
        "age": 50,
        "caller_name": "Clinic",
        "phone": "9998887776",
        "location": "Whitefield",
        "symptoms": "Fever, weakness",
        "category": "Medical"
    }, headers=headers_disp).json()
    em_id = intake["id"]

    # H-02 only has 1 bed available in test database
    # Attempting to reserve 5 beds must fail with 409 Conflict
    resp = client.post("/api/reservations", json={
        "emergency_id": em_id,
        "hospital_id": "H-02",
        "resource_type": "bed",
        "quantity": 5
    }, headers=headers_hosp)
    assert resp.status_code == 409
    assert "Cannot reserve" in resp.json()["detail"]
