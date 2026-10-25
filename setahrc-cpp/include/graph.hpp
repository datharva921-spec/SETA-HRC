#ifndef SETA_GRAPH_HPP
#define SETA_GRAPH_HPP

#include <iostream>
#include <vector>
#include <queue>
#include <string>
#include <limits>
#include <algorithm>

namespace seta {

struct Edge {
    int to;
    double distance_km;
    double traffic_factor; // 1.0 = normal, 1.5 = heavy congestion
    std::string road_name;

    double getWeight() const {
        return distance_km * traffic_factor;
    }
};

struct DijkstraResult {
    std::vector<double> distances;
    std::vector<int> parent;
    int source;

    std::vector<int> getPath(int destination) const {
        std::vector<int> path;
        if (destination < 0 || destination >= static_cast<int>(distances.size()) || 
            distances[destination] == std::numeric_limits<double>::infinity()) {
            return path; // No path
        }
        for (int at = destination; at != -1; at = parent[at]) {
            path.push_back(at);
        }
        std::reverse(path.begin(), path.end());
        return path;
    }
};

/**
 * City Road Network Graph for Ambulance Routing & Hospital Dispatch.
 * Implements Dijkstra's Shortest Path Algorithm with Min-Heap Priority Queue.
 * Time Complexity: O((V + E) log V)
 * Space Complexity: O(V + E)
 */
class CityGraph {
private:
    int num_vertices;
    std::vector<std::string> node_names;
    std::vector<std::vector<Edge>> adj_list;

public:
    explicit CityGraph(int vertices = 20) : num_vertices(vertices) {
        adj_list.resize(num_vertices);
        node_names.resize(num_vertices);
        for (int i = 0; i < num_vertices; ++i) {
            node_names[i] = "Zone-" + std::to_string(i);
        }
    }

    void setNodeName(int u, const std::string& name) {
        if (u >= 0 && u < num_vertices) {
            node_names[u] = name;
        }
    }

    std::string getNodeName(int u) const {
        if (u >= 0 && u < num_vertices) {
            return node_names[u];
        }
        return "Unknown";
    }

    int getNodeCount() const { return num_vertices; }

    void addEdge(int u, int v, double distance_km, double traffic_factor = 1.0, const std::string& road = "") {
        if (u >= 0 && u < num_vertices && v >= 0 && v < num_vertices) {
            adj_list[u].push_back({v, distance_km, traffic_factor, road});
            adj_list[v].push_back({u, distance_km, traffic_factor, road}); // Bidirectional city roads
        }
    }

    // Dijkstra's Shortest Path Algorithm
    DijkstraResult computeShortestPaths(int source) const {
        DijkstraResult res;
        res.source = source;
        res.distances.assign(num_vertices, std::numeric_limits<double>::infinity());
        res.parent.assign(num_vertices, -1);

        if (source < 0 || source >= num_vertices) return res;

        // Min-heap storing pair of (current_shortest_distance, vertex)
        using DistPair = std::pair<double, int>;
        std::priority_queue<DistPair, std::vector<DistPair>, std::greater<DistPair>> pq;

        res.distances[source] = 0.0;
        pq.push({0.0, source});

        while (!pq.empty()) {
            double current_dist = pq.top().first;
            int u = pq.top().second;
            pq.pop();

            if (current_dist > res.distances[u]) {
                continue; // Stale queue entry
            }

            for (const auto& edge : adj_list[u]) {
                int v = edge.to;
                double weight = edge.getWeight();

                if (res.distances[u] + weight < res.distances[v]) {
                    res.distances[v] = res.distances[u] + weight;
                    res.parent[v] = u;
                    pq.push({res.distances[v], v});
                }
            }
        }

        return res;
    }
};

} // namespace seta

#endif // SETA_GRAPH_HPP
