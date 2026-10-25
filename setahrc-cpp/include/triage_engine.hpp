#ifndef SETA_TRIAGE_ENGINE_HPP
#define SETA_TRIAGE_ENGINE_HPP

#include "models.hpp"
#include "graph.hpp"
#include <string>
#include <vector>
#include <cmath>
#include <algorithm>
#include <sstream>
#include <iomanip>

namespace seta {

class TriageEngine {
public:
    struct TriageAssessment {
        std::string priority;
        int priority_score;
        std::string priority_reason;
    };

    static TriageAssessment assess(const std::string& symptoms, const std::string& category, int age) {
        std::string s_lower = symptoms;
        std::transform(s_lower.begin(), s_lower.end(), s_lower.begin(), ::tolower);

        // Critical detection
        if (s_lower.find("cardiac") != std::string::npos ||
            s_lower.find("heart attack") != std::string::npos ||
            s_lower.find("chest pain") != std::string::npos ||
            s_lower.find("unresponsive") != std::string::npos ||
            s_lower.find("stroke") != std::string::npos ||
            s_lower.find("bleeding heavily") != std::string::npos ||
            s_lower.find("not breathing") != std::string::npos ||
            s_lower.find("severe trauma") != std::string::npos) {
            int score = 95;
            if (age > 65 || age < 5) score += 4; // vulnerable age adjustment
            return {"Critical", std::min(100, score), "Life-threatening acute presentation requiring immediate Level 1 resuscitation and critical care response."};
        }

        // High priority detection
        if (s_lower.find("fracture") != std::string::npos ||
            s_lower.find("asthma") != std::string::npos ||
            s_lower.find("high fever") != std::string::npos ||
            s_lower.find("difficulty breathing") != std::string::npos ||
            s_lower.find("burn") != std::string::npos ||
            category == "Trauma" || category == "Respiratory") {
            int score = 75;
            if (age > 65) score += 5;
            return {"High", score, "Urgent clinical scenario with potential rapid deterioration risk."};
        }

        // Moderate priority detection
        if (s_lower.find("pain") != std::string::npos ||
            s_lower.find("vomiting") != std::string::npos ||
            s_lower.find("fever") != std::string::npos ||
            s_lower.find("dizziness") != std::string::npos) {
            return {"Moderate", 50, "Stable vitals requiring timely medical evaluation and symptom control."};
        }

        // Low priority fallback
        return {"Low", 25, "Non-critical condition suitable for routine urgent-care assessment."};
    }

    // Multi-Criteria Decision Analysis (MCDA) Scoring Algorithm
    static HospitalRecommendation scoreHospital(
        const Emergency& emergency,
        const Hospital& hospital,
        double shortest_path_km,
        const std::vector<int>& path_nodes
    ) {
        HospitalRecommendation rec;
        rec.emergency_id = emergency.id;
        rec.hospital_id = hospital.id;
        rec.distance_km = shortest_path_km;
        rec.shortest_path_nodes = path_nodes;

        // 1. Capability Score (0 to 100)
        double cap_score = 70.0;
        for (const auto& cap : hospital.capabilities) {
            if (emergency.category == "Cardiac" && cap == "CathLab") cap_score = 100.0;
            if (emergency.category == "Trauma" && cap == "TraumaCenter") cap_score = 100.0;
            if (emergency.category == "Neurology" && cap == "StrokeUnit") cap_score = 100.0;
            if (emergency.category == "Pediatrics" && cap == "Pediatrics") cap_score = 100.0;
        }

        // 2. Resource Score (0 to 100)
        double res_score = 0.0;
        if (emergency.priority == "Critical") {
            if (hospital.icu_available > 0) res_score += 60.0;
            if (hospital.oxygen_available) res_score += 40.0;
        } else {
            if (hospital.beds_available > 2) res_score += 70.0;
            else if (hospital.beds_available > 0) res_score += 40.0;
            if (hospital.oxygen_available) res_score += 30.0;
        }

        // 3. Distance Score (0 to 100) - Inversely proportional to road distance
        double dist_score = std::max(0.0, 100.0 - (shortest_path_km * 4.5));

        // 4. Load Score (0 to 100) - Higher score for hospitals with lower operational congestion
        double load_score = (1.0 - std::min(1.0, hospital.operational_load)) * 100.0;

        // Weighted Composite Score
        // Weight distribution: Capability: 35%, Resources: 30%, Distance: 25%, Load: 10%
        double total = (0.35 * cap_score) + (0.30 * res_score) + (0.25 * dist_score) + (0.10 * load_score);

        rec.total_score = std::round(total * 10.0) / 10.0;
        rec.capability_score = std::round(cap_score * 10.0) / 10.0;
        rec.resource_score = std::round(res_score * 10.0) / 10.0;
        rec.distance_score = std::round(dist_score * 10.0) / 10.0;
        rec.load_score = std::round(load_score * 10.0) / 10.0;

        std::stringstream ss;
        ss << "Score " << rec.total_score << "/100: " 
           << shortest_path_km << " km transit via Dijkstra shortest route. ";
        if (hospital.icu_available > 0) ss << "ICU available (" << hospital.icu_available << " open). ";
        if (hospital.beds_available > 0) ss << "General beds available (" << hospital.beds_available << "). ";
        ss << "Current load: " << static_cast<int>(hospital.operational_load * 100.0) << "%.";
        rec.explanation = ss.str();
        rec.status = "Proposed";

        return rec;
    }
};

} // namespace seta

#endif // SETA_TRIAGE_ENGINE_HPP
