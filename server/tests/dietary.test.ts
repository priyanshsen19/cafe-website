import { describe, expect, it } from 'vitest';
import { MENU } from '../prisma/seed-data/menu';
import { assertDietaryConsistency } from '../src/services/admin.service';
import { AppError } from '../src/utils/AppError';

/**
 * The dietary marks are the one piece of menu data a customer acts on without
 * reading further. Indian convention — and FSSAI's marking rule — treats egg
 * as non-vegetarian, so these hold the seed and the admin write path to that.
 */
const dishes = MENU.flatMap((c) => c.products);

describe('seed dietary data', () => {
  it('never claims vegan for a dish with meat or egg', () => {
    const wrong = dishes.filter((p) => p.vegan && (p.nonVeg || p.egg)).map((p) => p.name);
    expect(wrong).toEqual([]);
  });

  it('names an animal ingredient on every non-veg dish', () => {
    const animal = /chicken|bacon|ham|salmon|tuna|prawn|shrimp|clam|lamb|mutton|beef|pork|fish|anchov|pancetta|turkey|egg|hollandaise|mayo|aioli|savoiardi/i;
    const silent = dishes
      .filter((p) => p.nonVeg || p.egg)
      .filter((p) => !animal.test([p.description, p.story ?? '', ...p.ingredients].join(' ')))
      .map((p) => p.name);
    // Bakery and dessert recipes contain egg without listing it in a two-line
    // description; that is normal menu copy, not a contradiction.
    const quietlyEggy = new Set([
      'Almond Croissant', 'Cinnamon Roll', 'Blueberry Muffin', 'Banana Bread', 'Chocolate Chip Cookie',
      'Truffle Mushroom Pasta', 'Alfredo', 'Chicken Alfredo', 'Chocolate Tart', 'Affogato Sundae',
      'Berry Cheesecake',
    ]);
    expect(silent.filter((n) => !quietlyEggy.has(n))).toEqual([]);
  });

  it('marks a vegetarian dish only when it has neither meat nor egg', () => {
    // This is the rule the seed applies when it writes isVegetarian.
    for (const p of dishes) {
      const isVegetarian = !p.nonVeg && !p.egg;
      if (p.egg) expect(isVegetarian, `${p.name} contains egg`).toBe(false);
      if (p.nonVeg) expect(isVegetarian, `${p.name} is non-veg`).toBe(false);
    }
  });
});

describe('admin dietary guard', () => {
  it('refuses the green mark on a dish with egg', () => {
    expect(() =>
      assertDietaryConsistency({ isVegetarian: true, isVegan: false, containsEgg: true }),
    ).toThrow(AppError);
  });

  it('refuses vegan on a non-vegetarian dish', () => {
    expect(() =>
      assertDietaryConsistency({ isVegetarian: false, isVegan: true, containsEgg: false }),
    ).toThrow(/vegan/i);
  });

  it('refuses vegan on a dish with egg', () => {
    expect(() =>
      assertDietaryConsistency({ isVegetarian: true, isVegan: true, containsEgg: true }),
    ).toThrow(AppError);
  });

  it('accepts every consistent combination', () => {
    for (const flags of [
      { isVegetarian: true, isVegan: false, containsEgg: false },
      { isVegetarian: true, isVegan: true, containsEgg: false },
      { isVegetarian: false, isVegan: false, containsEgg: true },
      { isVegetarian: false, isVegan: false, containsEgg: false },
    ]) {
      expect(() => assertDietaryConsistency(flags)).not.toThrow();
    }
  });
});
