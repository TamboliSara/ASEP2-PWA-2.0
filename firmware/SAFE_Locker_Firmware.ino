/**
 * SAFE LOCKER — ESP32-S3 FIRMWARE v3.2 (REST API BYPASS)
 * * Bypasses the heavy Firebase_ESP_Client library (which fails due to Arduino Web Editor 
 * folder flattening bugs) by using native WiFiClientSecure + HTTPClient to talk to 
 * Firebase Realtime Database using Database Secrets.
 * * Integrates live ML Data Collection: automatically starts a new data collection 
 * session when food is deposited, appends telemetry to `/data_collection`, and finishes 
 * the session when food is retrieved.
 * * RELAY: GPIO12 HIGH=UNLOCK, LOW=LOCK (NPN transistor, fail-secure solenoid)
 * HC-SR04: ECHO via 10k/20k divider → GPIO7. TRIG → GPIO6.
 */

#pragma GCC optimize("Os")

#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME680.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLE2902.h>
#include <Preferences.h>

// ── Wi-Fi & Database Configurations ────────────────────────────────
#define WIFI_SSID       "..."
#define WIFI_PASSWORD   "gandharv2007"
#define DATABASE_URL    "https://asep-10fe3-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_SECRET "rQzYtO5yPIGWzLBUQJIDiR0wh2p39F2haQ3bYQSB" // Paste Database Secret here

// ── GPIO Pin Mapping ───────────────────────────────────────────────
#define RELAY_PIN   12
#define TRIG_PIN     6
#define ECHO_PIN     7
#define DS18B20_PIN  4
#define I2C_SDA      8
#define I2C_SCL      9

// ── BLE UUIDs ──────────────────────────────────────────────────────
#define BLE_SVC_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define BLE_CHR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

#define OCCUPANCY_CM  22.0f
#define TELEMETRY_MS  10000UL
#define HTTP_TIMEOUT_MS 1500

// ── Global Hardware Instances ──────────────────────────────────────
OneWire           oneWire(DS18B20_PIN);
DallasTemperature ds(&oneWire);
Adafruit_BME680   bme;
Preferences       prefs;

String mac = "";
String activeSessionId = "";
bool bmeOk = false, isLocked = true, spoilLocked = false;
unsigned long lastTelMs = 0;
unsigned long lastWiFiCheckMs = 0;

BLECharacteristic* pChr = nullptr;
bool bleConnected = false;
volatile bool pendingUnlock = false, pendingAdmin = false;

// ── Helper: Clean String Quotes from Firebase REST Response ─────────
String cleanValue(String val) {
  val.trim();
  if (val.startsWith("\"") && val.endsWith("\"")) {
    val = val.substring(1, val.length() - 1);
  }
  return val;
}

// ── Native HTTPS REST API Communication ─────────────────────────────
String firebaseGet(const String& path) {
  if (mac == "OFFLINE") return "";
  
  WiFiClientSecure client;
  client.setInsecure(); // Disable SSL certificate checks for speed/simplicity
  HTTPClient http;
  
  String url = String(DATABASE_URL);
  if (path.startsWith("/")) {
    url += path;
  } else if (!path.isEmpty()) {
    url += "/" + path;
  } else {
    url += "/";
  }
  url += ".json?auth=" + String(FIREBASE_SECRET);

  http.begin(client, url);
  http.setTimeout(HTTP_TIMEOUT_MS); // Prevent blocking loop on slow connection
  
  int httpCode = http.GET();
  String payload = "";
  if (httpCode == 200) {
    payload = http.getString();
  } else {
    Serial.print("GET fail: "); Serial.print(url); 
    Serial.print(" Code: "); Serial.println(httpCode);
  }
  http.end();
  return payload;
}

bool firebasePatch(const String& path, const String& jsonBody) {
  if (mac == "OFFLINE") return false;
  
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  
  String url = String(DATABASE_URL);
  if (path.startsWith("/")) {
    url += path;
  } else if (!path.isEmpty()) {
    url += "/" + path;
  } else {
    url += "/";
  }
  url += ".json?auth=" + String(FIREBASE_SECRET);

  http.begin(client, url);
  http.setTimeout(HTTP_TIMEOUT_MS); // Prevent blocking loop on slow connection
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.PATCH(jsonBody);
  http.end();
  return (httpCode == 200 || httpCode == 201);
}

String firebasePost(const String& path, const String& jsonBody) {
  if (mac == "OFFLINE") return "";
  
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  
  String url = String(DATABASE_URL);
  if (path.startsWith("/")) {
    url += path;
  } else if (!path.isEmpty()) {
    url += "/" + path;
  } else {
    url += "/";
  }
  url += ".json?auth=" + String(FIREBASE_SECRET);

  http.begin(client, url);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.POST(jsonBody);
  String payload = "";
  if (httpCode == 200 || httpCode == 201) {
    payload = http.getString();
  }
  http.end();
  return payload;
}

// Helper: Extract push ID key (e.g. -OC12345) from Firebase response
String getPushId(String response) {
  response.trim();
  int start = response.indexOf("\"name\":\"");
  if (start != -1) {
    start += 8;
    int end = response.indexOf("\"", start);
    if (end != -1) {
      return response.substring(start, end);
    }
  }
  return "";
}

// ── ML Data Collection Session Control ──────────────────────────────
void startCollectionSession() {
  if (mac.isEmpty() || mac == "OFFLINE") return;
  Serial.println(F("[ML Data] Requesting new session key from Firebase..."));
  
  String startNode = "{\"status\":\"active\",\"startTime\":{\".sv\":\"timestamp\"}}";
  String response = firebasePost("/data_collection/" + mac + "/sessions", startNode);
  String newSessionId = getPushId(response);
  
  if (!newSessionId.isEmpty()) {
    activeSessionId = newSessionId;
    prefs.putString("sessionId", activeSessionId);
    Serial.print(F("✅ [ML Data Session Started] ID: "));
    Serial.println(activeSessionId);
  } else {
    Serial.println(F("❌ [ERROR] Firebase session creation failed."));
  }
}

void endCollectionSession() {
  if (mac.isEmpty() || mac == "OFFLINE" || activeSessionId.isEmpty()) return;
  Serial.println(F("[ML Data] Ending current active session..."));
  
  String body = "{\"status\":\"completed\",\"endTime\":{\".sv\":\"timestamp\"}}";
  firebasePatch("/data_collection/" + mac + "/sessions/" + activeSessionId, body);
  activeSessionId = "";
  prefs.putString("sessionId", "");
  Serial.println(F("✅ [ML Data Session Completed]"));
}

// ── Core Solenoid Hardware Control ──────────────────────────────────
void doLock()   { digitalWrite(RELAY_PIN, LOW);  isLocked = true;  Serial.println(F("LOCKED")); }
void doUnlock() { digitalWrite(RELAY_PIN, HIGH); isLocked = false; Serial.println(F("UNLOCKED")); }

void notifyBLE(const char* s) { if (bleConnected && pChr) { pChr->setValue(s); pChr->notify(); } }

void pushStatus(const char* lk, const char* dr, const char* oc) {
  if (mac.isEmpty() || mac == "OFFLINE") return;
  // Mirror to status/chamber-1 and status/<mac> simultaneously in a single root PATCH
  String body = "{\"status/chamber-1\":{\"lock_state\":\"" + String(lk) + "\",\"door_state\":\"" + String(dr) + "\",\"occupancy\":\"" + String(oc) + "\",\"last_heartbeat\":" + String(millis()) + "},\"status/" + mac + "\":{\"lock_state\":\"" + String(lk) + "\",\"door_state\":\"" + String(dr) + "\",\"occupancy\":\"" + String(oc) + "\",\"last_heartbeat\":" + String(millis()) + "}}";
  firebasePatch("", body);
}

void ackCmd() {
  if (mac.isEmpty() || mac == "OFFLINE") return;
  // Acknowledge command on both paths
  String body = "{\"commands/chamber-1\":{\"command\":\"PING\",\"acknowledged\":true},\"commands/" + mac + "\":{\"command\":\"PING\",\"acknowledged\":true}}";
  firebasePatch("", body);
}

float readDist() {
  digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long d = pulseIn(ECHO_PIN, HIGH, 30000);
  return d == 0 ? 999.0f : (d * 0.0343f) / 2.0f;
}

bool foodPresent() {
  float t = 0; int n = 0;
  for (int i = 0; i < 3; i++) { float d = readDist(); if (d < 400) { t += d; n++; } delay(60); }
  if (!n) return false;
  float avg = t / n;
  Serial.print(F("Dist:")); Serial.print(avg,1); Serial.print(F("cm Food:")); Serial.println(avg < OCCUPANCY_CM ? F("YES") : F("NO"));
  return avg < OCCUPANCY_CM;
}

void unlockCycle(bool admin) {
  Serial.println(admin ? F("CMD:ADMIN_UNLOCK") : F("CMD:UNLOCK"));
  doUnlock(); pushStatus("unlocked","open","processing"); notifyBLE("UNLOCKED"); ackCmd();
  delay(5000);
  doLock(); notifyBLE("LOCKED");
  
  bool food = foodPresent();
  pushStatus("locked", "closed", food ? "occupied" : "empty");
  notifyBLE(food ? "OCCUPIED" : "EMPTY");
  Serial.println(food ? F("Deposit:OK") : F("Deposit:NO_FOOD"));

  // ML Data Collection Session Transition
  if (food) {
    if (activeSessionId.isEmpty()) {
      startCollectionSession();
    }
  } else {
    if (!activeSessionId.isEmpty()) {
      endCollectionSession();
    }
  }
}

void lockCmd() {
  Serial.println(F("CMD:LOCK"));
  doLock(); pushStatus("locked","closed","occupied"); notifyBLE("LOCKED"); ackCmd();
  if (activeSessionId.isEmpty()) {
    startCollectionSession();
  }
}

// ── BLE Callbacks ──────────────────────────────────────────────────
class SvrCB : public BLEServerCallbacks {
  void onConnect(BLEServer*)      override { bleConnected = true;  }
  void onDisconnect(BLEServer* s) override { bleConnected = false; s->startAdvertising(); }
};
class ChrCB : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) override {
    String v = String(c->getValue().c_str()); v.trim();
    if      (v == "UNLOCK")       { if (spoilLocked) { notifyBLE("SPOILAGE_LOCKED"); } else { pendingUnlock = true; } }
    else if (v == "ADMIN_UNLOCK") { spoilLocked = false; pendingAdmin = true; }
    else if (v == "LOCK")         { lockCmd(); spoilLocked = true; }
    else if (v == "PING")         { String p = "PONG:" + mac; notifyBLE(p.c_str()); }
  }
};

// ── Non-Blocking Wi-Fi Connection Checker ──────────────────────────
void checkWiFi() {
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastWiFiCheckMs > 15000 || lastWiFiCheckMs == 0) {
      lastWiFiCheckMs = millis();
      Serial.println(F("WiFi not connected. Reconnecting..."));
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  }
}

// ── Setup ──────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200); delay(1000);
  Serial.println(F("SAFE LOCKER v3.2 (REST API BYPASS)"));

  pinMode(RELAY_PIN, OUTPUT); doLock();
  pinMode(TRIG_PIN, OUTPUT);  pinMode(ECHO_PIN, INPUT);

  ds.begin();

  Wire.begin(I2C_SDA, I2C_SCL);
  bmeOk = bme.begin(0x76, &Wire) || bme.begin(0x77, &Wire);
  if (bmeOk) {
    bme.setTemperatureOversampling(BME680_OS_8X);
    bme.setHumidityOversampling(BME680_OS_2X);
    bme.setPressureOversampling(BME680_OS_4X);
    bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
    bme.setGasHeater(320, 150);
    Serial.println(F("BME688:OK"));
  } else { Serial.println(F("BME688:FAIL")); }

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int r = 0; while (WiFi.status() != WL_CONNECTED && r++ < 40) delay(500);
  if (WiFi.status() == WL_CONNECTED) {
    mac = WiFi.macAddress(); mac.replace(":", "");
    Serial.print(F("WiFi:OK MAC:")); Serial.println(mac);
  } else { Serial.println(F("WiFi:FAIL")); mac = "OFFLINE"; }

  // Initialize Preferences (Flash storage)
  prefs.begin("safe-locker", false);
  activeSessionId = prefs.getString("sessionId", "");

  String bleName = "EcoLocker " + (mac == "OFFLINE" ? String("ESP32") : mac);
  BLEDevice::init(bleName.c_str());
  BLEServer* srv = BLEDevice::createServer(); srv->setCallbacks(new SvrCB());
  BLEService* svc = srv->createService(BLE_SVC_UUID);
  pChr = svc->createCharacteristic(BLE_CHR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE |
    BLECharacteristic::PROPERTY_NOTIFY | BLECharacteristic::PROPERTY_INDICATE);
  pChr->setCallbacks(new ChrCB()); pChr->addDescriptor(new BLE2902()); pChr->setValue("READY");
  svc->start();
  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(BLE_SVC_UUID); adv->setScanResponse(true); BLEDevice::startAdvertising();
  Serial.print(F("BLE:")); Serial.println(bleName);

  if (mac != "OFFLINE") {
    // Register device in DB (under both MAC address and chamber-1 paths)
    String body = "{\"devices/chamber-1\":{\"mac_address\":\"" + mac + "\",\"device_name\":\"" + bleName + "\",\"firmware_version\":\"3.2.0\",\"is_online\":true},\"devices/" + mac + "\":{\"mac_address\":\"" + mac + "\",\"device_name\":\"" + bleName + "\",\"firmware_version\":\"3.2.0\",\"is_online\":true}}";
    firebasePatch("", body);
    pushStatus("locked", "closed", "empty");
    ackCmd();
    Serial.println(F("Firebase REST Registration:OK"));
  }

  Serial.println(F("READY"));
}

// ── Loop ───────────────────────────────────────────────────────────
void loop() {
  if (pendingAdmin)  { pendingAdmin  = false; spoilLocked = false; unlockCycle(true);  }
  if (pendingUnlock) { pendingUnlock = false;                      unlockCycle(false); }

  checkWiFi();

  if (mac != "OFFLINE" && WiFi.status() == WL_CONNECTED) {
    // 1. Read command (checks chamber-1 first, falls back to MAC)
    String cmdRaw = firebaseGet("/commands/chamber-1/command");
    String cmd = cleanValue(cmdRaw);
    if (cmd.isEmpty() || cmd == "null") {
      cmdRaw = firebaseGet("/commands/" + mac + "/command");
      cmd = cleanValue(cmdRaw);
    }
    
    // 2. Read acknowledged status
    String ackRaw = firebaseGet("/commands/chamber-1/acknowledged");
    String ack = cleanValue(ackRaw);
    if (ack.isEmpty() || ack == "null") {
      ackRaw = firebaseGet("/commands/" + mac + "/acknowledged");
      ack = cleanValue(ackRaw);
    }
    
    // Only execute if not yet acknowledged and the command is not PING/empty
    if (ack == "false" && !cmd.isEmpty() && cmd != "PING" && cmd != "null") {
      if (cmd == "UNLOCK") {
        if (spoilLocked) { 
          ackCmd(); 
          notifyBLE("SPOILAGE_LOCKED"); 
        } else {
          String issuedRaw = firebaseGet("/commands/chamber-1/issued_by");
          String issued = cleanValue(issuedRaw);
          if (issued.isEmpty() || issued == "null") {
            issuedRaw = firebaseGet("/commands/" + mac + "/issued_by");
            issued = cleanValue(issuedRaw);
          }
          bool adm = (issued == "admin");
          unlockCycle(adm);
        }
      } else if (cmd == "LOCK") {
        String issuedRaw = firebaseGet("/commands/chamber-1/issued_by");
        String issued = cleanValue(issuedRaw);
        if (issued.isEmpty() || issued == "null") {
          issuedRaw = firebaseGet("/commands/" + mac + "/issued_by");
          issued = cleanValue(issuedRaw);
        }
        bool adm = (issued == "admin");
        lockCmd(); 
        if (adm) spoilLocked = true;
      } else if (cmd == "ADMIN_UNLOCK") { 
        spoilLocked = false; 
        unlockCycle(true); 
      }
    } else if (cmd == "PING") {
      // Periodic heartbeat update
      String heartbeatBody = "{\"status/chamber-1/last_heartbeat\":" + String(millis()) + ",\"status/" + mac + "/last_heartbeat\":" + String(millis()) + "}";
      firebasePatch("", heartbeatBody);
    }

    // ── Telemetry & Status Logging ─────────────────────────────────
    if (millis() - lastTelMs > TELEMETRY_MS || !lastTelMs) {
      lastTelMs = millis();
      float iT=0, hm=0, pr=0; uint32_t gs=0;
      if (bmeOk && bme.performReading()) { iT=bme.temperature; hm=bme.humidity; pr=bme.pressure/100.0f; gs=bme.gas_resistance; }
      ds.requestTemperatures();
      float eT = ds.getTempCByIndex(0); if (eT == DEVICE_DISCONNECTED_C) eT = 0;
      float dist = readDist(); bool occ = (dist < OCCUPANCY_CM && dist > 1.0f);
      Serial.print(F("T:")); Serial.print(iT); Serial.print(F(" H:")); Serial.print(hm);
      Serial.print(F(" G:")); Serial.print(gs); Serial.print(F(" D:")); Serial.print(dist,1);
      Serial.print(F(" Occ:")); Serial.println(occ ? F("Y") : F("N"));
      
      // Update telemetry on both paths in a single root PATCH
      String telBody = "{\"telemetry/chamber-1\":{\"internalTempC\":" + String(iT) + ",\"externalTempC\":" + String(eT) + ",\"humidityPct\":" + String(hm) + ",\"pressureHpa\":" + String(pr) + ",\"gasResistanceOhms\":" + String((int)gs) + ",\"distanceCm\":" + String(dist, 1) + ",\"timestamp\":" + String(millis()) + "},\"telemetry/" + mac + "\":{\"internalTempC\":" + String(iT) + ",\"externalTempC\":" + String(eT) + ",\"humidityPct\":" + String(hm) + ",\"pressureHpa\":" + String(pr) + ",\"gasResistanceOhms\":" + String((int)gs) + ",\"distanceCm\":" + String(dist, 1) + ",\"timestamp\":" + String(millis()) + "}}";
      firebasePatch("", telBody);
      
      // Update status/occupancy on both paths
      String statusBody = "{\"status/chamber-1/occupancy\":\"" + String(occ ? "occupied" : "empty") + "\",\"status/chamber-1/last_heartbeat\":" + String(millis()) + ",\"status/" + mac + "/occupancy\":\"" + String(occ ? "occupied" : "empty") + "\",\"status/" + mac + "/last_heartbeat\":" + String(millis()) + "}";
      firebasePatch("", statusBody);

      // If active data collection session is running, push telemetry to active session readings
      if (!activeSessionId.isEmpty()) {
        float gasKohm = (float)gs / 1000.0f;
        String dpBody = "{\"internalTempC\":" + String(iT, 2) + ",\"externalTempC\":" + String(eT, 2) + ",\"humidityPct\":" + String(hm, 2) + ",\"pressureHpa\":" + String(pr, 2) + ",\"gasResistanceOhms\":" + String((int)gs) + ",\"gasResistanceKohm\":" + String(gasKohm, 2) + ",\"timestamp\":{\".sv\":\"timestamp\"}}";
        firebasePost("/data_collection/" + mac + "/sessions/" + activeSessionId + "/readings", dpBody);
      }
    }
  }
  
  delay(50);
}
