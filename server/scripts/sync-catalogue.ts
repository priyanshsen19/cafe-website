/**
 * Brings every product's *correctness* fields back in line with the seed data:
 * the photograph, and the dietary marks a customer relies on.
 *
 * The seed only runs on an empty database, so a catalogue seeded before a
 * correction keeps the old mistake — and re-seeding would destroy real orders.
 * This reconciles in place instead. It deliberately leaves prices, names,
 * descriptions and availability alone: those are the café's to change from
 * the admin dashboard, and this must never silently undo that.
 *
 * Idempotent, so running it twice is harmless. It reports what it would change
 * and exits without writing unless `--apply` is passed.
 *
 *   npx tsx scripts/sync-catalogue.ts            # preview
 *   npx tsx scripts/sync-catalogue.ts --apply    # write
 *
 * It also runs at deploy time with `--on-boot`, gated behind
 * CATALOGUE_SYNC_ON_BOOT=true, so a correction to the seed data reaches a
 * long-lived database on the next deploy without anyone running anything.
 * In that mode it applies, and it never fails the boot: a stale photograph is
 * a far better outcome than a service that won't start.
 */
import { PrismaClient } from '@prisma/client';
import { img } from '../prisma/seed-data/images';
import { MENU } from '../prisma/seed-data/menu';

const onBoot = process.argv.includes('--on-boot');
const apply = onBoot || process.argv.includes('--apply');
const prisma = new PrismaClient();

interface Wanted {
  imageUrl: string;
  isVegetarian: boolean;
  isVegan: boolean;
  containsEgg: boolean;
  containsNuts: boolean;
  containsGluten: boolean;
  isSpicy: boolean;
}

const FIELDS = ['imageUrl', 'isVegetarian', 'isVegan', 'containsEgg', 'containsNuts', 'containsGluten', 'isSpicy'] as const;

/** Host only — never print the credentials themselves. */
function describeTarget(): string {
  try {
    const parsed = new URL(process.env.DATABASE_URL ?? '');
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

async function main(): Promise<void> {
  if (onBoot && process.env.CATALOGUE_SYNC_ON_BOOT !== 'true') {
    console.log('[catalogue-sync] CATALOGUE_SYNC_ON_BOOT is not set — skipping.');
    return;
  }

  const wanted = new Map<string, Wanted>();
  for (const category of MENU) {
    for (const p of category.products) {
      wanted.set(p.name, {
        imageUrl: img(p.image, 1200, 900),
        // Same rule the seed applies: egg is non-vegetarian.
        isVegetarian: !p.nonVeg && !p.egg,
        isVegan: p.vegan ?? false,
        containsEgg: p.egg ?? false,
        containsNuts: p.nuts ?? false,
        containsGluten: p.gluten ?? false,
        isSpicy: p.spicy ?? false,
      });
    }
  }

  console.log(`\n  target   ${describeTarget()}`);
  console.log(`  mode     ${apply ? 'APPLY — writing changes' : 'preview only (pass --apply to write)'}`);
  console.log(`  dishes   ${wanted.size} in seed data\n`);

  const products = await prisma.product.findMany({
    select: { id: true, name: true, ...Object.fromEntries(FIELDS.map((f) => [f, true])) },
  });

  const unknown = products.filter((p) => !wanted.has(p.name));
  if (unknown.length > 0) {
    console.log(`  ${unknown.length} product(s) are not in the seed data and will be left alone:`);
    for (const p of unknown) console.log(`     · ${p.name}`);
    console.log('');
  }

  // Work out, per dish, which fields differ — so the preview says *what* is
  // wrong, not just that something is.
  const stale: { id: string; name: string; changes: string[]; data: Partial<Wanted> }[] = [];
  for (const p of products) {
    const w = wanted.get(p.name);
    if (!w) continue;
    const changes: string[] = [];
    const data: Partial<Wanted> = {};
    for (const f of FIELDS) {
      if (p[f] !== w[f]) {
        changes.push(f === 'imageUrl' ? 'photo' : `${f} ${String(p[f])}→${String(w[f])}`);
        (data as Record<string, unknown>)[f] = w[f];
      }
    }
    if (changes.length) stale.push({ id: p.id, name: p.name, changes, data });
  }

  if (stale.length === 0) {
    console.log('  ✓ every product already matches the seed data\n');
  } else {
    console.log(`  ${stale.length} product(s) to correct:`);
    for (const s of stale) console.log(`     · ${s.name.padEnd(30)} ${s.changes.join(', ')}`);
    console.log('');
  }

  // Order-item snapshots captured a wrong picture rather than a past truth, so
  // they are corrected too — otherwise old receipts keep showing the wrong dish.
  const staleSnapshots = await prisma.orderItem.count({
    where: {
      OR: [...wanted].map(([name, w]) => ({ productNameSnapshot: name, NOT: { productImageSnapshot: w.imageUrl } })),
    },
  });
  console.log(`  ${staleSnapshots} order-item photo snapshot(s) to correct\n`);

  if (!apply) {
    console.log('  Nothing written. Re-run with --apply to make these changes.\n');
    return;
  }

  for (const s of stale) await prisma.product.update({ where: { id: s.id }, data: s.data });

  let snapshots = 0;
  for (const [name, w] of wanted) {
    snapshots += (
      await prisma.orderItem.updateMany({
        where: { productNameSnapshot: name, NOT: { productImageSnapshot: w.imageUrl } },
        data: { productImageSnapshot: w.imageUrl },
      })
    ).count;
  }

  const after = await prisma.product.findMany({ select: { imageUrl: true, isVegetarian: true, containsEgg: true } });
  const distinct = new Set(after.map((p) => p.imageUrl)).size;
  const contradictions = after.filter((p) => p.isVegetarian && p.containsEgg).length;

  console.log(`  ✓ ${stale.length} product(s) corrected`);
  console.log(`  ✓ ${snapshots} snapshot(s) corrected`);
  console.log(`  ✓ ${after.length} products, ${distinct} distinct photographs, ${contradictions} egg-but-vegetarian contradictions\n`);

  if (!onBoot && (distinct !== after.length || contradictions > 0)) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('\n  Failed:', error instanceof Error ? error.message : error, '\n');
    // On boot this must never take the service down with it.
    process.exitCode = onBoot ? 0 : 1;
  })
  .finally(() => prisma.$disconnect());
