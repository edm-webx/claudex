// Lead-owned. Assembles the Content registry from content modules. Builders add their tables by asking the lead
// to import them here (one line each) so this file never has two writers. M0 kickoff: empty tables.
import type { Content, ContentRegistry, ContentTable } from './types';
import { CITIZENS, CROWD_BUDGET } from './citizens';
import { CLIPS } from './clips';
import { EFFECTS } from './effects';
import { FACES } from './faces';

export function emptyContent(): Content {
  return {
    hash: 'kickoff', products: {} as Content['products'], productIds: [], sets: [], stations: {}, citizens: CITIZENS,
    crowdBudget: CROWD_BUDGET,
    economy: {}, zones: {}, prefabs: {}, effects: EFFECTS, clips: CLIPS, faces: FACES, art: {}, lines: {}, uiText: {},
  };
}

export function createContent(initial: Content = emptyContent()): ContentRegistry {
  let c = initial;
  const subs = new Set<(t: ContentTable) => void>();
  return {
    get: () => c,
    replace(table, value) {
      c = { ...c, [table]: value };
      subs.forEach(cb => cb(table));
    },
    onReplace(cb) { subs.add(cb); return () => { subs.delete(cb); }; },
  };
}
