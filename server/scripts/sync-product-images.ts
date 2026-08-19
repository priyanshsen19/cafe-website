/**
 * Re-points every product at the photograph the seed data now names.
 *
 * The menu images were corrected after the deployed database had already been
 * seeded, and re-seeding would destroy real orders — so this reconciles the two
 * in place instead. It only ever writes image URLs: prices, names, availability
 * and every order total are left untouched.
 *
 * Idempotent, so running it twice is harmless. It reports what it would change
 * and exits without writing unless `--apply` is passed.
 *
 *   npx tsx scripts/sync-product-images.ts            # preview
 *   npx tsx scripts/sync-product-images.ts --apply    # write
 */
import { PrismaClient } from '@prisma/client';
import { img } from '../prisma/seed-data/images';
import { MENU } from '../prisma/seed-data/menu';

const apply = process.argv.includes('--apply');
const prisma = new PrismaClient();

/** Host only — never print the credentials themselves. */
function describeTarget(): string {
  const url = process.env.DATABASE_URL ?? '';
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

async function main(): Promise<void> {
  const wanted = new Map<string, string>();
  for (const category of MENU) {
    for (const product of category.products) wanted.set(product.name, img(product.image, 1200, 900));
  }

  console.log(`\n  target   ${describeTarget()}`);
  console.log(`  mode     ${apply ? 'APPLY — writing changes' : 'preview only (pass --apply to write)'}`);
  console.log(`  dishes   ${wanted.size} in seed data\n`);

  const products = await prisma.product.findMany({ select: { id: true, name: true, imageUrl: true } });
  const stale = products.filter((p) => wanted.has(p.name) && wanted.get(p.name) !== p.imageUrl);
  const unknown = products.filter((p) => !wanted.has(p.name));

  if (unknown.length > 0) {
    console.log(`  ${unknown.length} product(s) are not in the seed data and will be left alone:`);
    for (const p of unknown) console.log(`     · ${p.name}`);
    console.log('');
  }

  if (stale.length === 0) {
    console.log('  ✓ every product already points at the right photograph\n');
  } else {
    console.log(`  ${stale.length} product(s) to re-point:`);
    for (const p of stale) console.log(`     · ${p.name}`);
    console.log('');
  }

  // Snapshots captured a wrong picture rather than a past truth, so they are
  // corrected too — otherwise old receipts keep showing the wrong dish.
  const staleSnapshots = await prisma.orderItem.count({
    where: { OR: [...wanted].map(([name, url]) => ({ productNameSnapshot: name, NOT: { productImageSnapshot: url } })) },
  });
  console.log(`  ${staleSnapshots} order-item snapshot(s) to correct\n`);

  if (!apply) {
    console.log('  Nothing written. Re-run with --apply to make these changes.\n');
    return;
  }

  let products_ = 0;
  let snapshots = 0;
  for (const [name, url] of wanted) {
    products_ += (await prisma.product.updateMany({ where: { name }, data: { imageUrl: url } })).count;
    snapshots += (
      await prisma.orderItem.updateMany({
        where: { productNameSnapshot: name, NOT: { productImageSnapshot: url } },
        data: { productImageSnapshot: url },
      })
    ).count;
  }

  const after = await prisma.product.findMany({ select: { imageUrl: true } });
  const distinct = new Set(after.map((p) => p.imageUrl)).size;

  console.log(`  ✓ ${products_} product row(s) written`);
  console.log(`  ✓ ${snapshots} snapshot(s) corrected`);
  console.log(`  ✓ ${after.length} products now using ${distinct} distinct photographs\n`);

  if (distinct !== after.length) {
    console.log('  ⚠ some products still share a photograph — check images.ts\n');
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('\n  Failed:', error instanceof Error ? error.message : error, '\n');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
