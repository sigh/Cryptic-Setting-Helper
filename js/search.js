class WordSearch {
  _words = null;
  _anagramIndex = null;  // Map<sorted-letters, [word, rank][]>
  _loadPromise = null;

  load() {
    if (this._loadPromise) return this._loadPromise;
    this._loadPromise = fetch('data/words.txt')
      .then(r => r.text())
      .then(text => {
        this._words = text.trim().split('\n');
        this._anagramIndex = new Map();
        this._words.forEach((w, i) => {
          const key = w.split('').sort().join('');
          if (!this._anagramIndex.has(key)) this._anagramIndex.set(key, []);
          this._anagramIndex.get(key).push([w, i]);
        });
      });
    return this._loadPromise;
  }

  // Returns [word, rank] pairs in frequency order, or null if pattern is invalid.
  pattern(patternStr) {
    const regex = this._patternToRegex(patternStr);
    if (!regex) return null;
    return this._words
      .map((w, i) => [w, i])
      .filter(([w]) => regex.test(w));
  }

  // Returns [word, rank] pairs in frequency order via pre-built index.
  anagram(letters) {
    const cleaned = letters.toLowerCase().replace(/[^a-z]/g, '');
    if (!cleaned.length) return [];
    const key = cleaned.split('').sort().join('');
    return this._anagramIndex.get(key) || [];
  }

  _patternToRegex(pattern) {
    let regexStr = '^';
    const lower = pattern.toLowerCase();
    let i = 0;
    while (i < lower.length) {
      const c = lower[i];
      if (c === '?' || c === '.') {
        regexStr += '[a-z]';
        i++;
      } else if (c === '[') {
        const j = lower.indexOf(']', i);
        if (j === -1) return null;
        regexStr += lower.slice(i, j + 1);
        i = j + 1;
      } else if (/[a-z]/.test(c)) {
        regexStr += c;
        i++;
      } else {
        return null;
      }
    }
    regexStr += '$';
    try {
      return new RegExp(regexStr);
    } catch (_) {
      return null;
    }
  }
}
