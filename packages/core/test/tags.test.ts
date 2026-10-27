import { describe, expect, it } from 'vitest';
import { classify } from '../src';

const base = { categories: [], cuisines: [], keywords: [], protein: null };

describe('classify', () => {
  it('tags a savory dinner from categories', () => {
    const tags = classify({
      ...base,
      title: 'Creamy Vegan Pumpkin Mac and Cheese',
      categories: ['Dinner', 'Lunch'],
      cuisines: ['American'],
      keywords: ['gluten-free', 'pasta'],
      ingredients: ['1/2 cup raw cashews', '1 tsp garlic powder', '10 ounces rigatoni pasta', '1 tbsp miso paste']
    });
    expect(tags).toContain('meal:main');
    expect(tags).toContain('flavor:savory');
    expect(tags).toContain('cuisine:american');
    expect(tags).not.toContain('free:nut-free');
    expect(tags).not.toContain('free:soy-free');
    expect(tags).not.toContain('free:gluten-free');
  });

  it('tags cookies as a sweet dessert from the title', () => {
    const tags = classify({
      ...base,
      title: 'Chewy Chocolate Chip Cookies',
      ingredients: ['1 cup flour', '1/2 cup coconut sugar', '1/2 cup chocolate chips', '1/4 cup coconut oil']
    });
    expect(tags).toEqual(expect.arrayContaining(['meal:dessert', 'flavor:sweet', 'free:nut-free', 'free:soy-free']));
    expect(tags).not.toContain('free:oil-free');
  });

  it('marks high-protein and breakfast', () => {
    const tags = classify({
      ...base,
      title: 'Tofu Scramble',
      categories: ['Breakfast'],
      protein: 24,
      ingredients: ['1 block firm tofu', '1/4 tsp turmeric', '1 tbsp nutritional yeast']
    });
    expect(tags).toEqual(expect.arrayContaining(['meal:breakfast', 'flavor:savory', 'high-protein']));
  });
});
