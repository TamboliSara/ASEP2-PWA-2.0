/**
 * network.ts — Dynamic Network Interface & IP Auto-Discovery Service
 * 
 * Ensures QR Code generation and device-pairing links adapt automatically
 * to any device, host machine, hotspot, or local network configuration.
 */

export interface NetworkInterfaceInfo {
  address: string;
  name: string;
}

export interface ServerNetworkInfo {
  ip: string;
  allIps: NetworkInterfaceInfo[];
}

const STORAGE_KEY = "safe_custom_host_ip";

/**
 * Retrieves user's manually overridden host IP from localStorage if present.
 */
export function getStoredCustomIp(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

/**
 * Persists a custom host IP or clears it.
 */
export function setStoredCustomIp(ip: string): void {
  try {
    if (ip && ip.trim()) {
      localStorage.setItem(STORAGE_KEY, ip.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

/**
 * Synchronous initial host guess:
 * 1. Custom stored IP from localStorage
 * 2. Active browser hostname (if opened from a LAN IP like 10.x.x.x or 192.168.x.x)
 * 3. Fallback to "localhost"
 */
export function getInitialHost(): string {
  const custom = getStoredCustomIp();
  if (custom) return custom;

  const currentHost = typeof window !== "undefined" ? window.location.hostname : "";
  if (currentHost && currentHost !== "localhost" && currentHost !== "127.0.0.1") {
    return currentHost;
  }
  return "localhost";
}

/**
 * Queries the dev server's /api/server-ip middleware to dynamically discover
 * the actual IPv4 address of the host machine on the current local network/hotspot.
 */
export async function fetchServerIp(): Promise<ServerNetworkInfo | null> {
  try {
    const res = await fetch("/api/server-ip", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      ip: data.ip || "localhost",
      allIps: Array.isArray(data.allIps) ? data.allIps : []
    };
  } catch (err) {
    console.debug("[Network Service] /api/server-ip unreachable (using local hostname):", err);
    return null;
  }
}
