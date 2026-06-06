const frequencyTier = (rank) => {
  if (rank < 1000) return 'tier-1';
  if (rank < 20000) return 'tier-2';
  return 'tier-3';
};

// Factory for modes whose results render as a flat word grid.
const makeWordMode = (id, label, isValid, run) => ({
  id,
  label,
  maxResults: 200,
  defaultShow: 20,
  gridClass: 'word-grid',
  isValid,
  run,
  renderResult: ([word, rank]) => {
    const el = document.createElement('div');
    el.className = `word-item ${frequencyTier(rank)}`;
    el.textContent = word.toUpperCase();
    return el;
  },
});

// ---- Mode definitions ----
// Each mode is self-contained: isValid, run, renderResult, maxResults, gridClass.

const matchMode = makeWordMode(
  'match', 'Match',
  (query) => query.length > 0,
  (search, query) => search.match(query),
);

const makeEdgeMode = (id, label, run) => {
  const renderResult = ({ word, rank, before, match, after }) => {
    const el = document.createElement('div');
    el.className = `word-item ${frequencyTier(rank)}`;
    const addSpan = (cls, text) => {
      const s = document.createElement('span');
      s.className = cls;
      s.textContent = text.toUpperCase();
      el.appendChild(s);
    };
    if (before) addSpan('contains-ctx', before);
    addSpan('contains-match', match);
    if (after) addSpan('contains-ctx', after);
    return el;
  };
  return {
    id, label, maxResults: 200, defaultShow: 20, gridClass: 'word-grid',
    isValid: q => q.length > 0, run, renderResult,
  };
};

const containsMode = makeEdgeMode('contains', 'Contains', (s, q) => s.contains(q));
const prefixMode = makeEdgeMode('prefix', 'Prefix', (s, q) => s.prefix(q));
const suffixMode = makeEdgeMode('suffix', 'Suffix', (s, q) => s.suffix(q));

const anagramMode = makeWordMode(
  'anagram', 'Anagram',
  (query) => /^[a-z]+$/i.test(query),
  (search, query) => search.anagram(query),
);

const hasMid = (midOptions) => midOptions[0].length > 0;

const makeHiddenMode = (id, label, run) => {
  const renderResult = ({ tail, head, midOptions, w0Words, wLastWords, topPairs }) => {
    const el = document.createElement('div');
    el.className = 'hidden-group';

    // Split label: …TAIL [UPON / UP·ON] HEAD…
    const splitEl = document.createElement('div');
    splitEl.className = 'hidden-split';
    const addSplit = (cls, text) => {
      const s = document.createElement('span');
      s.className = cls;
      s.textContent = text;
      splitEl.appendChild(s);
    };
    addSplit('hs-ctx', '…');
    addSplit('hs-match', tail.toUpperCase());
    if (hasMid(midOptions)) {
      addSplit('hs-ctx', ' [');
      midOptions.forEach((opt, i) => {
        if (i > 0) addSplit('hs-ctx', ' / ');
        opt.forEach((word, j) => {
          if (j > 0) addSplit('hs-sep', '·');
          addSplit('hs-mid', word.toUpperCase());
        });
      });
      addSplit('hs-ctx', ']');
    }
    addSplit('hs-ctx', ' ');
    addSplit('hs-match', head.toUpperCase());
    addSplit('hs-ctx', '…');
    el.appendChild(splitEl);

    // End-word pill sets
    const pairEl = document.createElement('div');
    pairEl.className = 'hidden-pair';

    const makeWordEl = (word, rank, matchPart, isTail) => {
      const wEl = document.createElement('span');
      wEl.className = `hw ${frequencyTier(rank)}`;
      const addPart = (cls, text) => {
        const s = document.createElement('span');
        s.className = cls;
        s.textContent = text.toUpperCase();
        wEl.appendChild(s);
      };
      if (isTail) {
        const before = word.slice(0, word.length - matchPart.length);
        if (before) addPart('hw-ctx', before);
        addPart('hw-hit', matchPart);
      } else {
        addPart('hw-hit', matchPart);
        const after = word.slice(matchPart.length);
        if (after) addPart('hw-ctx', after);
      }
      return wEl;
    };

    const w0El = document.createElement('div');
    w0El.className = 'hidden-words';
    w0Words.forEach(([word, rank]) => w0El.appendChild(makeWordEl(word, rank, tail, true)));

    const arrowEl = document.createElement('div');
    if (hasMid(midOptions)) {
      arrowEl.className = 'hidden-mid-label';
      midOptions.forEach(opt => {
        const line = document.createElement('div');
        opt.forEach((word, i) => {
          if (i > 0) {
            const sep = document.createElement('span');
            sep.className = 'hml-sep';
            sep.textContent = '·';
            line.appendChild(sep);
          }
          const s = document.createElement('span');
          s.textContent = word.toUpperCase();
          line.appendChild(s);
        });
        arrowEl.appendChild(line);
      });
    } else {
      arrowEl.className = 'hidden-arrow';
      arrowEl.textContent = '→';
    }

    const wLEl = document.createElement('div');
    wLEl.className = 'hidden-words';
    wLastWords.forEach(([word, rank]) => wLEl.appendChild(makeWordEl(word, rank, head, false)));

    pairEl.append(w0El, arrowEl, wLEl);
    el.appendChild(pairEl);

    // Top example phrases
    if (topPairs.length) {
      const examplesEl = document.createElement('div');
      examplesEl.className = 'hidden-examples';

      // Interleave mid options so each gets at least one example
      const examples = [];
      outer: for (const { w0, wLast } of topPairs) {
        for (const midWords of midOptions) {
          examples.push({ w0, wLast, midWords });
          if (examples.length >= 4) break outer;
        }
      }

      for (const { w0, wLast, midWords } of examples) {
        const chip = document.createElement('span');
        chip.className = 'hx';

        const addStr = (cls, text) => {
          const s = document.createElement('span');
          s.className = cls;
          s.textContent = text;
          chip.appendChild(s);
        };

        const before = w0.slice(0, w0.length - tail.length);
        if (before) addStr('hx-ctx', before.toUpperCase());
        addStr('hx-hit', tail.toUpperCase());

        for (const mid of midWords) {
          addStr('hx-sep', '·');
          addStr('hx-mid', mid.toUpperCase());
        }

        addStr('hx-sep', '·');
        addStr('hx-hit', head.toUpperCase());
        const after = wLast.slice(head.length);
        if (after) addStr('hx-ctx', after.toUpperCase());

        examplesEl.appendChild(chip);
      }

      el.appendChild(examplesEl);
    }

    return el;
  };
  return {
    id, label, maxResults: 60, defaultShow: 1, gridClass: 'grid-hidden',
    isValid: q => /^[a-z]+$/i.test(q), run, renderResult,
  };
};

const hiddenMode = makeHiddenMode('hidden', 'Hidden', (s, q) => s.hidden(q));
const hiddenReverseMode = makeHiddenMode('hiddenrev', 'Hidden reverse', (s, q) => s.hiddenReverse(q));

const MODES = [matchMode, containsMode, prefixMode, suffixMode, anagramMode, hiddenMode, hiddenReverseMode];

// ---- Shared UI ----

class ResultsSection {
  constructor(el, label, renderResult, maxResults, defaultShow, gridClass) {
    this._el = el;
    this._label = label;
    this._renderResult = renderResult;
    this._maxResults = maxResults;
    this._defaultShow = defaultShow;
    this._gridClass = gridClass;
    this._expanded = false;
    this._items = null;
  }

  clear() {
    this._el.innerHTML = '';
    this._items = null;
    this._expanded = false;
  }

  show(items) {
    this._items = items;
    this._expanded = false;
    this._render();
  }

  _render() {
    this._el.innerHTML = '';
    const items = this._items;

    const header = document.createElement('div');
    header.className = 'section-header';

    if (items === null) {
      header.textContent = `${this._label} · invalid pattern`;
      this._el.appendChild(header);
      return;
    }

    header.textContent = `${this._label} · `;
    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = `${items.length} result${items.length !== 1 ? 's' : ''}`;
    header.appendChild(count);
    this._el.appendChild(header);

    if (!items.length) return;

    const showCount = this._expanded
      ? Math.min(items.length, this._maxResults)
      : Math.min(items.length, this._defaultShow);

    const grid = document.createElement('div');
    grid.className = this._gridClass;
    items.slice(0, showCount).forEach(item => {
      grid.appendChild(this._renderResult(item));
    });
    this._el.appendChild(grid);

    if (this._expanded && items.length > this._maxResults) {
      const note = document.createElement('p');
      note.className = 'more-note';
      note.textContent = `Showing ${this._maxResults} of ${items.length}`;
      this._el.appendChild(note);
    }

    if (items.length > this._defaultShow) {
      const toggle = document.createElement('button');
      toggle.className = 'expand-toggle';
      if (this._expanded) {
        toggle.textContent = 'Show fewer';
        toggle.addEventListener('click', () => { this._expanded = false; this._render(); });
      } else {
        const more = Math.min(items.length, this._maxResults) - this._defaultShow;
        toggle.textContent = `Show ${more} more`;
        toggle.addEventListener('click', () => { this._expanded = true; this._render(); });
      }
      this._el.appendChild(toggle);
    }
  }
}

// onToggle(modeId, enabled) is called whenever an individual mode's state changes.
const buildModeToggles = (container, onToggle) => {
  const makeToggle = (id, label, extraClass = '') => {
    const lbl = document.createElement('label');
    lbl.className = `mode-toggle${extraClass ? ' ' + extraClass : ''}`;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = id;
    cb.checked = true;
    const span = document.createElement('span');
    span.textContent = label;
    lbl.appendChild(cb);
    lbl.appendChild(span);
    container.appendChild(lbl);
    return cb;
  };

  const allCb = makeToggle('mode-all', 'All', 'mode-all');

  const divider = document.createElement('span');
  divider.className = 'modes-divider';
  container.appendChild(divider);

  const modeCbs = MODES.map(m => makeToggle(`mode-${m.id}`, m.label));

  modeCbs.forEach((cb, i) => cb.addEventListener('change', () => {
    allCb.checked = modeCbs.every(c => c.checked);
    onToggle(MODES[i].id, cb.checked);
  }));

  allCb.addEventListener('change', () => {
    modeCbs.forEach(cb => { cb.checked = allCb.checked; });
    MODES.forEach(mode => onToggle(mode.id, allCb.checked));
  });

  return {
    isEnabled: (modeId) => document.getElementById(`mode-${modeId}`).checked,
  };
};

const debounce = (fn, ms) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

const initPage = () => {
  const search = new WordSearch();
  const statusEl = document.getElementById('status');
  const resultsEl = document.getElementById('results');

  const sections = {};
  MODES.forEach(mode => {
    const el = document.createElement('div');
    el.className = 'result-section';
    resultsEl.appendChild(el);
    sections[mode.id] = new ResultsSection(
      el, mode.label, mode.renderResult, mode.maxResults, mode.defaultShow, mode.gridClass
    );
  });

  let currentQuery = '';
  let resultCache = new Map();  // modeId → items, valid for currentQuery

  // Show a mode from cache, computing its result first if not yet cached.
  const showMode = (mode) => {
    if (!resultCache.has(mode.id)) {
      resultCache.set(mode.id, mode.run(search, currentQuery));
    }
    sections[mode.id].show(resultCache.get(mode.id));
  };

  const toggles = buildModeToggles(document.getElementById('mode-toggles'), (modeId, enabled) => {
    if (!currentQuery) return;
    const mode = MODES.find(m => m.id === modeId);
    if (!enabled) {
      sections[modeId].clear();
    } else if (mode.isValid(currentQuery)) {
      showMode(mode);  // uses cache if already computed, otherwise runs now
    }
  });

  const setStatus = (msg) => { statusEl.textContent = msg; };
  const searchInput = document.getElementById('search-input');

  const doSearch = (val) => {
    setStatus('');
    if (!val) {
      currentQuery = '';
      resultCache = new Map();
      MODES.forEach(mode => sections[mode.id].clear());
      history.replaceState(null, '', location.pathname);
      return;
    }
    currentQuery = val;
    resultCache = new Map();  // new query, discard cached results
    history.replaceState(null, '', `?q=${encodeURIComponent(val)}`);
    MODES.forEach(mode => {
      if (toggles.isEnabled(mode.id) && mode.isValid(val)) {
        showMode(mode);
      } else {
        sections[mode.id].clear();
      }
    });
  };

  setStatus('Loading word list…');
  search.load()
    .then(() => {
      setStatus('');
      const initial = new URLSearchParams(location.search).get('q');
      if (initial) { searchInput.value = initial; doSearch(initial); }
    })
    .catch(() => setStatus('Failed to load word list.'));

  searchInput.addEventListener('input', debounce(() => doSearch(searchInput.value.trim()), 150));
  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    doSearch(searchInput.value.trim());
  });
};
