import type { OperatingHour } from '@prisma/client';

export interface OpenState {
  isOpen: boolean;
  /** Minutes from midnight, local time, for today's opening/closing. */
  opensAt: number | null;
  closesAt: number | null;
  /** ISO timestamp of the next moment the café starts accepting walk-in orders. */
  nextOpensAt: string | null;
  message: string | null;
}

const DAY_MINUTES = 24 * 60;

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function labelFor(minutes: number): string {
  const normalised = minutes % DAY_MINUTES;
  const hour24 = Math.floor(normalised / 60);
  const minute = normalised % 60;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${suffix}`;
}

export function formatHourRange(hour: Pick<OperatingHour, 'opensAt' | 'closesAt' | 'isClosed'>): string {
  if (hour.isClosed) return 'Closed';
  return `${labelFor(hour.opensAt)} – ${labelFor(hour.closesAt)}`;
}

/**
 * Evaluates whether a café is currently trading. `closesAt` may exceed 1440 to
 * express a closing time after midnight (e.g. 12:00 AM is stored as 1440), in
 * which case the previous day's window can still be running.
 */
export function evaluateOpenState(hours: OperatingHour[], now = new Date()): OpenState {
  if (hours.length === 0) {
    return { isOpen: true, opensAt: null, closesAt: null, nextOpensAt: null, message: null };
  }

  const byDay = new Map(hours.map((h) => [h.dayOfWeek, h]));
  const today = byDay.get(now.getDay());
  const nowMinutes = minutesOfDay(now);

  // A window opened yesterday may still be running past midnight.
  const yesterdayIndex = (now.getDay() + 6) % 7;
  const yesterday = byDay.get(yesterdayIndex);
  if (yesterday && !yesterday.isClosed && yesterday.closesAt > DAY_MINUTES) {
    if (nowMinutes < yesterday.closesAt - DAY_MINUTES) {
      return {
        isOpen: true,
        opensAt: yesterday.opensAt,
        closesAt: yesterday.closesAt,
        nextOpensAt: null,
        message: null,
      };
    }
  }

  if (today && !today.isClosed && nowMinutes >= today.opensAt && nowMinutes < today.closesAt) {
    return { isOpen: true, opensAt: today.opensAt, closesAt: today.closesAt, nextOpensAt: null, message: null };
  }

  // Closed — find the next opening within the coming week.
  for (let offset = 0; offset < 8; offset += 1) {
    const candidateDay = (now.getDay() + offset) % 7;
    const hour = byDay.get(candidateDay);
    if (!hour || hour.isClosed) continue;
    if (offset === 0 && nowMinutes >= hour.opensAt) continue;

    const next = new Date(now);
    next.setDate(next.getDate() + offset);
    next.setHours(Math.floor(hour.opensAt / 60), hour.opensAt % 60, 0, 0);

    return {
      isOpen: false,
      opensAt: today?.opensAt ?? null,
      closesAt: today?.closesAt ?? null,
      nextOpensAt: next.toISOString(),
      message:
        offset === 0
          ? `We open at ${labelFor(hour.opensAt)} today.`
          : `We reopen at ${labelFor(hour.opensAt)}.`,
    };
  }

  return {
    isOpen: false,
    opensAt: null,
    closesAt: null,
    nextOpensAt: null,
    message: 'We’re currently closed.',
  };
}
