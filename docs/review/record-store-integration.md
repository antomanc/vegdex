# Record integration measurements

Measured on the same crawl store before and after the implementation. The provided generated dataset is also reported because it predates the fresh baseline emit. Generated files stay outside git.

## Publication gate

Published: 16,202 → 16,199; held: 33 → 35; excluded: 196 → 197. All three changes follow. No excluded recipe became published. The raw-text and existing concept checks are unchanged.

| Recipe | Change | Source line and reason |
| --- | --- | --- |
| Insalata autunnale con fichi e pere \| Piatto unico completo (`T-5mCBizM0`) | published → held | Semi di zucca e mirtilli rossi essiccati (facoltatitivi) — the separate dried-cranberry part has no exact English concept. |
| Torta al grano saraceno \| Vegana e senza glutine (`yu-ECRXf_F`) | published → held | Il succo di mezzo limone bio + la sua buccia scorza grattugiata — the separate organic-lemon-zest part has no exact English concept. |
| Yasai Yakisoba (`I8p-caVZxE`) | published → excluded | veggies or meat that can be added: red bell pepper (sliced mushrooms, shallots, chicken, pork etc) — exact chicken and pork concepts add vegan-check hits. |

The alternative blend in the potato focaccia record was corrected to one ingredient with alternatives, rather than three ingredients to buy. Contextual plant dairy qualifiers and a serving-suggestion classification were repaired in records. Unresolved additional parts do not inherit another ingredient’s concept.

## English fallback on Italian pages

Counts are original ingredient lines from English recipes; hidden headings and other lines do not count. A line falls back when any visible part cannot render in Italian. Recipe share counts recipes with at least one such line.

| Dataset | English lines / eligible lines | Share | Recipes with a fallback / English recipes | Share |
| --- | ---: | ---: | ---: | ---: |
| Provided dataset | 9,576 / 205,384 | 4.662% | 6,362 / 16,036 | 39.673% |
| Fresh baseline emit | 9,356 / 205,402 | 4.555% | 6,252 / 16,036 | 38.987% |
| Records emit | 819 / 205,366 | 0.399% | 771 / 16,035 | 4.808% |

## JSON payload size

Bytes, raw / gzip (gzip per file, default compression). First page means `first.json`, the initial 96-card data payload; it excludes HTML, JS, images and the later catalog/lookup/overlay downloads. Details are the sum of all detail shards.

| Dataset | catalog.json | Details | First page |
| --- | ---: | ---: | ---: |
| Provided dataset | 9,283,404 / 2,230,383 | 78,286,197 / 9,694,421 | 76,373 / 22,988 |
| Fresh baseline emit | 9,281,731 / 2,228,094 | 78,851,960 / 9,726,811 | 75,636 / 22,929 |
| Records emit | 9,209,825 / 2,206,786 | 96,063,475 / 12,384,697 | 75,237 / 22,729 |

## Golden and checks

500 original lines and every `expected` value are unchanged. 27 exact matches were promoted: 372 ok, 111 known-bad, 17 unreviewed. `pnpm golden`: zero differences.

Validation: typecheck (zero errors/warnings), knip, 488 Vitest tests in 39 files, build, full Playwright suite, and Trail check. Playwright: 308 passed, 1 skipped, zero failures or flakes. All 500 golden lines also match the actual emitted renders. Generated e2e fixtures are restored; fixture image requests use the existing image stub to avoid live-publisher navigation timeouts.

The existing audit scorer was run against the local audit without any model calls. It still scores the parser alone, so its wording flags are not a score for the output with records. The golden path uses the shared record composition function.

## Random rendered sample

Seed 42; 40 English-source lines read in both languages and both unit settings. This includes remaining fallbacks and parser amount oddities; none are hidden.

| # | Raw line | English metric | English US | Italian metric | Italian US |
| --- | --- | --- | --- | --- | --- |
| 1 | 1/4 teaspoon cayenne, (optional) | ¼ tsp cayenne pepper, optional | ¼ tsp cayenne pepper, optional | ¼ cucchiaino di peperoncino di Cayenna, facoltativo | ¼ cucchiaino di peperoncino di Cayenna, facoltativo |
| 2 | 1 teaspoon oil | 1 tsp oil | 1 tsp oil | 1 cucchiaino di olio | 1 cucchiaino di olio |
| 3 | ½ cup coconut milk | 120 ml coconut milk | ½ cup coconut milk | 120 ml di latte di cocco | ½ tazza di latte di cocco |
| 4 | 2 medium carrots ((sliced)) | 2 medium carrots, sliced | 2 medium carrots, sliced | 2 carote medie, tagliate a fette | 2 carote medie, tagliate a fette |
| 5 | 1/2 teaspoon ancho chile powder | ½ tsp ancho chile powder | ½ tsp ancho chile powder | ½ cucchiaino di peperoncino ancho in polvere | ½ cucchiaino di peperoncino ancho in polvere |
| 6 | 1/2 cup chopped fresh dill | ≈ 8 g fresh dill, chopped | ½ cup fresh dill, chopped | ≈ 8 g di aneto fresco, tritato | ½ tazza di aneto fresco, tritato |
| 7 | 2 plum tomatoes (chopped) | 2 plum tomatoes, chopped | 2 plum tomatoes, chopped | 2 pomodori oblunghi, tagliati a pezzi | 2 pomodori oblunghi, tagliati a pezzi |
| 8 | 1/2 cup sunflower seeds or pepitas or heaping 1/2 cup nuts such as walnuts or pecans if you are ok with nuts. | ≈ 70 g sunflower seeds or pepitas or nuts or walnuts | ½ cup sunflower seeds or pepitas or nuts or walnuts | ≈ 70 g di semi di girasole o semi di zucca o frutta secca o noci | ½ tazza di semi di girasole o semi di zucca o frutta secca o noci |
| 9 | 1 Tbsp EVOO (extra virgin olive oil) | 1 tbsp extra virgin olive oil | 1 tbsp extra virgin olive oil | 1 cucchiaio di olio extravergine d'oliva | 1 cucchiaio di olio extravergine d'oliva |
| 10 | 1/4 tsp nutmeg | ¼ tsp nutmeg | ¼ tsp nutmeg | ¼ cucchiaino di noce moscata | ¼ cucchiaino di noce moscata |
| 11 | 1/2 teaspoon guar gum (if you don't got guar gum, you can also leave it out and double the amount of oil instead) | ½ tsp guar gum, optional | ½ tsp guar gum, optional | ½ cucchiaino di gomma di guar, facoltativa | ½ cucchiaino di gomma di guar, facoltativa |
| 12 | 1 tablespoon plant-based milk or water | 1 tbsp plant-based milk or water | 1 tbsp plant-based milk or water | 1 cucchiaio di latte vegetale o acqua | 1 cucchiaio di latte vegetale o acqua |
| 13 | 1 Avocado | 1 avocado | 1 avocado | 1 avocado | 1 avocado |
| 14 | fresh chives, cut into rings | fresh chives, cut into rings | fresh chives, cut into rings | erba cipollina fresca, tagliata ad anellini | erba cipollina fresca, tagliata ad anellini |
| 15 | melon (watermelon, cantaloupe, etc.) | melon or watermelon or cantaloupe | melon or watermelon or cantaloupe | melone o anguria o melone cantalupo | melone o anguria o melone cantalupo |
| 16 | 1 1/2 teaspoon coriander powder | 1 ½ tsp ground coriander | 1 ½ tsp ground coriander | 1 ½ cucchiaini di coriandolo macinato | 1 ½ cucchiaini di coriandolo macinato |
| 17 | 2 teaspoons ground cinnamon | 2 tsp ground cinnamon | 2 tsp ground cinnamon | 2 cucchiaini di cannella in polvere | 2 cucchiaini di cannella in polvere |
| 18 | 1 bar of dark chocolate ((make sure it's vegan)) | 1 bar vegan dark chocolate | 1 bar vegan dark chocolate | 1 tavoletta di cioccolato fondente vegano | 1 tavoletta di cioccolato fondente vegano |
| 19 | 1 large zucchini grated - about 1.25 cups | 1 large zucchini, grated | 1 large zucchini, grated | 1 zucchina grande, grattugiata | 1 zucchina grande, grattugiata |
| 20 | 2 large eggplants ((cut length wise into 1/4" fillets)) | 2 large eggplants, cut lengthwise into 1/4-inch fillets | 2 large eggplants, cut lengthwise into 1/4-inch fillets | 2 melanzane grandi, tagliate per il lungo in fette di circa 6 mm | 2 melanzane grandi, tagliate per il lungo in fette di circa 6 mm |
| 21 | 1/2 cup chopped red bell pepper | ≈ 75 g red bell pepper, chopped | ½ cup red bell pepper, chopped | ≈ 75 g di peperone rosso, tagliato a pezzi | ½ tazza di peperone rosso, tagliato a pezzi |
| 22 | 3 cloves garlic, (minced) | 3 cloves garlic, minced | 3 cloves garlic, minced | 3 spicchi di aglio, tritato | 3 spicchi di aglio, tritato |
| 23 | 1/2 cup vegan butter, slightly softened | ≈ 115 g vegan butter, slightly softened | ½ cup vegan butter, slightly softened | ≈ 115 g di burro vegetale, leggermente ammorbidito | ½ tazza di burro vegetale, leggermente ammorbidito |
| 24 | 2 cups brown sugar | ≈ 440 g brown sugar | 2 cups brown sugar | ≈ 440 g di zucchero di canna | 2 tazze di zucchero di canna |
| 25 | 6 tablespoons (1/3 cup) tahini or vegan mayo | 6 tbsp tahini or vegan mayo | 6 tbsp tahini or vegan mayo | 6 cucchiai di tahina o maionese vegana | 6 cucchiai di tahina o maionese vegana |
| 26 | 1/4 cup + 2 tablespoons (120g) maple syrup | 120 g maple syrup | ⅜ cup (120 g) maple syrup | 120 g di sciroppo d'acero | ⅜ tazza (120 g) di sciroppo d'acero |
| 27 | 1/3 to 1/2 cup vegan Enjoy Life mini chocolate chips (or vegan dark chocolate chunks by Theo to make palm oil-free.) | ≈ 55–85 g vegan mini chocolate chips or vegan dark chocolate chunks | ⅓–½ cup vegan mini chocolate chips or vegan dark chocolate chunks | ≈ 55–85 g di mini gocce di cioccolato vegane o pezzetti di cioccolato fondente vegano | ⅓–½ tazza di mini gocce di cioccolato vegane o pezzetti di cioccolato fondente vegano |
| 28 | 2 tablespoons red curry paste | 2 tbsp red curry paste | 2 tbsp red curry paste | 2 cucchiai di pasta di curry rosso | 2 cucchiai di pasta di curry rosso |
| 29 | 8 cups vegetable broth (, low sodium) | 1.9 l low-sodium vegetable broth | 8 cups low-sodium vegetable broth | 1,9 l di brodo vegetale a basso contenuto di sodio | 8 tazze di brodo vegetale a basso contenuto di sodio |
| 30 | Whole wheat bread | whole wheat bread | whole wheat bread | pane integrale | pane integrale |
| 31 | 1 tbsp maple syrup | 1 tbsp maple syrup | 1 tbsp maple syrup | 1 cucchiaio di sciroppo d'acero | 1 cucchiaio di sciroppo d'acero |
| 32 | 2 garlic cloves (minced) | 2 cloves garlic, minced | 2 cloves garlic, minced | 2 spicchi di aglio, tritato finemente | 2 spicchi di aglio, tritato finemente |
| 33 | salt to taste | salt, to taste | salt, to taste | sale, quanto basta | sale, quanto basta |
| 34 | 1 tablespoon lemon juice | 1 tbsp lemon juice | 1 tbsp lemon juice | 1 cucchiaio di succo di limone | 1 cucchiaio di succo di limone |
| 35 | 2-3 tablespoons fresh lemon juice (juice of 1 lemon) | 2–3 tbsp fresh lemon juice | 2–3 tbsp fresh lemon juice | 2–3 cucchiai di succo di limone fresco | 2–3 cucchiai di succo di limone fresco |
| 36 | about 3 tbsp vegan fish sauce or tamari / soy sauce | about 3 tbsp vegan fish sauce or tamari or soy sauce | about 3 tbsp vegan fish sauce or tamari or soy sauce | circa 3 cucchiai di salsa di pesce vegana o tamari o salsa di soia | circa 3 cucchiai di salsa di pesce vegana o tamari o salsa di soia |
| 37 | ½ teaspoon onion powder | ½ tsp onion powder | ½ tsp onion powder | ½ cucchiaino di cipolla in polvere | ½ cucchiaino di cipolla in polvere |
| 38 | 1/4 tsp black pepper | ¼ tsp black pepper | ¼ tsp black pepper | ¼ cucchiaino di pepe nero | ¼ cucchiaino di pepe nero |
| 39 | 1 tablespoon kitchen bouquet (optional, see Notes) | 1 tbsp Kitchen Bouquet, optional | 1 tbsp Kitchen Bouquet, optional | 1 cucchiaio di Kitchen Bouquet | 1 cucchiaio di Kitchen Bouquet |
| 40 | 3 tablespoons olive oil (45mL) | 3 tbsp (45 ml) olive oil | 3 tbsp (45 ml) olive oil | 3 cucchiai (45 ml) di olio d'oliva | 3 cucchiai (45 ml) di olio d'oliva |

## Follow-up

Review the remaining 111 known-bad goldens, record wording and grammatical agreement, exact concepts for held parts, and the larger detail payload. The audit scorer should use the same composition function before its results can measure shipped output. Parser amount defects remain parser work.

The first baseline CLI invocation also rewrote the local held/excluded reports beside the read-only input store; the input store and provided full dataset were not changed. Subsequent emits used a workspace copy of the store.
