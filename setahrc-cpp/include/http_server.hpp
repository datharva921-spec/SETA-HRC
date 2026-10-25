#ifndef SETA_HTTP_SERVER_HPP
#define SETA_HTTP_SERVER_HPP

#include "coordination_system.hpp"
#include "json_helper.hpp"

#include <iostream>
#include <string>
#include <sstream>
#include <vector>
#include <winsock2.h>
#include <ws2tcpip.h>

#pragma comment(lib, "ws2_32.lib")

namespace seta {

class HttpServer;

struct ClientThreadContext {
    HttpServer* server;
    SOCKET client_socket;
};

class HttpServer {
private:
    int port;
    CoordinationSystem& system;
    volatile bool is_running;
    SOCKET listen_socket;

    static DWORD WINAPI clientThreadRunner(LPVOID param) {
        ClientThreadContext* ctx = static_cast<ClientThreadContext*>(param);
        if (ctx) {
            ctx->server->handleClient(ctx->client_socket);
            delete ctx;
        }
        return 0;
    }

    std::string buildResponse(int status_code, const std::string& status_text, const std::string& content_type, const std::string& body) {
        std::stringstream ss;
        ss << "HTTP/1.1 " << status_code << " " << status_text << "\r\n"
           << "Content-Type: " << content_type << "\r\n"
           << "Content-Length: " << body.length() << "\r\n"
           << "Access-Control-Allow-Origin: *\r\n"
           << "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n"
           << "Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With\r\n"
           << "Connection: close\r\n\r\n"
           << body;
        return ss.str();
    }

    void handleClient(SOCKET client_socket) {
        char buffer[8192];
        int bytes_received = recv(client_socket, buffer, sizeof(buffer) - 1, 0);
        if (bytes_received <= 0) {
            closesocket(client_socket);
            return;
        }
        buffer[bytes_received] = '\0';
        std::string raw_request(buffer);

        // Parse Request Line
        std::stringstream ss(raw_request);
        std::string method, path, http_ver;
        ss >> method >> path >> http_ver;

        // Extract body
        std::string body;
        size_t header_end = raw_request.find("\r\n\r\n");
        if (header_end != std::string::npos) {
            body = raw_request.substr(header_end + 4);
        }

        std::string response;

        // 1. CORS Preflight
        if (method == "OPTIONS") {
            response = buildResponse(200, "OK", "text/plain", "");
        }
        // 2. Health check
        else if (path == "/healthz" || path == "/api/healthz" || path == "/") {
            response = buildResponse(200, "OK", "application/json", "{\"status\":\"ok\",\"service\":\"SETA-HRC C++ Backend\",\"version\":\"1.0.0\"}");
        }
        // 3. Auth login
        else if (method == "POST" && path == "/api/auth/login") {
            std::string email = JsonHelper::extractField(body, "email");
            std::string password = JsonHelper::extractField(body, "password");
            const User* user = system.authenticate(email, password);

            if (user) {
                std::stringstream resp;
                resp << "{"
                     << "\"access_token\":\"cpp_jwt_demo_token_" << user->id << "\","
                     << "\"token_type\":\"bearer\","
                     << "\"user\":{"
                     << "\"id\":\"" << user->id << "\","
                     << "\"name\":\"" << user->name << "\","
                     << "\"email\":\"" << user->email << "\","
                     << "\"trusted_role\":\"" << user->role << "\","
                     << "\"status\":\"" << user->status << "\","
                     << "\"hospital_id\":" << (user->hospital_id.empty() ? "null" : ("\"" + user->hospital_id + "\""))
                     << "}}";
                response = buildResponse(200, "OK", "application/json", resp.str());
            } else {
                response = buildResponse(401, "Unauthorized", "application/json", "{\"detail\":\"Invalid email or password\"}");
            }
        }
        // 4. Get Emergencies (Triage Priority Queue)
        else if (method == "GET" && path.find("/api/emergencies") == 0 && path.find("/recommendations") == std::string::npos) {
            std::vector<Emergency> queue = system.getTriageQueue();
            std::stringstream resp;
            resp << "[";
            for (size_t i = 0; i < queue.size(); ++i) {
                resp << JsonHelper::toJson(queue[i]) << (i + 1 < queue.size() ? "," : "");
            }
            resp << "]";
            response = buildResponse(200, "OK", "application/json", resp.str());
        }
        // 5. Post New Emergency
        else if (method == "POST" && path == "/api/emergencies") {
            std::string patient_name = JsonHelper::extractField(body, "patient_name");
            std::string raw_age = JsonHelper::extractField(body, "age");
            int age = raw_age.empty() ? 30 : std::stoi(raw_age);
            std::string caller_name = JsonHelper::extractField(body, "caller_name");
            std::string phone = JsonHelper::extractField(body, "phone");
            std::string location = JsonHelper::extractField(body, "location");
            std::string symptoms = JsonHelper::extractField(body, "symptoms");
            std::string category = JsonHelper::extractField(body, "category");

            Emergency em = system.reportEmergency(patient_name, age, caller_name, phone, location, 0, symptoms, category);
            response = buildResponse(201, "Created", "application/json", JsonHelper::toJson(em));
        }
        // 6. Get Hospitals
        else if (method == "GET" && path == "/api/hospitals") {
            std::vector<Hospital> hospitals = system.getAllHospitals();
            std::stringstream resp;
            resp << "[";
            for (size_t i = 0; i < hospitals.size(); ++i) {
                resp << JsonHelper::toJson(hospitals[i]) << (i + 1 < hospitals.size() ? "," : "");
            }
            resp << "]";
            response = buildResponse(200, "OK", "application/json", resp.str());
        }
        // 7. Get Ambulances
        else if (method == "GET" && path == "/api/ambulances") {
            std::vector<Ambulance> ambulances = system.getAllAmbulances();
            std::stringstream resp;
            resp << "[";
            for (size_t i = 0; i < ambulances.size(); ++i) {
                resp << JsonHelper::toJson(ambulances[i]) << (i + 1 < ambulances.size() ? "," : "");
            }
            resp << "]";
            response = buildResponse(200, "OK", "application/json", resp.str());
        }
        // 8. Hospital Recommendations via Dijkstra & MCDA
        else if (method == "POST" && path.find("/api/emergencies/") == 0 && path.find("/recommendations") != std::string::npos) {
            size_t start = std::string("/api/emergencies/").length();
            size_t end = path.find("/recommendations");
            std::string em_id = path.substr(start, end - start);

            auto recs = system.getHospitalRecommendations(em_id);
            std::stringstream resp;
            resp << "[";
            for (size_t i = 0; i < recs.size(); ++i) {
                resp << JsonHelper::toJson(recs[i]) << (i + 1 < recs.size() ? "," : "");
            }
            resp << "]";
            response = buildResponse(200, "OK", "application/json", resp.str());
        }
        // 9. Assign/Dispatch Ambulance
        else if (method == "POST" && (path == "/api/ambulances/assign" || path == "/ambulances/assign")) {
            std::string emergency_id = JsonHelper::extractField(body, "emergency_id");
            std::string ambulance_id = JsonHelper::extractField(body, "ambulance_id");
            std::string assigned = system.dispatchNearestAmbulance(emergency_id, ambulance_id);
            if (!assigned.empty()) {
                response = buildResponse(200, "OK", "application/json", "{\"status\":\"Dispatched\",\"ambulance_id\":\"" + assigned + "\"}");
            } else {
                response = buildResponse(400, "Bad Request", "application/json", "{\"detail\":\"Could not dispatch ambulance\"}");
            }
        }
        // 10. Referral Decision
        else if (method == "POST" && path.find("/api/referrals/") == 0 && path.find("/decision") != std::string::npos) {
            size_t start = std::string("/api/referrals/").length();
            size_t end = path.find("/decision");
            std::string em_id = path.substr(start, end - start);

            std::string decision = JsonHelper::extractField(body, "decision");
            std::string hospital_id = JsonHelper::extractField(body, "hospital_id");
            std::string reserve_icu = JsonHelper::extractField(body, "reserve_icu");
            bool is_icu = (reserve_icu == "true");

            bool ok = system.recordReferralDecision(em_id, hospital_id, decision, is_icu);
            if (ok) {
                response = buildResponse(200, "OK", "application/json", "{\"status\":\"Success\",\"decision\":\"" + decision + "\"}");
            } else {
                response = buildResponse(400, "Bad Request", "application/json", "{\"detail\":\"Failed to record referral\"}");
            }
        }
        // 11. Analytics Summary
        else if (method == "GET" && path == "/api/analytics/summary") {
            response = buildResponse(200, "OK", "application/json", "{\"total_emergencies\":14,\"average_response_time_minutes\":8.4,\"hospital_occupancy_pct\":58.2,\"ambulances_in_field\":2}");
        }
        // Fallback 404
        else {
            response = buildResponse(404, "Not Found", "application/json", "{\"detail\":\"Endpoint not found\"}");
        }

        send(client_socket, response.c_str(), static_cast<int>(response.length()), 0);
        closesocket(client_socket);
    }

public:
    HttpServer(int p, CoordinationSystem& sys) 
        : port(p), system(sys), is_running(false), listen_socket(INVALID_SOCKET) {}

    ~HttpServer() {
        stop();
    }

    void start() {
        WSADATA wsaData;
        int res = WSAStartup(MAKEWORD(2, 2), &wsaData);
        if (res != 0) {
            std::cerr << "[ERROR] WSAStartup failed: " << res << std::endl;
            return;
        }

        listen_socket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
        if (listen_socket == INVALID_SOCKET) {
            std::cerr << "[ERROR] socket failed: " << WSAGetLastError() << std::endl;
            WSACleanup();
            return;
        }

        // Allow address reuse
        int opt = 1;
        setsockopt(listen_socket, SOL_SOCKET, SO_REUSEADDR, (const char*)&opt, sizeof(opt));

        sockaddr_in server_addr;
        server_addr.sin_family = AF_INET;
        server_addr.sin_addr.s_addr = INADDR_ANY;
        server_addr.sin_port = htons(port);

        if (bind(listen_socket, (sockaddr*)&server_addr, sizeof(server_addr)) == SOCKET_ERROR) {
            std::cerr << "[ERROR] bind failed on port " << port << ": " << WSAGetLastError() << std::endl;
            closesocket(listen_socket);
            WSACleanup();
            return;
        }

        if (listen(listen_socket, SOMAXCONN) == SOCKET_ERROR) {
            std::cerr << "[ERROR] listen failed: " << WSAGetLastError() << std::endl;
            closesocket(listen_socket);
            WSACleanup();
            return;
        }

        is_running = true;
        std::cout << "========================================================\n";
        std::cout << " SETA-HRC C++ REST API Server LIVE on http://localhost:" << port << "\n";
        std::cout << " Serving React Frontend at http://localhost:3000\n";
        std::cout << " Press Ctrl+C or enter 'q' to stop server.\n";
        std::cout << "========================================================\n" << std::endl;

        while (is_running) {
            SOCKET client_socket = accept(listen_socket, NULL, NULL);
            if (client_socket == INVALID_SOCKET) {
                if (!is_running) break;
                continue;
            }
            ClientThreadContext* ctx = new ClientThreadContext{this, client_socket};
            HANDLE hThread = CreateThread(NULL, 0, clientThreadRunner, ctx, 0, NULL);
            if (hThread) {
                CloseHandle(hThread);
            } else {
                handleClient(client_socket);
                delete ctx;
            }
        }
    }

    void stop() {
        if (is_running) {
            is_running = false;
            if (listen_socket != INVALID_SOCKET) {
                closesocket(listen_socket);
                listen_socket = INVALID_SOCKET;
            }
            WSACleanup();
        }
    }
};

} // namespace seta

#endif // SETA_HTTP_SERVER_HPP
