import { describe, expect, it } from 'vitest';
import { IMG, img } from '../prisma/seed-data/images';

/**
 * These guard the menu's photography against the two failures it has actually
 * had: an id that silently pointed at the wrong subject, and two dishes wearing
 * the same picture. The second is machine-checkable; the first is not — that
 * one is caught by looking, and the comment in images.ts explains how.
 */
describe('seed imagery', () => {
  const entries = Object.entries(IMG);

  it('gives every dish its own photograph', () => {
    const seen = new Map<string, string>();
    const shared: string[] = [];

    for (const [key, id] of entries) {
      const owner = seen.get(id);
      if (owner) shared.push(`${owner} and ${key} share ${id}`);
      else seen.set(id, key);
    }

    expect(shared).toEqual([]);
  });

  it('uses well-formed Unsplash ids', () => {
    for (const [key, id] of entries) {
      expect(id, key).toMatch(/^photo-[0-9]{10,}-[a-z0-9]+$/);
    }
  });

  it('builds a transform URL with a fixed crop', () => {
    const url = img(IMG.cortado, 1200, 900);
    expect(url).toContain('images.unsplash.com/photo-');
    expect(url).toContain('fit=crop');
    expect(url).toContain('w=1200');
    expect(url).toContain('h=900');
  });
});
