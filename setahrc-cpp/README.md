# SETA-HRC: C++ Data Structures & Algorithms Engine

A high-performance C++ implementation of the **Smart Emergency Triage, Ambulance & Hospital Resource Coordination System (SETA-HRC)**, engineered for Data Structures & Algorithms (DSA) Course Project demonstration.

---

## 🎯 Dual Execution Modes

This project supports two operational modes:

1. **Interactive CLI Mode (`run_cli.bat`)**:
   - Menu-driven console interface designed for academic evaluation, code walkthroughs, and viva demonstrations.
   - Allows evaluators to visually inspect the Max-Heap, run Dijkstra's algorithm step-by-step, and test hash table lookups.

2. **HTTP REST API Server Mode (`run_server.bat` or `--server`)**:
   - Embedded high-speed C++ Winsock HTTP/1.1 REST API server running on port `8000`.
   - Directly powers the React web frontend (`http://localhost:3000`) with zero Python dependency.

---

## 🧠 Data Structures & Algorithms (DSA) Architecture

### 1. Hash Table with Separate Chaining (`include/hash_table.hpp`)
* **Purpose**: Fast indexing and retrieval of Hospitals, Ambulances, and User accounts.
* **Mechanism**: 
  - Uses a **polynomial rolling hash function** for string keys ($p=31, m=10^9+9$).
  - Implements **Separate Chaining (Linked Lists)** to handle hash collisions.
  - Implements **Dynamic Rehashing**: Doubles table capacity when load factor exceeds $0.75$.
* **Time Complexity**:
  - Search: $\mathcal{O}(1)$ average, $\mathcal{O}(N)$ worst case.
  - Insertion: $\mathcal{O}(1)$ amortized.
  - Deletion: $\mathcal{O}(1)$ average.

### 2. City Road Graph & Dijkstra's Algorithm (`include/graph.hpp`)
* **Purpose**: Computes optimal ambulance dispatch routes and transit distances to hospitals under dynamic traffic conditions.
* **Mechanism**:
  - City road network represented as a **Weighted Graph (Adjacency List)**.
  - Edge weights incorporate real-time **traffic congestion multipliers** ($\text{Weight} = \text{Distance} \times \text{TrafficFactor}$).
  - Computes single-source shortest path using **Dijkstra's Algorithm** with a Min-Heap priority queue.
* **Time Complexity**: $\mathcal{O}((V + E) \log V)$
* **Space Complexity**: $\mathcal{O}(V + E)$

### 3. Binary Max-Heap Triage Priority Queue (`include/priority_queue.hpp`)
* **Purpose**: Ensures patients with life-threatening conditions (Cardiac, Trauma, Stroke) are attended to immediately before lower-urgency cases.
* **Mechanism**:
  - Implements a custom **Array-based Binary Max-Heap**.
  - Emergency clinical severity mapped to numeric priority scores ($100$ for Critical down to $25$ for Low).
  - Uses `heapifyUp` on insertion and `heapifyDown` on extraction.
* **Time Complexity**:
  - Enqueue (`push`): $\mathcal{O}(\log N)$
  - Dequeue Highest Priority (`pop`): $\mathcal{O}(\log N)$
  - Inspect Next Patient (`top`): $\mathcal{O}(1)$

### 4. Multi-Criteria Decision Analysis (MCDA) Scoring (`include/triage_engine.hpp`)
* **Purpose**: Evaluates and ranks destination hospitals for incoming emergency incidents.
* **Algorithm**:
  $$\text{Score} = 0.35 \times C + 0.30 \times R + 0.25 \times D + 0.10 \times (1 - L)$$
  - $C$: Clinical capability match (Trauma Center, Cath Lab, Stroke Unit).
  - $R$: Live bed/ICU/Oxygen availability.
  - $D$: Transit distance derived from **Dijkstra's shortest path**.
  - $L$: Current hospital operational congestion load.

### 5. Thread-Safe Resource Reservation (`include/coordination_system.hpp`)
* **Purpose**: Guarantees zero race conditions when concurrent ambulances or hospitals reserve scarce emergency beds or ICU units.
* **Mechanism**: Protected by Win32 Critical Sections / Mutex locks.

---

## 🚀 How to Build & Run

### Method 1: Using Batch Scripts (Instant One-Click)
1. **Build**: Double-click `build.bat` (uses `g++ -std=c++14 -O2`).
2. **Interactive CLI**: Double-click `run_cli.bat`.
3. **Web API Server**: Double-click `run_server.bat` (serves `http://localhost:8000`).

### Method 2: Command Line (MinGW / GCC)
```powershell
cd setahrc-cpp
g++ -std=c++14 -O2 -Iinclude src/main.cpp -o bin/setahrc.exe -lws2_32
.\bin\setahrc.exe          # Interactive CLI
.\bin\setahrc.exe --server # REST API Server mode
```

---

## 📡 REST API Compatibility (For React Frontend)

When running in server mode, `setahrc.exe` responds to:
* `GET  /api/healthz` - Health check status
* `POST /api/auth/login` - User authentication (Dispatcher, Hospital, Paramedic, Admin)
* `GET  /api/emergencies` - Priority Queue ordered triage list
* `POST /api/emergencies` - Triage intake & heap insertion
* `GET  /api/hospitals` - Hospital resource table
* `GET  /api/ambulances` - Ambulance status & locations
* `POST /api/emergencies/{id}/recommendations` - Dijkstra + MCDA hospital ranking
* `POST /api/ambulances/assign` - Dispatch nearest ambulance via Dijkstra
* `POST /api/referrals/{id}/decision` - Hospital bed/ICU allocation
* `GET  /api/analytics/summary` - Performance metrics

---

## 📂 Project Structure
```
setahrc-cpp/
├── include/
│   ├── models.hpp              # Data structures (Hospital, Ambulance, Emergency, User)
│   ├── hash_table.hpp          # Custom Hash Table with Separate Chaining
│   ├── priority_queue.hpp      # Custom Binary Max-Heap for Triage
│   ├── graph.hpp               # City Graph & Dijkstra's Algorithm
│   ├── triage_engine.hpp       # Triage scoring & MCDA recommendation logic
│   ├── coordination_system.hpp # Master coordination orchestrator
│   ├── http_server.hpp         # Winsock HTTP/1.1 REST Server & CORS handler
│   └── json_helper.hpp         # Zero-dependency JSON serializer
├── src/
│   └── main.cpp                # Dual-mode CLI & Server entry point
├── bin/
│   └── setahrc.exe             # Compiled 273 KB standalone executable
├── CMakeLists.txt              # Standard CMake configuration
├── build.bat                   # Compile script
├── run_cli.bat                 # Interactive CLI launcher
└── run_server.bat              # Web API server launcher
```
