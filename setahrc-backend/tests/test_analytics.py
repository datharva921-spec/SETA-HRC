def test_analytics_summary(client, dispatcher_token):
    resp = client.get("/api/analytics/summary", headers={"Authorization": f"Bearer {dispatcher_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "metrics" in data
    assert "volume_by_day" in data
    assert "category_breakdown" in data
    assert "resource_snapshot" in data


def test_system_evaluation(client, dispatcher_token):
    resp = client.get("/api/analytics/evaluate", headers={"Authorization": f"Bearer {dispatcher_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "seta_recommendation_avg_distance_km" in data
    assert "nearest_only_avg_distance_km" in data
    assert "priority_queue_critical_wait_min" in data
    assert "fifo_critical_wait_min" in data
    assert data["consistency_rate"] == 1.0


def test_synthetic_text_classification(client, dispatcher_token):
    resp = client.post("/api/analytics/classify-text", json={
        "text": "Elderly patient with severe sudden chest pain and cold sweats"
    }, headers={"Authorization": f"Bearer {dispatcher_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["predicted_category"] == "Cardiac"
    assert data["suggested_priority"] == "Critical"
    assert "EXPERIMENTAL" in data["disclaimer"]
    assert "confidence" in data
