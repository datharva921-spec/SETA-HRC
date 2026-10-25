#ifndef SETA_JSON_HELPER_HPP
#define SETA_JSON_HELPER_HPP

#include "models.hpp"
#include <string>
#include <vector>
#include <sstream>
#include <iomanip>

namespace seta {

class JsonHelper {
public:
    static std::string escapeString(const std::string& str) {
        std::stringstream ss;
        for (char c : str) {
            if (c == '"') ss << "\\\"";
            else if (c == '\\') ss << "\\\\";
            else if (c == '\b') ss << "\\b";
            else if (c == '\f') ss << "\\f";
            else if (c == '\n') ss << "\\n";
            else if (c == '\r') ss << "\\r";
            else if (c == '\t') ss << "\\t";
            else ss << c;
        }
        return ss.str();
    }

    static std::string extractField(const std::string& json, const std::string& field) {
        std::string search = "\"" + field + "\"";
        size_t pos = json.find(search);
        if (pos == std::string::npos) return "";

        size_t colon_pos = json.find(':', pos + search.length());
        if (colon_pos == std::string::npos) return "";

        size_t start_val = json.find_first_not_of(" \t\n\r", colon_pos + 1);
        if (start_val == std::string::npos) return "";

        if (json[start_val] == '"') {
            size_t end_val = json.find('"', start_val + 1);
            if (end_val == std::string::npos) return "";
            return json.substr(start_val + 1, end_val - start_val - 1);
        } else {
            size_t end_val = json.find_first_of(",}\n\r", start_val);
            if (end_val == std::string::npos) end_val = json.length();
            std::string raw = json.substr(start_val, end_val - start_val);
            while (!raw.empty() && (raw.back() == ' ' || raw.back() == '\t')) raw.pop_back();
            return raw;
        }
    }

    static std::string toJson(const Hospital& h) {
        std::stringstream ss;
        ss << "{"
           << "\"id\":\"" << escapeString(h.id) << "\","
           << "\"name\":\"" << escapeString(h.name) << "\","
           << "\"location\":\"" << escapeString(h.location) << "\","
           << "\"lat\":" << h.lat << ","
           << "\"lng\":" << h.lng << ","
           << "\"distance_km\":" << h.distance_km << ","
           << "\"beds_available\":" << h.beds_available << ","
           << "\"beds_reserved\":" << h.beds_reserved << ","
           << "\"beds_unavailable\":" << h.beds_unavailable << ","
           << "\"icu_available\":" << h.icu_available << ","
           << "\"icu_reserved\":" << h.icu_reserved << ","
           << "\"icu_unavailable\":" << h.icu_unavailable << ","
           << "\"oxygen_available\":" << (h.oxygen_available ? "true" : "false") << ","
           << "\"status\":\"" << escapeString(h.status) << "\","
           << "\"operational_load\":" << h.operational_load << ","
           << "\"capabilities\":[";
        for (size_t i = 0; i < h.capabilities.size(); ++i) {
            ss << "\"" << escapeString(h.capabilities[i]) << "\"" << (i + 1 < h.capabilities.size() ? "," : "");
        }
        ss << "],\"departments\":[";
        for (size_t i = 0; i < h.departments.size(); ++i) {
            ss << "\"" << escapeString(h.departments[i]) << "\"" << (i + 1 < h.departments.size() ? "," : "");
        }
        ss << "],\"department_availability\":[]}";
        return ss.str();
    }

    static std::string toJson(const Ambulance& a) {
        std::stringstream ss;
        ss << "{"
           << "\"id\":\"" << escapeString(a.id) << "\","
           << "\"unit\":\"" << escapeString(a.unit) << "\","
           << "\"status\":\"" << escapeString(a.status) << "\","
           << "\"paramedic_name\":\"" << escapeString(a.paramedic_name) << "\","
           << "\"location\":\"" << escapeString(a.location) << "\","
           << "\"lat\":" << a.lat << ","
           << "\"lng\":" << a.lng << ","
           << "\"assigned_emergency_id\":" << (a.assigned_emergency_id.empty() ? "null" : ("\"" + escapeString(a.assigned_emergency_id) + "\""))
           << "}";
        return ss.str();
    }

    static std::string toJson(const Emergency& e) {
        std::stringstream ss;
        ss << "{"
           << "\"id\":\"" << escapeString(e.id) << "\","
           << "\"patient_name\":\"" << escapeString(e.patient_name) << "\","
           << "\"age\":" << e.age << ","
           << "\"caller_name\":\"" << escapeString(e.caller_name) << "\","
           << "\"phone\":\"" << escapeString(e.phone) << "\","
           << "\"location\":\"" << escapeString(e.location) << "\","
           << "\"lat\":" << e.lat << ","
           << "\"lng\":" << e.lng << ","
           << "\"coordinates_provided\":" << (e.coordinates_provided ? "true" : "false") << ","
           << "\"symptoms\":\"" << escapeString(e.symptoms) << "\","
           << "\"category\":\"" << escapeString(e.category) << "\","
           << "\"priority\":\"" << escapeString(e.priority) << "\","
           << "\"priority_reason\":\"" << escapeString(e.priority_reason) << "\","
           << "\"status\":\"" << escapeString(e.status) << "\","
           << "\"assigned_ambulance_id\":" << (e.assigned_ambulance_id.empty() ? "null" : ("\"" + escapeString(e.assigned_ambulance_id) + "\"")) << ","
           << "\"recommended_hospital_id\":" << (e.recommended_hospital_id.empty() ? "null" : ("\"" + escapeString(e.recommended_hospital_id) + "\"")) << ","
           << "\"approval_status\":" << (e.approval_status.empty() ? "null" : ("\"" + escapeString(e.approval_status) + "\"")) << ","
           << "\"approval_reason\":" << (e.approval_reason.empty() ? "null" : ("\"" + escapeString(e.approval_reason) + "\"")) << ","
           << "\"handover_notes\":" << (e.handover_notes.empty() ? "null" : ("\"" + escapeString(e.handover_notes) + "\"")) << ","
           << "\"created_at\":\"" << escapeString(e.created_at) << "\","
           << "\"history\":[";
        for (size_t i = 0; i < e.history.size(); ++i) {
            ss << "{"
               << "\"at\":\"" << escapeString(e.history[i].at) << "\","
               << "\"event\":\"" << escapeString(e.history[i].event) << "\","
               << "\"actor\":\"" << escapeString(e.history[i].actor) << "\""
               << "}" << (i + 1 < e.history.size() ? "," : "");
        }
        ss << "]}";
        return ss.str();
    }

    static std::string toJson(const HospitalRecommendation& r) {
        std::stringstream ss;
        ss << "{"
           << "\"emergency_id\":\"" << escapeString(r.emergency_id) << "\","
           << "\"hospital_id\":\"" << escapeString(r.hospital_id) << "\","
           << "\"rank\":" << r.rank << ","
           << "\"total_score\":" << r.total_score << ","
           << "\"capability_score\":" << r.capability_score << ","
           << "\"resource_score\":" << r.resource_score << ","
           << "\"distance_score\":" << r.distance_score << ","
           << "\"load_score\":" << r.load_score << ","
           << "\"distance_km\":" << r.distance_km << ","
           << "\"explanation\":\"" << escapeString(r.explanation) << "\","
           << "\"missing_data_flags\":[],"
           << "\"status\":\"" << escapeString(r.status) << "\""
           << "}";
        return ss.str();
    }
};

} // namespace seta

#endif // SETA_JSON_HELPER_HPP
