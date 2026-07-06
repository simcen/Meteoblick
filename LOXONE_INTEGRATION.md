# Loxone Smart Home Integration - Architektur & Implementierungsplan

## Recherche-Ergebnisse

### API Dokumentation
- **Offizielle Docs**: [Loxone API Documentation](https://www.loxone.com/enen/kb/api/)
- **PDF Guide (lokal)**: `sample/CommunicatingWithMiniserver.pdf`
- **Structure File**: [Structure File Documentation](https://www.loxone.com/wp-content/uploads/datasheets/StructureFile.pdf)
- **Community Reverse Engineering**: `/Users/siba5/Development/_projects/Inside-The-Loxone-Miniserver/`
  - Besonders: `LoxoneMiniserverNetworking.md` - detaillierte API-Docs

### Loxone Cloud DNS
- **Cloud-Adresse**: `connect.loxonecloud.com/504F94A1874F` (gegeben)
- **DNS Service**: `dns.loxonecloud.com/?getip&snr={SNR}&json=true` liefert aktuelle IP + Port
- **Automatische Erkennung**: Loxone Cloud DNS erkennt automatisch lokale vs. externe Verbindung

### HTTP API Basics

**Endpoint-Struktur:**
```
http://user:password@{miniserver-ip}/jdev/sps/io/{uuid}
```

**Wichtige Endpoints:**
- `/data/LoxAPP3.json` - Structure File (alle Controls + UUIDs)
- `/jdev/sps/io/{uuid}` - Aktuellen Wert eines Controls abrufen
- `/jdev/cfg/apiKey` - API Key abrufen (für Token-Auth)

**Authentication:**
- **HTTP Basic Auth** - nur für Debug/Test empfohlen
- **Token-based Auth** - empfohlen (HMAC-SHA256)
- Tokens via HTTP Request mit Key + Salt

**Temperature Sensor:**
- UUID Format: `15beed5b-01ab-d81d-ffff2b06d5b9c660`
- Type: `RoomComfortTemperature` oder ähnlich
- Unit: `°C`

---

## Architektur-Vorschlag

### 1. Konfiguration

**Benötigte Konfiguration (UserDefaults / AppStorage):**
```typescript
interface LoxoneConfig {
  // Cloud-Verbindung
  cloudAddress: string;        // z.B. "504F94A1874F"
  
  // Credentials
  username: string;
  password: string;             // Oder Token
  
  // Sensor-Auswahl
  temperatureSensorUUID: string; // Z.B. "15beed5b-01ab-..."
  
  // Optional: Lokale IP (manuell Override)
  localIP?: string;             // Z.B. "192.168.1.47"
}
```

**Wo konfiguriert werden muss:**
- Username + Password (in der App)
- Temperature Sensor UUID (muss aus Structure File gelesen werden)
- Cloud-Adresse ist bereits bekannt: `504F94A1874F`

**Konfiguration NICHT aus Loxone App auslesbar** - muss manuell eingegeben werden.

### 2. Verbindungslogik (Lokal vs. Extern)

**Auto-Detection Flow:**

```
1. Cloud DNS abfragen: dns.loxonecloud.com/?getip&snr=504F94A1874F&json=true
   → Liefert: { ip: "84.xxx.xxx.xxx", port: 443, localIP: "192.168.1.47" }

2. Netzwerk-Check:
   - Versuche lokalIP:port zu erreichen (mit Timeout 2s)
   - Wenn erfolgreich → lokale Verbindung nutzen
   - Wenn Timeout → Cloud-Verbindung nutzen

3. Fallback:
   - Lokale IP nicht erreichbar → connect.loxonecloud.com/504F94A1874F
```

**Implementierung:**
```typescript
async function getLoxoneConnection(): Promise<LoxoneConnection> {
  // 1. DNS abfragen
  const dnsInfo = await fetch(`https://dns.loxonecloud.com/?getip&snr=504F94A1874F&json=true`);
  const { ip, port, localIP } = await dnsInfo.json();
  
  // 2. Lokale Verbindung testen
  const isLocal = await testConnection(`http://${localIP}:${port}`, 2000);
  
  // 3. Richtige URL zurückgeben
  return isLocal 
    ? { baseURL: `http://${localIP}:${port}`, type: 'local' }
    : { baseURL: `https://connect.loxonecloud.com/504F94A1874F`, type: 'cloud' };
}
```

### 3. API Client

**LoxoneAPI Service:**
```typescript
class LoxoneAPI {
  private baseURL: string;
  private auth: { user: string, password: string };
  
  // Structure File laden (einmalig beim Setup)
  async getStructureFile(): Promise<StructureFile> {
    const response = await fetch(`${baseURL}/data/LoxAPP3.json`, {
      headers: { Authorization: basicAuth(user, password) }
    });
    return response.json();
  }
  
  // Sensor-Wert lesen
  async getTemperature(uuid: string): Promise<number> {
    const response = await fetch(`${baseURL}/jdev/sps/io/${uuid}`, {
      headers: { Authorization: basicAuth(user, password) }
    });
    const data = await response.json();
    return parseFloat(data.LL.value); // Loxone Loxone-Livewert
  }
  
  // Verbindungstest
  async testConnection(timeout = 2000): Promise<boolean> {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), timeout);
      
      await fetch(`${baseURL}/jdev/cfg/apiKey`, {
        signal: controller.signal
      });
      return true;
    } catch {
      return false;
    }
  }
}
```

### 4. MeteoSwiss IST vs. Prognose

**WICHTIG: Aktuelles Problem identifiziert!**

MeteoSwiss liefert aktuell **nur Prognose**, nicht IST-Temperatur:
```typescript
// backend/src/services/meteoswiss.ts
const timeDiff = rowDate.getTime() - currentHour.getTime();
if (timeDiff < 0) continue;  // ← Skippt Vergangenheit = keine IST-Daten!
```

**Lösung: Backend erweitern um BEIDE zu holen:**
- **IST** = letzte vergangene Stunde (closest to now, in past)
- **Prognose** = nächste zukünftige Stunde (closest to now, in future)

**API Response erweitern:**
```typescript
interface WeatherResponse {
  // Bestehend (umbenennen für Klarheit)
  temperatureForecast: number;      // Prognose nächste Stunde
  temperatureActual: number;        // IST letzte Stunde
  temperatureLoxone?: number;       // Smart Home Sensor (V2)
  
  // Rest bleibt
  symbolCode: number;
  precipitation: number;
  timestamp: string;
  // ...
}
```

### 5. Widget-Integration (UPDATED)

**Widget zeigt NUR IST-Temperaturen:**
```
┌─────────────────────────┐
│  Zürich                 │
│  ☁️ Bewölkt             │
│                         │
│  MeteoSwiss:  11°C      │ ← IST (letzte Stunde)
│  Smart Home:   9°C      │ ← IST (Loxone Sensor)
│                         │
│  🌧️ 0.2mm (3h)         │
└─────────────────────────┘
```

**HomeScreen zeigt BEIDE (IST + Prognose):**
```
Aktuelle Wetterdaten:

Temperatur IST:      11°C  (MeteoSwiss 09:00)
Temperatur Prognose: 12°C  (MeteoSwiss 11:00)
Smart Home IST:       9°C  (Loxone, gerade eben)

Wetterzustand: Bewölkt ☁️
Niederschlag (3h): 0.2mm
```

**Widget-Datenstruktur erweitern:**
```typescript
interface WidgetData {
  // Existing MeteoSwiss
  temperature: number;
  locationName: string;
  symbolCode: number;
  precipitation: number;
  timestamp: string;
  buildNumber: string;
  
  // NEU: Loxone
  actualTemperature?: number;      // Vom Loxone Sensor
  actualTemperatureTimestamp?: string;
}
```

### 5. Fetch-Logik anpassen

**Background Fetch erweitern:**
```typescript
// In weatherBackgroundTask.ts
TaskManager.defineTask(WEATHER_BACKGROUND_TASK, async () => {
  // 1. MeteoSwiss Prognose
  const weather = await MeteoSwissAPI.fetchWeatherData(pointId);
  
  // 2. Loxone Ist-Temperatur (wenn konfiguriert)
  let actualTemp = undefined;
  const loxoneConfig = await SharedStorage.getLoxoneConfig();
  if (loxoneConfig?.enabled) {
    try {
      const connection = await LoxoneAPI.getConnection();
      actualTemp = await LoxoneAPI.getTemperature(
        loxoneConfig.temperatureSensorUUID
      );
    } catch (error) {
      console.warn('[Loxone] Failed to fetch temperature:', error);
      // Nicht kritisch - Widget zeigt nur Prognose
    }
  }
  
  // 3. Widget aktualisieren
  await updateWidget({
    ...weather,
    actualTemperature: actualTemp,
    actualTemperatureTimestamp: actualTemp ? new Date().toISOString() : undefined
  });
});
```

---

## Implementierungsplan (UPDATED)

### Phase 0: MeteoSwiss Backend Fix (VORAUSSETZUNG!)
1. ✅ Backend erweitern: IST + Prognose beide holen
2. ✅ API Response erweitern: `temperatureActual` + `temperatureForecast`
3. ✅ Frontend API Client anpassen
4. ✅ Widget + HomeScreen nutzen IST statt Prognose
5. ✅ HomeScreen zeigt beide Werte getrennt

### Phase 1: Setup & Konfiguration (SmartHomeScreen)
1. ✅ Loxone Config in UserDefaults speichern
2. ✅ Settings-Screen: Cloud-Adresse (readonly), Username, Password
3. ✅ "Structure File laden" Button → zeigt Liste aller Temperature-Sensoren
4. ✅ User wählt Sensor aus → UUID wird gespeichert
5. ✅ "Verbindung testen" Button

### Phase 2: API Client
1. ✅ `src/api/loxone.ts` - API Client implementieren
2. ✅ DNS Service abfragen für IP-Detection
3. ✅ Lokale vs. Cloud-Verbindung auto-detect
4. ✅ Structure File Parser
5. ✅ Temperature Value Reader

### Phase 3: Widget-Integration
1. ✅ Widget-Datenstruktur erweitern
2. ✅ Background Fetch um Loxone erweitern
3. ✅ Foreground Fetch um Loxone erweitern
4. ✅ Widget-Layout anpassen (2 Temperaturen)
5. ✅ Fehlerbehandlung (Loxone nicht erreichbar → zeige nur Prognose)

### Phase 4: Testing
1. ✅ Lokale Verbindung testen (WLAN)
2. ✅ Cloud-Verbindung testen (Mobile Daten)
3. ✅ Failover testen (Loxone offline)
4. ✅ Widget-Refresh testen

---

## Offene Fragen

1. **Token-basierte Auth implementieren?**
   - Basic Auth für V1 OK?
   - Token-Auth für V2 (sicherer)

2. **Welche Temperature Sensor UUID nutzen?**
   - Muss aus Structure File ermittelt werden
   - User muss wählen (mehrere Sensoren möglich)

3. **Caching?**
   - Loxone-Wert cachen wenn nicht erreichbar?
   - Wie alt darf cached value sein?

4. **Fehlerbehandlung im Widget:**
   - Nur Prognose zeigen wenn Loxone offline?
   - Oder altes Loxone-Value mit Timestamp?

---

## Nächste Schritte

1. **Jetzt entscheiden:**
   - Phase 1 starten? (SmartHomeScreen + Config)
   - API Client Skeleton aufbauen?
   - Mock-Daten für Widget-Design?

2. **Priorität:**
   - Was ist wichtiger: Schnell lauffähig (Basic Auth) oder sicher (Token Auth)?

---

**Sources:**
- [Loxone API Documentation](https://www.loxone.com/enen/kb/api/)
- [DNS Service Documentation](https://www.loxone.com/enen/kb/dns-service/)
- [Web Services Documentation](https://www.loxone.com/enen/kb/web-services/)
- [Node-RED Loxone Integration](https://flows.nodered.org/node/node-red-contrib-loxone)
