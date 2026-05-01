import type { FleetLockerSummary, LockerState } from "../types/domain";
import { sampleFleetLockers } from "./mockData";

export function buildFleetSummaries(lockers: LockerState[]): FleetLockerSummary[] {
  return lockers.map(locker => ({
    lockerId: locker.lockerId,
    lockerLabel: locker.lockerId.replace("chamber-", "Safe ").toUpperCase(),
    zoneLabel: "Current Kiosk",
    coordinates: { x: Math.random() * 80 + 10, y: Math.random() * 80 + 10 },
    occupancyState: locker.occupancyState,
    foodQualityScore: locker.foodQualityScore,
    faultState: locker.faultState,
    activeDonationName: locker.activeDonation?.foodName,
    activeDonationCategory: locker.activeDonation?.categoryLabel,
    deadlineEstimate: locker.deadlineEstimate,
    lastSyncedAt: locker.lastSyncedAt,
    sensorHealth: locker.telemetry.sensorHealth,
    heuristicGasProfile: locker.telemetry.heuristicGasProfile
  }));
}
