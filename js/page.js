const MAX_RESULTS = 200;

// Add new search modes here. Each mode needs:
//   id       - unique string, used for element IDs
//   label    - display name
//   isValid  - returns true if the query makes sense for this mode; invalid modes are silently skipped
//   run      - executes the search, returns [word, rank][] or null (null = invalid pattern syntax)
const MODES = [
  {
    id: 'pattern',
    label: 'Pattern',
    isValid: (query) => query.length > 0,
    run: (search, query) => search.pattern(query),
  },
  {
    id: 'anagram',
    label: 'Anagram',
    isValid: (query) => /^[a-z]+$/i.test(query),
    run: (search, query) => search.anagram(query),
  },
];

const frequencyTier = (rank) => {
  if (rank < 1000) return 'tier-1';
  if (rank < 20000) return 'tier-2';
  return 'tier-3';
};

class ResultsSection {
  constructor(el, label) {
    this._el = el;
    this._label = label;
  }

  clear() {
    this._el.innerHTML = '';
  }

  show(pairs) {
    this.clear();

    const header = document.createElement('div');
    header.className = 'section-header';

    if (pairs === null) {
      header.textContent = `${this._label} · invalid pattern`;
      this._el.appendChild(header);
      return;
    }

    header.textContent = `${this._label} · `;
    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = `${pairs.length} result${pairs.length !== 1 ? 's' : ''}`;
    header.appendChild(count);
    this._el.appendChild(header);

    if (!pairs.length) return;

    const grid = document.createElement('div');
    grid.className = 'word-grid';
    pairs.slice(0, MAX_RESULTS).forEach(([word, rank]) => {
      const el = document.createElement('div');
      el.className = `word-item ${frequencyTier(rank)}`;
      el.textContent = word.toUpperCase();
      grid.appendChild(el);
    });
    this._el.appendChild(grid);

    if (pairs.length > MAX_RESULTS) {
      const note = document.createElement('p');
      note.className = 'more-note';
      note.textContent = `Showing ${MAX_RESULTS} of ${pairs.length}`;
      this._el.appendChild(note);
    }
  }
}

const buildModeToggles = (container) => {
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

  const syncAll = () => {
    allCb.checked = modeCbs.every(cb => cb.checked);
  };

  modeCbs.forEach(cb => cb.addEventListener('change', syncAll));

  allCb.addEventListener('change', () => {
    modeCbs.forEach(cb => { cb.checked = allCb.checked; });
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

const runSearch = (search, toggles, sections, val) => {
  history.replaceState(null, '', `?q=${encodeURIComponent(val)}`);
  MODES.forEach(mode => {
    if (toggles.isEnabled(mode.id) && mode.isValid(val)) {
      sections[mode.id].show(mode.run(search, val));
    } else {
      sections[mode.id].clear();
    }
  });
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
    sections[mode.id] = new ResultsSection(el, mode.label);
  });

  const toggles = buildModeToggles(document.getElementById('mode-toggles'));

  const setStatus = (msg) => { statusEl.textContent = msg; };

  const searchInput = document.getElementById('search-input');

  const doSearch = (val) => {
    setStatus('');
    if (!val) {
      MODES.forEach(mode => sections[mode.id].clear());
      history.replaceState(null, '', location.pathname);
      return;
    }
    runSearch(search, toggles, sections, val);
  };

  setStatus('Loading word list…');
  search.load()
    .then(() => {
      setStatus('');
      const initial = new URLSearchParams(location.search).get('q');
      if (initial) {
        searchInput.value = initial;
        doSearch(initial);
      }
    })
    .catch(() => setStatus('Failed to load word list.'));

  const debouncedSearch = debounce(() => doSearch(searchInput.value.trim()), 150);
  searchInput.addEventListener('input', debouncedSearch);

  // Enter key triggers immediately without waiting for debounce
  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    doSearch(searchInput.value.trim());
  });
};
