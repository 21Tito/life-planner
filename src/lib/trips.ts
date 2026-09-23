import type { Trip } from "@/types";

/** Days after the trip end date before it leaves Home and moves to Completed. */
export const TRIP_COMPLETED_GRACE_DAYS = 7;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseLocalDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

export function daysSinceTripEnd(endDate: string, now = new Date()): number {
  const end = parseLocalDate(endDate);
  const today = startOfLocalDay(now);
  return Math.round((today.getTime() - end.getTime()) / (1000 * 60 * 60 * 24));
}

/** True once 7 full days have passed since the trip's last day. */
export function isTripCompleted(endDate: string, now = new Date()): boolean {
  return daysSinceTripEnd(endDate, now) >= TRIP_COMPLETED_GRACE_DAYS;
}

export function partitionTrips(trips: Trip[], now = new Date()) {
  const upcoming: Trip[] = [];
  const completed: Trip[] = [];

  for (const trip of trips) {
    if (isTripCompleted(trip.end_date, now)) {
      completed.push(trip);
    } else {
      upcoming.push(trip);
    }
  }

  upcoming.sort((a, b) => a.start_date.localeCompare(b.start_date));
  completed.sort((a, b) => b.end_date.localeCompare(a.end_date));

  return { upcoming, completed };
}
