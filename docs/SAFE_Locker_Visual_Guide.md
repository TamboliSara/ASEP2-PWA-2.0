# SAFE Locker: Visual & Logic Guide

This document provides visual flowcharts, sequence diagrams, and architecture maps to help developers, designers, and stakeholders quickly understand the SAFE system's logic and structural data flow.

---

## 1. High-Level System Architecture

This graph illustrates how the React frontend, the split-database Firebase cloud, and the ESP32 hardware interact with each other.

```mermaid
graph TD
    subgraph Frontend ["PWA (React + Vite)"]
        UI["User Interface & Dashboards"]
        BLE["Web Bluetooth API"]
    end

    subgraph Cloud ["Firebase Backend"]
        RTDB[("Realtime Database (IoT)")]
        Firestore[("Firestore (Persistent)")]
        CF["Cloud Functions"]
    end

    subgraph Hardware ["SAFE Hardware Node"]
        ESP32["ESP32-S3 Microcontroller"]
        Sensors["Sensors: Temp, Hum, VOC"]
        Actuators["Actuators: Solenoid Relay"]
    end

    %% Frontend to Cloud Connections
    UI -- "Listens/Writes" --> RTDB
    UI -- "Queries/Writes" --> Firestore
    UI -- "Calls HTTP Triggers" --> CF
    UI -- "Direct Control (Offline)" --> BLE

    %% Frontend to Hardware Connection
    BLE <--> ESP32

    %% Hardware to Cloud Connections
    ESP32 -- "Pushes Telemetry & Status" --> RTDB
    ESP32 -- "Listens for Commands" --> RTDB
    ESP32 -- "Reads" --> Sensors
    ESP32 -- "Controls" --> Actuators

    %% Internal Cloud Connections
    CF -- "Issues Overrides" --> RTDB
    CF -- "Saves Event Logs" --> Firestore
    RTDB -- "Triggers Functions" --> CF
```

---

## 2. Hardware Setup & Connectivity (The Guard Engine)

Before any operation, the PWA must establish a trusted local Bluetooth connection to the hardware and register it in the cloud.

```mermaid
sequenceDiagram
    participant User
    participant PWA
    participant ESP32 as ESP32 (Hardware)
    participant Cloud as Firebase RTDB

    User->>PWA: Clicks "Connect to Locker"
    PWA->>ESP32: Initiates Web Bluetooth Scan
    ESP32-->>PWA: Broadcasts 'ec0-0001' Service Signature
    PWA->>ESP32: Establishes BLE Handshake
    PWA->>Cloud: Calls registerDevice(MAC Address)
    Cloud-->>PWA: Instantiates Telemetry, Status & Command Paths
    PWA-->>User: Confirms "Connection Successful"
    PWA->>User: Navigates to Hub Page
```

---

## 3. The Donor Deposit Flow (Input Engine)

This sequence shows the path when a user donates food. It requires cloud orchestration followed by a physical hardware actuation loop.

```mermaid
sequenceDiagram
    participant User
    participant App as PWA UI
    participant CF as Cloud Function (initiateDeposit)
    participant RTDB as RTDB (Commands/Status)
    participant FS as Firestore (Donations/Events)
    participant ESP as ESP32 Hardware

    User->>App: Submits Food Details (Name, Dietary Tags)
    App->>CF: Invoke initiateDeposit(Payload)
    
    CF->>FS: Create new 'donations' document
    CF->>RTDB: Write "UNLOCK" command to queue
    CF->>RTDB: Update device status to 'processing'
    CF-->>App: Return success response
    App-->>User: Prompt: "Please open the locker"
    
    RTDB->>ESP: Hardware detects new "UNLOCK" command
    ESP->>ESP: Fires Solenoid to Unlock Door
    User->>ESP: Places food, closes door
        ESP->>RTDB: Update lock_state: 'locked', occupancy: 'occupied'
    ESP->>RTDB: Updates command to 'acknowledged: true'
    
    RTDB->>CF: Cloud Trigger (onCommandAck)
    CF->>FS: Log permanent "Deposit Success" event
```

---

## 4. Telemetry & Spoilage Logic (The Intelligence Engine)

This flowchart explains how real-time sensor data is translated into UI feedback and safety protocols.

```mermaid
graph TD
    Start((Power On)) --> ReadSensors[ESP32 Polls: Temp, Humidity, VOC]
    ReadSensors --> PushRTDB[ESP32 Pushes to RTDB 'telemetry']
    
    PushRTDB --> PWAListens[PWA Updates UI Dashboards]
    PushRTDB --> CloudTrigger[Cloud Trigger: onTelemetryWrite]
    
    %% PWA Side Logic
    PWAListens --> CalcQI[PWA Recalculates Quality Index %]
    CalcQI --> UpdateGauges[Chart.js Gauges Animate]
    
    %% Cloud Side Logic
    CloudTrigger --> CheckSpoilage{"Are sensors beyond safe limits? (e.g. Temp > 8°C)"}
    
    CheckSpoilage -- Yes --> AlertCreated[Create 'alert' document in Firestore]
    AlertCreated --> IsCritical{"Is it a Critical Spoilage Risk?"}
    
    IsCritical -- Yes --> Quarantine[Write "LOCK" command to RTDB]
    Quarantine --> UIUpdate["UI forces Safety Lockdown / Restricted state"]
    IsCritical -- No --> Warning[Log warning, continue standard operations]
    
    CheckSpoilage -- No --> SaveSnapshot[Periodic: Save snapshot to Firestore for analysis]
```

---

## 5. Receiver Retrieval Flow

This state diagram illustrates the logic branches when a receiver approaches to take food.

```mermaid
stateDiagram-v2
    [*] --> KioskDashboard: User views Dashboard
    
    KioskDashboard --> EvaluateSafety: User clicks "Slide to Retrieve"
    
    state EvaluateSafety {
        [*] --> CheckQualityIndex
        CheckQualityIndex --> Safe: QI is >= 30%
        CheckQualityIndex --> Spoiled: QI is < 30%
    }
    
    Spoiled --> SafetyLockdown: Retrieval Button Disabled
    SafetyLockdown --> AdminIntervention: Requires Admin App "Force Open"
    
    Safe --> CloudArchiving: App invokes initiateRetrieval()
    CloudArchiving --> HardwareUnlock: Cloud writes UNLOCK to RTDB
    HardwareUnlock --> UserRetrieves: Solenoid releases
    UserRetrieves --> ResetState: Door closes, chamber resets
    ResetState --> [*]: Locker ready for new donation
```

---

## 6. Admin Control & Fleet Ops (Command Engine)

The high-level data flow for the Administrative map and controls.

```mermaid
graph LR
    subgraph Admin Interface [Admin Dashboard V2]
        Map[Geospatial Fleet Map]
        Diag[Live Diagnostics Console]
        Manual[Manual Override Panel]
    end
    
    subgraph Cloud Storage [Firebase]
        FS_Donations[("Firestore: Donations")]
        FS_Alerts[("Firestore: Alerts")]
        RTDB_Cmds[("RTDB: Commands Queue")]
        RTDB_Tel[("RTDB: Live Telemetry")]
    end
    
    FS_Donations -->|"Plots Active Lockers"| Map
    FS_Alerts -->|"Paints Warning Pins (Red)"| Map
    RTDB_Tel -->|"Streams Sensor Health"| Diag
    
    Manual -->|"Force Unlock"| RTDB_Cmds
    Manual -->|"System Reset"| RTDB_Cmds
    Manual -->|"Generate PDF Report"| FS_Donations
```
