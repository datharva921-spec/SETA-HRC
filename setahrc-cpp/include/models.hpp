#ifndef SETA_MODELS_HPP
#define SETA_MODELS_HPP

#include <string>
#include <vector>
#include <chrono>

namespace seta {

struct User {
    std::string id;
    std::string name;
    std::string email;
    std::string password;
    std::string role;      // dispatcher, hospital, paramedic, admin
    std::string status;    // Active, Inactive
    std::string hospital_id;
};

struct Hospital {
    std::string id;
    std::string name;
    std::string location;
    int node_id;           // Road network graph node id
    double lat;
    double lng;
    double distance_km;
    std::vector<std::string> capabilities;
    std::vector<std::string> departments;
    int beds_available;
    int beds_reserved;
    int beds_unavailable;
    int icu_available;
    int icu_reserved;
    int icu_unavailable;
    bool oxygen_available;
    std::string status;    // Available, Busy, Offline
    double operational_load; // 0.0 to 1.0
};

struct Ambulance {
    std::string id;
    std::string unit;
    std::string status;    // Available, Dispatched, At Scene, Transporting
    std::string paramedic_name;
    std::string location;
    int node_id;           // Road network graph node id
    double lat;
    double lng;
    std::string assigned_emergency_id;
};

struct HistoryEvent {
    std::string at;
    std::string event;
    std::string actor;
};

struct Emergency {
    std::string id;
    std::string patient_name;
    int age;
    std::string caller_name;
    std::string phone;
    std::string location;
    int node_id;           // Road network graph node id
    double lat;
    double lng;
    bool coordinates_provided;
    std::string symptoms;
    std::string category;
    std::string priority;  // Critical, High, Moderate, Low
    int priority_score;    // Numeric score for Max-Heap (100 = critical, 20 = low)
    std::string priority_reason;
    std::string status;    // New, Triaged, Dispatched, At scene, Transporting, Arrived, Accepted, Rejected, Closed
    std::string assigned_ambulance_id;
    std::string recommended_hospital_id;
    std::string approval_status;
    std::string approval_reason;
    std::string handover_notes;
    std::string created_at;
    std::vector<HistoryEvent> history;
};

struct HospitalRecommendation {
    std::string emergency_id;
    std::string hospital_id;
    int rank;
    double total_score;
    double capability_score;
    double resource_score;
    double distance_score;
    double load_score;
    double distance_km;
    std::vector<int> shortest_path_nodes; // Dijkstra path
    std::string explanation;
    std::string status;    // Proposed, Approved, Rejected
};

struct ResourceReservation {
    int id;
    std::string emergency_id;
    std::string hospital_id;
    std::string resource_type; // bed, icu, oxygen
    int quantity;
    std::string status;        // Reserved, Claimed, Released
    std::string created_at;
};

struct AuditLog {
    std::string id;
    std::string actor;
    std::string action;
    std::string target;
    std::string reason;
    std::string details;
    std::string created_at;
};

} // namespace seta

#endif // SETA_MODELS_HPP
