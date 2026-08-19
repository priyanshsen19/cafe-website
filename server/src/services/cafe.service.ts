import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { evaluateOpenState, formatHourRange } from '../utils/hours';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Locations, each with its live open/closed state and a readable week. */
export async function listCafes() {
  const cafes = await prisma.cafe.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: { hours: { orderBy: { dayOfWeek: 'asc' } }, _count: { select: { tables: true } } },
  });

  return cafes.map(({ hours, _count, ...cafe }) => ({
    ...cafe,
    tableCount: _count.tables,
    openState: evaluateOpenState(hours),
    hours: hours.map((hour) => ({
      dayOfWeek: hour.dayOfWeek,
      day: DAY_NAMES[hour.dayOfWeek]!,
      isClosed: hour.isClosed,
      label: formatHourRange(hour),
      opensAt: hour.opensAt,
      closesAt: hour.closesAt,
    })),
  }));
}

export async function getCafeBySlug(slug: string) {
  const cafe = await prisma.cafe.findUnique({
    where: { slug },
    include: { hours: { orderBy: { dayOfWeek: 'asc' } } },
  });
  if (!cafe) throw AppError.notFound('We couldn’t find that location.', 'CAFE_NOT_FOUND');

  const { hours, ...rest } = cafe;
  return {
    ...rest,
    openState: evaluateOpenState(hours),
    hours: hours.map((hour) => ({
      dayOfWeek: hour.dayOfWeek,
      day: DAY_NAMES[hour.dayOfWeek]!,
      isClosed: hour.isClosed,
      label: formatHourRange(hour),
    })),
  };
}

/**
 * Resolves the QR token printed on a physical table. This is what turns
 * `/menu?table=<token>` into a dine-in session.
 */
export async function resolveTableToken(token: string) {
  const table = await prisma.cafeTable.findFirst({
    where: { qrToken: token, isActive: true },
    include: { cafe: { include: { hours: true } } },
  });

  if (!table || !table.cafe.isActive) {
    throw AppError.notFound('That table code isn’t valid. Please ask our staff.', 'TABLE_NOT_FOUND');
  }

  const { cafe, ...rest } = table;
  const { hours, ...cafeRest } = cafe;

  return {
    table: { id: rest.id, label: rest.label, floor: rest.floor, capacity: rest.capacity, qrToken: rest.qrToken },
    cafe: cafeRest,
    openState: evaluateOpenState(hours),
  };
}

/** Aggregate open state used by the header banner and checkout gating. */
export async function getServiceStatus() {
  const cafes = await prisma.cafe.findMany({
    where: { isActive: true },
    include: { hours: true },
    orderBy: { sortOrder: 'asc' },
  });

  const states = cafes.map((cafe) => ({
    id: cafe.id,
    name: cafe.name,
    slug: cafe.slug,
    state: evaluateOpenState(cafe.hours),
  }));

  const open = states.filter((entry) => entry.state.isOpen);

  return {
    isOpen: open.length > 0,
    openCount: open.length,
    totalCount: states.length,
    nextOpensAt: states.map((s) => s.state.nextOpensAt).filter(Boolean).sort()[0] ?? null,
    message: open.length > 0 ? null : (states[0]?.state.message ?? 'We’re currently closed.'),
    locations: states,
  };
}
