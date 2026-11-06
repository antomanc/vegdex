import { expect, it } from 'vitest';
import { applyLineRecord, parseLine, renderIngredient, compileGroceryList, displayGroceryName } from '../src';
const vocab = { language: 'en', names: {}, terms: {}, titles: {}, units: { can: ['can', 'cans'] as [string,string], g: ['g','g'] as [string,string] } };
it('keeps parser measurements and package weight beside bilingual text', () => {
  const raw='1 can (400 g) chickpeas';
  const parsed=parseLine(raw);
  const parts=applyLineRecord(parsed,{line:raw,language:'en',parts:[{en:'chickpeas',it:'ceci',quantity:9}]},{});
  expect(parts[0]?.quantity).toBe(1);
  expect(renderIngredient(parts[0]!,vocab,'en','metric')).toEqual(['1 can (400 g)','chickpeas']);
  expect(applyLineRecord(parsed,undefined,{})).toBe(parsed);
});
it('uses only written record amounts for a changed split, without duplicating metric weights', () => {
  const parts=applyLineRecord(parseLine('2 tsp starch + water'),{line:'2 tsp starch + water',language:'en',parts:[{en:'starch',it:'amido',quantity:2,unit:'tsp'},{en:'water',it:'acqua',quantity:99,unit:'tbsp'}]},{});
  expect(parts.map(p=>p.quantity)).toEqual([2,null]);
  expect(parts.map(p=>p.metric)).toEqual([null,null]);
});
it('buys the primary ingredient once and names unmapped rows using record text', () => {
  const raw='1 mystery bean or lentil';
  const parts=applyLineRecord(parseLine(raw),{line:raw,language:'en',parts:[{en:'mystery bean',it:'fagiolo misterioso',alternatives:[{en:'lentil',it:'lenticchia'}]}]},{});
  const rows=compileGroceryList([{recipeId:'a',ingredients:[raw],parsedIngredients:[parts],multiplier:1}]);
  expect(rows).toHaveLength(1);
  expect(displayGroceryName(rows[0]!,undefined,'it')).toBe('fagiolo misterioso o lenticchia');
});
it('retains the unsafe render fallback even for recorded text', () => {
  const p=applyLineRecord(parseLine('vegan cheese'),{line:'vegan cheese',language:'en',parts:[{en:'cheese',it:'formaggio'}]},{});
  expect(renderIngredient(p[0]!,vocab,'en','us')).toBeNull();
});
