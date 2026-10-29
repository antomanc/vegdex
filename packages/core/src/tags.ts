import { parseIngredient } from './ingredients';
import { languagePacks } from './languages';
import type { Flavor, Meal, Tag } from './types';

export interface TagInput {
  contentLanguage?: string;
  title: string;
  categories: string[];
  cuisines: string[];
  keywords: string[];
  ingredients: string[];
  protein: number | null;
}

/** Publisher category words → meal. Checked against recipeCategory first. */
const CATEGORY_MEALS: [RegExp, Meal][] = [
  [/breakfast|brunch/, 'breakfast'],
  [/main|dinner|lunch|entr[eé]e|supper|bowl|pasta|curry|burger|sandwich|wrap|pizza|taco/, 'main'],
  [/soup|stew|chili|chowder|ramen/, 'soup'],
  [/salad/, 'salad'],
  [/side/, 'side'],
  [/snack|appetizer|starter|finger food|party/, 'snack'],
  [/dessert|sweet|cake|cookie|pie|treat|ice cream|candy|chocolate/, 'dessert'],
  [/baking|baked goods|bread|muffin|scone/, 'baking'],
  [/drink|beverage|smoothie|juice|cocktail|latte|tea|coffee|shake/, 'drink'],
  [/sauce|dip|dressing|condiment|spread|seasoning|basic|staple|marinade|gravy|pesto/, 'sauce']
];

/** Title words → meal, used when categories say nothing useful. */
const TITLE_MEALS: [RegExp, Meal][] = [
  [/pancake|waffle|oatmeal|porridge|overnight oats|granola|french toast|scramble|chia pudding|breakfast|muesli|smoothie bowl|crepe/, 'breakfast'],
  [/soup|stew|chowder|bisque|ramen|pho|minestrone|dal|daal|dahl|chili\b/, 'soup'],
  [/salad|slaw/, 'salad'],
  [/smoothie|latte|juice|lemonade|milkshake|shake|hot chocolate|chai|cocktail|mocktail|horchata|\bmilk\b/, 'drink'],
  // Savory look-alikes stay out: crab cakes, pot pie, taco crumbles, caramelized onions.
  [/(?<!(?:crab|fish|potato|corn|rice) )cake|cookie|brownie|blondie|(?<!(?:pot|shepherd'?s|cottage|tamale|onion) )pie\b|tart\b|fudge|truffle|ice cream|nice cream|pudding|mousse|cheesecake|cupcake|crumble\b|cobbler|donut|doughnut|cinnamon roll|frosting|caramel\b|bark|sorbet|tiramisu|macaron|bonbon/, 'dessert'],
  [/bread|muffin|scone|bagel|focaccia|biscuit|rolls?\b|loaf|naan|tortilla|pretzel/, 'baking'],
  [/sauce|dressing|dip\b|hummus|pesto|gravy|vinaigrette|salsa|spread|butter\b|cheese sauce|mayo|aioli|ketchup|jam\b|chutney|seasoning|spice blend|marinade/, 'sauce'],
  [/energy balls?|bites|bars?\b|chips|popcorn|crackers|trail mix|roasted chickpeas|snack/, 'snack'],
  [/roasted .*(?:potato|carrot|broccoli|vegetable|cauliflower)|mashed|fries|rice\b|side/, 'side'],
  [/curry|pasta|lasagna|burger|tacos?|burrito|enchilada|bowl|stir[\s-]?fry|risotto|pizza|sandwich|wrap|casserole|noodles|mac and cheese|quesadilla|gnocchi|paella|tikka|masala|korma|shepherd|pot pie|loaf|meatballs|chili/, 'main']
];

const SWEET = /\b(?:sugar|maple syrup|agave|date syrup|coconut sugar|brown sugar|powdered sugar|chocolate|cocoa|cacao|vanilla|jam|banana|berr(?:y|ies)|strawberr|blueberr|raspberr|apple|pear|peach|mango|pineapple|cinnamon|caramel|marshmallow|sprinkles|dates?|raisins?|sweetener|stevia|monk fruit|molasses|frosting|icing)\b/;
const SAVORY = /\b(?:garlic|onion|shallot|soy sauce|tamari|miso|broth|stock|bouillon|nutritional yeast|cumin|paprika|chili|chilli|curry|turmeric|tomato|black pepper|mustard|vinegar|leek|celery|mushroom|tofu|tempeh|seitan|lentil|chickpea|beans?|potato|spinach|kale|cabbage|broccoli|zucchini|eggplant|bell pepper|olive|caper|herbs?|oregano|thyme|rosemary|basil|cilantro|parsley|ginger|sesame oil|sriracha|harissa|gochujang|liquid smoke|smoked)\b/;

const GLUTEN = /\b(?:all[\s-]purpose flour|wheat|spelt|barley|rye|semolina|seitan|vital wheat gluten|couscous|bulgur|farro|pasta|spaghetti|noodles?|bread|breadcrumbs?|panko|flour tortillas?|pita|naan|soy sauce|beer|cookies?|graham|crackers?|puff pastry|phyllo|filo)\b/;
const GLUTEN_SAFE = /\b(?:gluten[\s-]?free|gf|rice noodles?|tamari|chickpea pasta|lentil pasta|rice paper|buckwheat|soba \(100)/;
const NUTS = /\b(?:almonds?|cashews?|walnuts?|pecans?|hazelnuts?|pistachios?|macadamias?|brazil nuts?|pine nuts?|peanuts?|nut butter|almond|cashew|marzipan|praline|nutella|nuts?)\b/;
const SOY = /\b(?:tofu|tempeh|soy|soya|edamame|miso|tamari|shoyu|tvp|textured vegetable protein|soy curls?)\b/;
const OIL = /\b(?:oil|vegan butter|margarine|shortening|cooking spray)\b/;

function firstMeals(rules: [RegExp, Meal][], text: string): Meal[] {
  const out = new Set<Meal>();
  for (const [re, meal] of rules) if (re.test(text)) out.add(meal);
  return [...out];
}

export function classify(input: TagInput, ingredientNames?: string[]): Tag[] {
  const pack = languagePacks[input.contentLanguage ?? 'en'] ?? {};
  const title = input.title.toLowerCase();
  const categories = input.categories.join(' | ').toLowerCase();
  const keywords = input.keywords.join(' | ').toLowerCase();
  const names = ingredientNames ?? input.ingredients.map((line) => parseIngredient(line).name);
  const joined = names.join(' | ');
  const original = input.ingredients.join(' | ').toLowerCase();
  const rawJoined = ingredientNames ? `${original} | ${joined}` : original;
  const knownIngredients = (input.contentLanguage ?? 'en') === 'en' || !!ingredientNames && ingredientNames.every(Boolean);

  let meals = firstMeals(pack.meals ?? CATEGORY_MEALS, categories);
  const fromTitle = firstMeals(pack.meals ?? TITLE_MEALS, title);
  if (meals.length === 0) meals = fromTitle.slice(0, 1);
  // A title like "Chocolate Chip Cookies" outranks a vague "Snack" category, never a savory course.
  else if (fromTitle[0] === 'dessert' && !meals.some((m) => ['dessert', 'main', 'soup', 'salad', 'side'].includes(m))) meals.push('dessert');
  if (meals.length === 0) meals = ['main'];

  const tags: Tag[] = meals.map((m) => `meal:${m}` as const);

  const sweetHits = names.filter((n) => SWEET.test(n)).length;
  const savoryHits = names.filter((n) => SAVORY.test(n)).length;
  let flavor: Flavor;
  if (meals.includes('dessert') || (meals.includes('baking') && sweetHits > savoryHits)) flavor = 'sweet';
  else if (meals.some((m) => m === 'main' || m === 'soup' || m === 'side' || m === 'salad')) flavor = 'savory';
  else flavor = sweetHits > savoryHits ? 'sweet' : 'savory';
  tags.push(`flavor:${flavor}`);

  const claimsGf = (pack.glutenFree ?? /gluten[\s-]?free/).test(keywords + ' ' + title + ' ' + categories);
  const hasGluten = !!pack.ingredientRisks?.gluten.test(pack.glutenFree ? original.replace(pack.glutenFree, '') : original) || [...input.ingredients, ...ingredientNames ?? []].some((line) => {
    const l = line.toLowerCase();
    return GLUTEN.test(l) && !GLUTEN_SAFE.test(l);
  });
  if (knownIngredients) {
    if (claimsGf && !hasGluten) tags.push('free:gluten-free');
    if (!pack.ingredientRisks?.nuts.test(original) && !NUTS.test(joined) && !NUTS.test(rawJoined.replace(/coconut|nutmeg|nutritional|butternut|doughnut|donut|chestnut|water chestnut|tiger ?nut/g, ''))) tags.push('free:nut-free');
    if (!pack.ingredientRisks?.soy.test(original) && !SOY.test(rawJoined)) tags.push('free:soy-free');
    if (!pack.ingredientRisks?.oil.test(pack.oilFree ? original.replace(pack.oilFree, '') : original) && (!OIL.test(rawJoined.replace(/oil[\s-]free|optional[^|]*oil|oil[^|]*optional/g, '')) || (pack.oilFree ?? /oil[\s-]free/).test(keywords + title))) tags.push('free:oil-free');
  }

  if (input.protein !== null && input.protein >= 20) tags.push('high-protein');

  for (const cuisine of input.cuisines) {
    const original = cuisine.toLowerCase().replace(/[-\s]?inspired$/, '').trim();
    const c = pack.cuisines?.[original] ?? original;
    if (c && c.length < 30 && c !== 'vegan') tags.push(`cuisine:${c}`);
  }
  return [...new Set(tags)];
}
