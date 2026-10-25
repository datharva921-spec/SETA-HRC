#include "coordination_system.hpp"
#include "http_server.hpp"

#include <iostream>
#include <string>
#include <vector>
#include <iomanip>

using namespace seta;

void printBanner() {
    std::cout << "\n========================================================================\n";
    std::cout << "    SETA-HRC: Smart Emergency Triage & Resource Coordination System    \n";
    std::cout << "             [C++ Data Structures & Algorithms Engine]                 \n";
    std::cout << "========================================================================\n";
}

void displayTriageQueue(CoordinationSystem& system) {
    std::cout << "\n------------------------------------------------------------------------\n";
    std::cout << " [DSA: Binary Max-Heap] REAL-TIME EMERGENCY TRIAGE PRIORITY QUEUE\n";
    std::cout << " Highest Severity / Urgency patients are prioritized at root O(1)\n";
    std::cout << "------------------------------------------------------------------------\n";
    std::cout << std::left 
              << std::setw(10) << "ID"
              << std::setw(18) << "Patient"
              << std::setw(6)  << "Age"
              << std::setw(12) << "Category"
              << std::setw(12) << "Priority"
              << std::setw(8)  << "Score"
              << std::setw(14) << "Status"
              << "\n------------------------------------------------------------------------\n";

    std::vector<Emergency> queue = system.getTriageQueue();
    if (queue.empty()) {
        std::cout << " No active emergency cases in triage heap.\n";
    } else {
        for (const auto& em : queue) {
            std::cout << std::left 
                      << std::setw(10) << em.id
                      << std::setw(18) << em.patient_name
                      << std::setw(6)  << em.age
                      << std::setw(12) << em.category
                      << std::setw(12) << em.priority
                      << std::setw(8)  << em.priority_score
                      << std::setw(14) << em.status
                      << "\n";
            std::cout << "   Reason: " << em.priority_reason << "\n";
        }
    }
    std::cout << "------------------------------------------------------------------------\n";
}

void displayHospitals(CoordinationSystem& system) {
    std::cout << "\n------------------------------------------------------------------------\n";
    std::cout << " [DSA: Hash Table with Chaining] HOSPITAL RESOURCE INDEX (O(1) Search)\n";
    std::cout << "------------------------------------------------------------------------\n";
    std::cout << std::left 
              << std::setw(8)  << "ID"
              << std::setw(28) << "Hospital Name"
              << std::setw(12) << "Beds Avail"
              << std::setw(12) << "ICU Avail"
              << std::setw(10) << "Oxygen"
              << std::setw(8)  << "Load"
              << "\n------------------------------------------------------------------------\n";

    std::vector<Hospital> list = system.getAllHospitals();
    for (const auto& h : list) {
        std::cout << std::left 
                  << std::setw(8)  << h.id
                  << std::setw(28) << h.name
                  << std::setw(12) << (std::to_string(h.beds_available) + " / " + std::to_string(h.beds_available + h.beds_reserved))
                  << std::setw(12) << (std::to_string(h.icu_available) + " / " + std::to_string(h.icu_available + h.icu_reserved))
                  << std::setw(10) << (h.oxygen_available ? "YES" : "NO")
                  << std::setw(8)  << (std::to_string(static_cast<int>(h.operational_load * 100)) + "%")
                  << "\n";
    }
    std::cout << "------------------------------------------------------------------------\n";
}

void runDijkstraSimulation(CoordinationSystem& system) {
    std::cout << "\n------------------------------------------------------------------------\n";
    std::cout << " [DSA: Graph & Dijkstra's Algorithm] SHORTEST AMBULANCE ROUTE PLANNING\n";
    std::cout << "------------------------------------------------------------------------\n";

    const CityGraph& graph = system.getGraph();
    std::cout << " Available City Zones in Graph Network:\n";
    for (int i = 0; i < graph.getNodeCount(); ++i) {
        std::cout << "  [" << i << "] " << graph.getNodeName(i) << "\n";
    }

    std::cout << "\nEnter Origin Node (e.g. Ambulance Location) [0-" << graph.getNodeCount() - 1 << "]: ";
    int src = 0;
    std::cin >> src;

    std::cout << "Enter Destination Node (e.g. Emergency Location) [0-" << graph.getNodeCount() - 1 << "]: ";
    int dest = 8;
    std::cin >> dest;

    DijkstraResult res = graph.computeShortestPaths(src);
    double dist = res.distances[dest];
    std::vector<int> path = res.getPath(dest);

    std::cout << "\n>>> Dijkstra Shortest Path Result:\n";
    std::cout << " From: " << graph.getNodeName(src) << " (Node " << src << ")\n";
    std::cout << " To:   " << graph.getNodeName(dest) << " (Node " << dest << ")\n";
    std::cout << " Optimal Travel Distance: " << std::fixed << std::setprecision(2) << dist << " km\n";
    std::cout << " Route Path: ";
    for (size_t i = 0; i < path.size(); ++i) {
        std::cout << graph.getNodeName(path[i]);
        if (i + 1 < path.size()) std::cout << " ➔ ";
    }
    std::cout << "\n------------------------------------------------------------------------\n";
}

void reportEmergencyInteractive(CoordinationSystem& system) {
    std::cout << "\n------------------------------------------------------------------------\n";
    std::cout << " [DSA: Priority Queue Insert] REPORT NEW EMERGENCY CASE\n";
    std::cout << "------------------------------------------------------------------------\n";

    std::string patient, caller, phone, symptoms, category, location;
    int age;

    std::cin.ignore();
    std::cout << "Patient Name: ";
    std::getline(std::cin, patient);
    std::cout << "Age: ";
    std::cin >> age;
    std::cin.ignore();
    std::cout << "Caller Name: ";
    std::getline(std::cin, caller);
    std::cout << "Caller Phone: ";
    std::getline(std::cin, phone);
    std::cout << "Category (Cardiac, Trauma, Respiratory, General): ";
    std::getline(std::cin, category);
    std::cout << "Symptoms: ";
    std::getline(std::cin, symptoms);
    std::cout << "Location: ";
    std::getline(std::cin, location);

    Emergency em = system.reportEmergency(patient, age, caller, phone, location, 8, symptoms, category);
    std::cout << "\n[SUCCESS] Emergency " << em.id << " added!\n";
    std::cout << " Triage Assessed: " << em.priority << " (Score: " << em.priority_score << "/100)\n";
    std::cout << " Successfully inserted into Binary Max-Heap Priority Queue in O(log N) time.\n";
}

void recommendHospitalsInteractive(CoordinationSystem& system) {
    std::vector<Emergency> queue = system.getTriageQueue();
    if (queue.empty()) {
        std::cout << "\nNo emergency cases available.\n";
        return;
    }

    std::cout << "\nEnter Emergency ID (e.g. " << queue[0].id << "): ";
    std::string em_id;
    std::cin >> em_id;

    auto recs = system.getHospitalRecommendations(em_id);
    if (recs.empty()) {
        std::cout << "\nNo recommendations found for ID: " << em_id << "\n";
        return;
    }

    std::cout << "\n------------------------------------------------------------------------\n";
    std::cout << " [DSA: Dijkstra + Multi-Criteria MCDA Scoring] HOSPITAL RECOMMENDATIONS\n";
    std::cout << "------------------------------------------------------------------------\n";
    for (const auto& r : recs) {
        std::cout << "Rank #" << r.rank << " | Hospital: " << r.hospital_id
                  << " | Composite Score: " << r.total_score << "/100\n";
        std::cout << "  - Route Distance: " << r.distance_km << " km (via Dijkstra)\n";
        std::cout << "  - Capability Score: " << r.capability_score << "/100\n";
        std::cout << "  - Resource Availability: " << r.resource_score << "/100\n";
        std::cout << "  - Explanation: " << r.explanation << "\n\n";
    }
}

int main(int argc, char* argv[]) {
    CoordinationSystem system;

    // Check for automatic server flag
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--server" || arg == "-s") {
            HttpServer server(8000, system);
            server.start();
            return 0;
        }
    }

    printBanner();

    int choice = -1;
    while (choice != 0) {
        std::cout << "\n========================================================================\n";
        std::cout << " [1] View Triage Priority Queue (Binary Max-Heap Demonstration)\n";
        std::cout << " [2] Ingest Emergency Incident (O(log N) Heap Insertion)\n";
        std::cout << " [3] Inspect Hospitals & Capacities (O(1) Hash Table Lookup)\n";
        std::cout << " [4] Route Planning & Shortest Path (Graph & Dijkstra's Algorithm)\n";
        std::cout << " [5] AI Hospital Recommendations (MCDA Scoring Engine)\n";
        std::cout << " [6] Dispatch Nearest Ambulance (Dijkstra Nearest-Neighbor)\n";
        std::cout << " [7] Launch C++ HTTP REST API Server (Port 8000 for React Frontend)\n";
        std::cout << " [0] Exit\n";
        std::cout << "========================================================================\n";
        std::cout << "Select an option: ";

        if (!(std::cin >> choice)) {
            std::cin.clear();
            std::cin.ignore(1000, '\n');
            continue;
        }

        switch (choice) {
            case 1:
                displayTriageQueue(system);
                break;
            case 2:
                reportEmergencyInteractive(system);
                break;
            case 3:
                displayHospitals(system);
                break;
            case 4:
                runDijkstraSimulation(system);
                break;
            case 5:
                recommendHospitalsInteractive(system);
                break;
            case 6: {
                std::vector<Emergency> queue = system.getTriageQueue();
                if (queue.empty()) {
                    std::cout << "\nNo active emergencies.\n";
                } else {
                    std::string amb = system.dispatchNearestAmbulance(queue[0].id);
                    std::cout << "\n[DISPATCHED] Assigned nearest ambulance " << amb 
                              << " to emergency " << queue[0].id << " via Dijkstra shortest path!\n";
                }
                break;
            }
            case 7: {
                HttpServer server(8000, system);
                server.start();
                break;
            }
            case 0:
                std::cout << "\nExiting SETA-HRC C++ Engine. Goodbye!\n";
                break;
            default:
                std::cout << "\nInvalid selection. Try again.\n";
                break;
        }
    }

    return 0;
}
