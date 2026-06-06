const MAX_RESULTS = 200;

// Returns CSS tier class based on index in the frequency-ordered word list.
const frequencyTier = (index) => {
  if (index < 1000) return 'tier-1';
  if (index < 20000) return 'tier-2';
  return 'tier-3';
};

class ResultsView {
  constructor(container) {
    this._container = container;
  }

  clear() {
    this._container.innerHTML = '';
  }

  showWords(words, query) {
    this.clear();

    const header = document.createElement('div');
    header.className = 'results-header';
    header.textContent = words.length
      ? `${words.length} result${words.length !== 1 ? 's' : ''} for "${query.toUpperCase()}"`
      : `No results for "${query.toUpperCase()}"`;
    this._container.appendChild(header);

    if (!words.length) return;

    const grid = document.createElement('div');
    grid.className = 'word-grid';
    words.slice(0, MAX_RESULTS).forEach(([word, rank]) => {
      const el = document.createElement('div');
      el.className = `word-item ${frequencyTier(rank)}`;
      el.textContent = word.toUpperCase();
      grid.appendChild(el);
    });
    this._container.appendChild(grid);

    if (words.length > MAX_RESULTS) {
      const note = document.createElement('p');
      note.className = 'more-note';
      note.textContent = `Showing ${MAX_RESULTS} of ${words.length} results`;
      this._container.appendChild(note);
    }

    const legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML = `
      <span class="legend-item"><span class="legend-dot tier-1"></span> Common</span>
      <span class="legend-item"><span class="legend-dot tier-2"></span> Moderate</span>
      <span class="legend-item"><span class="legend-dot tier-3"></span> Rare</span>
    `;
    this._container.appendChild(legend);
  }

  showError(msg) {
    this.clear();
    const el = document.createElement('div');
    el.className = 'results-header';
    el.textContent = msg;
    this._container.appendChild(el);
  }
}

const initPage = () => {
  const search = new WordSearch();
  const results = new ResultsView(document.getElementById('results'));
  const statusEl = document.getElementById('status');

  const setStatus = (msg) => { statusEl.textContent = msg; };

  setStatus('Loading word list…');
  search.load()
    .then(() => setStatus(''))
    .catch(() => setStatus('Failed to load word list.'));

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab + '-panel').classList.add('active');
      results.clear();
      setStatus('');
    });
  });

  const patternInput = document.getElementById('pattern-input');
  document.getElementById('pattern-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = patternInput.value.trim();
    if (!val) return;

    search.load().then(() => {
      const matches = search.pattern(val);
      if (matches === null) {
        patternInput.classList.add('input-error');
        setTimeout(() => patternInput.classList.remove('input-error'), 600);
        setStatus('Invalid pattern.');
        return;
      }
      setStatus('');
      results.showWords(matches, val);
    });
  });

  const anagramInput = document.getElementById('anagram-input');
  document.getElementById('anagram-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = anagramInput.value.trim();
    if (!val) return;

    search.load().then(() => {
      const matches = search.anagram(val);
      setStatus('');
      results.showWords(matches, val);
    });
  });
};
