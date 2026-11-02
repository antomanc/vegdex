const acronyms = new Set(['BBQ', 'BLT', 'PB&J', 'DIY', 'GF', 'DF', 'WFPB']);

/** Repair shouting titles and lowercase starts; retain the publisher's other casing. */
export function normalizeTitle(title: string, language: string): string {
  if (title !== title.toLowerCase() && title === title.toUpperCase()) {
    let first = true;
    return title.replace(/\p{L}+(?:&\p{L}+)?(?:['’]\p{L}+)?/gu, (word) => {
      const capitalize = language === 'en' || first;
      first = false;
      if (acronyms.has(word)) return word;
      const lower = word.toLowerCase();
      return capitalize ? lower[0]!.toUpperCase() + lower.slice(1) : lower;
    });
  }
  return title.replace(/\p{L}/u, (letter) => letter.toUpperCase());
}
