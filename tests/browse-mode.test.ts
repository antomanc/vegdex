import { describe, expect, it } from 'vitest';
import { browseMode, showCatalog, showShelf, showSaved, type BrowseState } from '../apps/web/src/lib/browse-mode';

const state = (patch: Partial<BrowseState> = {}): BrowseState => ({ saved: false, from: null, ...patch });

describe('browseMode', () => {
  it('opens on the whole catalog', () => {
    expect(browseMode(state())).toBe('catalog');
  });

  it('shows a blog shelf until the saved view covers it', () => {
    const f = state();
    showShelf(f, 'elavegan');
    expect(browseMode(f)).toBe('shelf');

    // The saved view is opened from the shelf, and closing it returns there.
    showSaved(f, true);
    expect(browseMode(f)).toBe('saved');
    showSaved(f, false);
    expect(browseMode(f)).toBe('shelf');
  });

  it('leaves the saved view and the shelf for the whole catalog', () => {
    const f = state();
    showShelf(f, 'elavegan');
    showSaved(f, true);
    showCatalog(f);
    expect(browseMode(f)).toBe('catalog');
  });
});
