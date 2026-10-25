#ifndef SETA_COORDINATION_SYSTEM_HPP
#define SETA_COORDINATION_SYSTEM_HPP

#include "models.hpp"
#include "hash_table.hpp"
#include "priority_queue.hpp"
#include "graph.hpp"
#include "triage_engine.hpp"

#include <string>
#include <vector>
#include <chrono>
#include <ctime>
#include <sstream>
#include <iomanip>
#include <windows.h>

namespace seta {

class FastMutex {
private:
    CRITICAL_SECTION cs;
public:
    FastMutex() { InitializeCriticalSection(&cs); }
    ~FastMutex() { DeleteCriticalSection(&cs); }
    void lock() { EnterCriticalSection(&cs); }
    void unlock() { LeaveCriticalSection(&cs); }
};

class FastLockGuard {
private:
    FastMutex& mtx;
public:
    explicit FastLockGuard(FastMutex& m) : mtx(m) { mtx.lock(); }
    ~FastLockGuard() { mtx.unlock(); }
};

struct EmergencyPriorityComparator {
    bool operator()(const Emergency& a, const Emergency& b) const {
        // Lower priority score comes after higher priority score
        return a.priority_score < b.priority_score;
    }
};

class CoordinationSystem {
private:
    FastMutex sys_mutex;

    // Core Data Structures
    HashTable<std::string, Hospital> hospital_table;
    HashTable<std::string, Ambulance> ambulance_table;
    HashTable<std::string, User> user_table;
    HashTable<std::string, Emergency> emergency_table;
    PriorityQueue<Emergency, EmergencyPriorityComparator> triage_heap;
    CityGraph city_graph;

    std::vector<AuditLog> audit_logs;
    std::vector<ResourceReservation> reservations;
    int next_reservation_id;

    std::string getCurrentTimestamp() const {
        auto now = std::chrono::system_clock::now();
        std::time_t t = std::chrono::system_clock::to_time_t(now);
        std::stringstream ss;
        ss << std::put_time(std::gmtime(&t), "%Y-%m-%dT%H:%M:%SZ");
        return ss.str();
    }

public:
    CoordinationSystem() : next_reservation_id(100), city_graph(10) {
        setupGraph();
        seedData();
    }

    void setupGraph() {
        // Setup 10 city zones/intersections
        city_graph.setNodeName(0, "Central Square");
        city_graph.setNodeName(1, "Indiranagar Junction");
        city_graph.setNodeName(2, "Whitefield Tech Park");
        city_graph.setNodeName(3, "Koramangala 80ft Road");
        city_graph.setNodeName(4, "Jayanagar 4th Block");
        city_graph.setNodeName(5, "Electronic City Phase 1");
        city_graph.setNodeName(6, "Yeshwanthpur Circle");
        city_graph.setNodeName(7, "Malleshwaram 18th Cross");
        city_graph.setNodeName(8, "MG Road Metro");
        city_graph.setNodeName(9, "Outer Ring Road Bellandur");

        // Road network connections (distance in km, traffic congestion multiplier)
        city_graph.addEdge(0, 8, 2.5, 1.2, "MG Road Boulevard");
        city_graph.addEdge(8, 1, 4.0, 1.3, "Old Airport Road");
        city_graph.addEdge(1, 9, 6.2, 1.1, "Suranjandas Road");
        city_graph.addEdge(9, 2, 7.5, 1.4, "ITPL Main Road");
        city_graph.addEdge(0, 3, 5.0, 1.5, "Hosur Main Road");
        city_graph.addEdge(3, 4, 3.8, 1.1, "Bannerghatta Link");
        city_graph.addEdge(3, 9, 5.5, 1.2, "Sarjapur Road");
        city_graph.addEdge(4, 5, 11.0, 1.2, "Electronic City Elevated Highway");
        city_graph.addEdge(0, 7, 4.2, 1.1, "Sankey Tank Road");
        city_graph.addEdge(7, 6, 3.5, 1.3, "Tumkur Road");
        city_graph.addEdge(6, 0, 6.0, 1.4, "Rajajinagar Link");
    }

    void seedData() {
        // 1. Users
        user_table.insert("asha.nair@seta-hrc.org", {
            "U-01", "Asha Nair", "asha.nair@seta-hrc.org", "Dispatcher@123", "dispatcher", "Active", ""
        });
        user_table.insert("rohan.shetty@seta-hrc.org", {
            "U-02", "Dr. Rohan Shetty", "rohan.shetty@seta-hrc.org", "Hospital@123", "hospital", "Active", "H-01"
        });
        user_table.insert("priya.menon@seta-hrc.org", {
            "U-03", "Priya Menon", "priya.menon@seta-hrc.org", "Paramedic@123", "paramedic", "Active", ""
        });
        user_table.insert("ops@seta-hrc.org", {
            "U-04", "SETA Operations Admin", "ops@seta-hrc.org", "Admin@123", "admin", "Active", ""
        });

        // 2. Hospitals
        hospital_table.insert("H-01", {
            "H-01", "City General Hospital", "MG Road Central", 8, 12.9716, 77.5946, 2.5,
            {"TraumaCenter", "CathLab", "ICU", "StrokeUnit"}, {"Emergency", "Cardiology", "Neurology"},
            14, 2, 4, 3, 1, 0, true, "Available", 0.45
        });
        hospital_table.insert("H-02", {
            "H-02", "Apollo Emergency Center", "Jayanagar 4th Block", 4, 12.9299, 77.5824, 6.3,
            {"CathLab", "StrokeUnit", "Pediatrics", "ICU"}, {"Cardiology", "Pediatrics", "Emergency"},
            8, 1, 2, 2, 0, 1, true, "Available", 0.60
        });
        hospital_table.insert("H-03", {
            "H-03", "Manipal Critical Care", "Old Airport Road, Indiranagar", 1, 12.9591, 77.6480, 5.1,
            {"TraumaCenter", "CathLab", "BurnUnit", "ICU"}, {"Emergency", "CriticalCare", "Cardiology"},
            18, 3, 5, 5, 2, 1, true, "Available", 0.50
        });
        hospital_table.insert("H-04", {
            "H-04", "Fortis Hospital", "Bannerghatta Link, Koramangala", 3, 12.9352, 77.6245, 5.8,
            {"TraumaCenter", "StrokeUnit", "ICU"}, {"Emergency", "Neurology", "Orthopedics"},
            6, 1, 3, 1, 1, 0, true, "Available", 0.72
        });
        hospital_table.insert("H-05", {
            "H-05", "Narayana Health City", "Electronic City Phase 1", 5, 12.8399, 77.6770, 14.2,
            {"TraumaCenter", "CathLab", "Pediatrics", "BurnUnit", "ICU"}, {"CardiacSurgery", "Emergency"},
            25, 4, 6, 8, 3, 1, true, "Available", 0.40
        });

        // 3. Ambulances
        ambulance_table.insert("AMB-01", {"AMB-01", "Unit-Alpha-1", "Available", "Priya Menon", "Central Square", 0, 12.9716, 77.5946, ""});
        ambulance_table.insert("AMB-02", {"AMB-02", "Unit-Alpha-2", "Available", "Rajesh Kumar", "Indiranagar Junction", 1, 12.9591, 77.6480, ""});
        ambulance_table.insert("AMB-03", {"AMB-03", "Unit-Beta-1", "Available", "Vikram Singh", "Koramangala 80ft Road", 3, 12.9352, 77.6245, ""});
        ambulance_table.insert("AMB-04", {"AMB-04", "Unit-Beta-2", "Available", "Anand Verma", "Yeshwanthpur Circle", 6, 12.9750, 77.5600, ""});
        ambulance_table.insert("AMB-05", {"AMB-05", "Unit-Gamma-1", "Available", "Sunita Rao", "Outer Ring Road Bellandur", 9, 12.9300, 77.6800, ""});
        ambulance_table.insert("AMB-06", {"AMB-06", "Unit-Gamma-2", "Available", "Mohan Das", "Jayanagar 4th Block", 4, 12.9299, 77.5824, ""});

        // 4. Initial demonstration emergency
        reportEmergency(
            "Ramesh Gupta", 58, "Sunita Gupta", "9876543210",
            "MG Road Central", 8, "Crushing chest pain and severe diaphoresis", "Cardiac"
        );
    }

    // Authenticate user in O(1)
    const User* authenticate(const std::string& email, const std::string& password) {
        FastLockGuard lock(sys_mutex);
        User* u = user_table.find(email);
        if (u && u->password == password) {
            return u;
        }
        return nullptr;
    }

    // Report Emergency and insert into Max-Heap O(log N)
    Emergency reportEmergency(
        const std::string& patient_name, int age, const std::string& caller_name,
        const std::string& phone, const std::string& location, int node_id,
        const std::string& symptoms, const std::string& category
    ) {
        FastLockGuard lock(sys_mutex);

        static int counter = 101;
        std::string em_id = "EM-" + std::to_string(counter++);

        auto assessment = TriageEngine::assess(symptoms, category, age);

        Emergency em;
        em.id = em_id;
        em.patient_name = patient_name;
        em.age = age;
        em.caller_name = caller_name;
        em.phone = phone;
        em.location = location;
        em.node_id = (node_id >= 0 && node_id < city_graph.getNodeCount()) ? node_id : 0;
        em.lat = 12.9716;
        em.lng = 77.5946;
        em.coordinates_provided = true;
        em.symptoms = symptoms;
        em.category = category;
        em.priority = assessment.priority;
        em.priority_score = assessment.priority_score;
        em.priority_reason = assessment.priority_reason;
        em.status = "Triaged";
        em.created_at = getCurrentTimestamp();

        em.history.push_back({em.created_at, "Emergency incident logged & triage assessed: " + em.priority, "Dispatcher"});

        // Insert into O(1) Hash Table
        emergency_table.insert(em_id, em);

        // Rebuild triage heap with all active emergencies
        rebuildTriageHeap();

        // Audit Log
        audit_logs.push_back({
            "AUD-" + std::to_string(audit_logs.size() + 1), "Dispatcher",
            "Emergency Created", em.id, em.priority_reason, "Assessed priority: " + em.priority, em.created_at
        });

        return em;
    }

    void rebuildTriageHeap() {
        triage_heap.clear();
        std::vector<Emergency> all_em = emergency_table.getAllValues();
        for (const auto& em : all_em) {
            if (em.status != "Closed") {
                triage_heap.push(em);
            }
        }
    }

    std::vector<Emergency> getTriageQueue() {
        FastLockGuard lock(sys_mutex);
        return triage_heap.getSortedElements();
    }

    const Emergency* getEmergency(const std::string& id) {
        FastLockGuard lock(sys_mutex);
        return emergency_table.find(id);
    }

    std::vector<Hospital> getAllHospitals() {
        FastLockGuard lock(sys_mutex);
        return hospital_table.getAllValues();
    }

    std::vector<Ambulance> getAllAmbulances() {
        FastLockGuard lock(sys_mutex);
        return ambulance_table.getAllValues();
    }

    // Graph & Dijkstra: Recommend hospitals ranked by Multi-Criteria Decision Analysis (MCDA)
    std::vector<HospitalRecommendation> getHospitalRecommendations(const std::string& emergency_id) {
        FastLockGuard lock(sys_mutex);
        std::vector<HospitalRecommendation> recs;

        Emergency* em = emergency_table.find(emergency_id);
        if (!em) return recs;

        // Run Dijkstra from emergency location node
        DijkstraResult dijkstra = city_graph.computeShortestPaths(em->node_id);

        std::vector<Hospital> hospitals = hospital_table.getAllValues();
        for (const auto& h : hospitals) {
            double shortest_dist = dijkstra.distances[h.node_id];
            std::vector<int> path = dijkstra.getPath(h.node_id);

            auto rec = TriageEngine::scoreHospital(*em, h, shortest_dist, path);
            recs.push_back(rec);
        }

        // Rank by total MCDA score descending
        std::sort(recs.begin(), recs.end(), [](const HospitalRecommendation& a, const HospitalRecommendation& b) {
            return a.total_score > b.total_score;
        });

        for (size_t i = 0; i < recs.size(); ++i) {
            recs[i].rank = static_cast<int>(i + 1);
        }

        if (!recs.empty()) {
            em->recommended_hospital_id = recs[0].hospital_id;
            em->history.push_back({getCurrentTimestamp(), "AI recommended hospital: " + recs[0].hospital_id + " (Score " + std::to_string(recs[0].total_score) + ")", "System MCDA Engine"});
        }

        return recs;
    }

    // Graph & Dijkstra: Dispatch nearest available ambulance
    std::string dispatchNearestAmbulance(const std::string& emergency_id, const std::string& override_amb_id = "") {
        FastLockGuard lock(sys_mutex);

        Emergency* em = emergency_table.find(emergency_id);
        if (!em) return "";

        Ambulance* chosen_amb = nullptr;

        if (!override_amb_id.empty()) {
            chosen_amb = ambulance_table.find(override_amb_id);
        } else {
            // Find closest available ambulance using Dijkstra
            DijkstraResult dijkstra = city_graph.computeShortestPaths(em->node_id);
            double min_dist = std::numeric_limits<double>::infinity();

            std::vector<Ambulance> ambulances = ambulance_table.getAllValues();
            for (auto& amb : ambulances) {
                if (amb.status == "Available") {
                    double dist = dijkstra.distances[amb.node_id];
                    if (dist < min_dist) {
                        min_dist = dist;
                        chosen_amb = ambulance_table.find(amb.id);
                    }
                }
            }
        }

        if (chosen_amb) {
            chosen_amb->status = "Dispatched";
            chosen_amb->assigned_emergency_id = em->id;
            em->assigned_ambulance_id = chosen_amb->id;
            em->status = "Dispatched";
            em->history.push_back({getCurrentTimestamp(), "Ambulance " + chosen_amb->unit + " dispatched by Dijkstra shortest route", "Dispatcher"});

            audit_logs.push_back({
                "AUD-" + std::to_string(audit_logs.size() + 1), "Dispatcher",
                "Ambulance Dispatched", chosen_amb->id, "Nearest unit to emergency site",
                "Emergency: " + em->id, getCurrentTimestamp()
            });

            return chosen_amb->id;
        }

        return "";
    }

    // Concurrency-safe hospital referral decision and resource reservation
    bool recordReferralDecision(
        const std::string& emergency_id,
        const std::string& hospital_id,
        const std::string& decision,
        bool reserve_icu = false,
        const std::string& reason = "Clinical decision"
    ) {
        FastLockGuard lock(sys_mutex);

        Emergency* em = emergency_table.find(emergency_id);
        Hospital* h = hospital_table.find(hospital_id);
        if (!em || !h) return false;

        em->approval_status = decision;
        em->approval_reason = reason;

        if (decision == "Accepted") {
            em->status = "Accepted";
            if (reserve_icu && h->icu_available > 0) {
                h->icu_available--;
                h->icu_reserved++;
                reservations.push_back({
                    next_reservation_id++, em->id, h->id, "icu", 1, "Reserved", getCurrentTimestamp()
                });
            } else if (h->beds_available > 0) {
                h->beds_available--;
                h->beds_reserved++;
                reservations.push_back({
                    next_reservation_id++, em->id, h->id, "bed", 1, "Reserved", getCurrentTimestamp()
                });
            }
            em->history.push_back({getCurrentTimestamp(), "Hospital accepted referral and allocated resource", h->name});
        } else {
            em->status = "Rejected";
            em->history.push_back({getCurrentTimestamp(), "Hospital declined referral: " + reason, h->name});
        }

        return true;
    }

    const CityGraph& getGraph() const { return city_graph; }
    const std::vector<AuditLog>& getAuditLogs() const { return audit_logs; }
};

} // namespace seta

#endif // SETA_COORDINATION_SYSTEM_HPP
