class WordSearch {
  _words = null;
  _wordRank = null;       // Map<word, rank> for O(1) lookup
  _anagramIndex = null;   // Map<sorted-letters, [word, rank][]>
  _sortedWords = null;    // [[word, rank], ...] sorted alphabetically — prefix search
  _sortedReversed = null; // [[reversed, word, rank], ...] sorted alphabetically — suffix search
  _loadPromise = null;

  load() {
    if (this._loadPromise) return this._loadPromise;
    this._loadPromise = fetch('data/words.txt')
      .then(r => r.text())
      .then(text => {
        this._words = text.trim().split('\n');

        this._wordRank = new Map();
        this._anagramIndex = new Map();
        this._words.forEach((w, i) => {
          this._wordRank.set(w, i);
          const key = w.split('').sort().join('');
          if (!this._anagramIndex.has(key)) this._anagramIndex.set(key, []);
          this._anagramIndex.get(key).push([w, i]);
        });

        this._sortedWords = this._words
          .map((w, i) => [w, i])
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

        this._sortedReversed = this._words
          .map((w, i) => [w.split('').reverse().join(''), w, i])
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      });
    return this._loadPromise;
  }

  // Returns [word, rank][] in frequency order, or null if pattern is invalid.
  match(patternStr) {
    const inner = this._patternToInner(patternStr);
    if (inner === null) return null;
    let regex;
    try { regex = new RegExp(`^${inner}$`); } catch (_) { return null; }
    return this._words.map((w, i) => [w, i]).filter(([w]) => regex.test(w));
  }

  // Returns {word, rank, before, match, after}[] for words containing the pattern
  // strictly in their interior (at least one char on each side). Null if invalid.
  contains(patternStr) {
    const inner = this._patternToInner(patternStr);
    if (inner === null) return null;
    let regex;
    try { regex = new RegExp(inner); } catch (_) { return null; }
    const results = [];
    for (let i = 0; i < this._words.length; i++) {
      const w = this._words[i];
      const m = regex.exec(w);
      if (m && m.index > 0 && m.index + m[0].length < w.length) {
        results.push({ word: w, rank: i, before: w.slice(0, m.index), match: m[0], after: w.slice(m.index + m[0].length) });
      }
    }
    return results;
  }

  // Returns { words: [word, rank][], rank }[] sorted by rank.
  // Includes single-word and multi-word anagrams.
  // Excludes results where words.join('') === cleaned query (same letter order as input).
  anagram(letters) {
    const cleaned = letters.toLowerCase().replace(/[^a-z]/g, '');
    if (!cleaned.length) return [];

    const queryKey = cleaned.split('').sort().join('');
    const results = [];

    // Single-word anagrams via index
    for (const [word, rank] of (this._anagramIndex.get(queryKey) || [])) {
      if (word !== cleaned) results.push({ words: [[word, rank]], rank });
    }

    // Multi-word anagrams: enumerate sub-multisets of remaining letters via anagram index.
    // Using the index directly avoids scanning the full word list.
    // Canonical word order (non-decreasing sorted-key) prevents duplicate combinations.
    const MAX_MULTI = 500;
    let multiCount = 0;
    const current = [];

    const solve = (remainingKey, minSubKey) => {
      if (multiCount >= MAX_MULTI) return;
      if (!remainingKey) {
        const joined = current.map(([w]) => w).join('');
        if (joined !== cleaned) {
          const avgRank = current.reduce((s, [, r]) => s + r, 0) / current.length;
          results.push({ words: [...current], rank: avgRank });
          multiCount++;
        }
        return;
      }
      for (const subKey of this._subMultisets(remainingKey)) {
        if (subKey < minSubKey) continue;
        if (current.length === 0 && subKey === queryKey) continue; // single-word handled above
        const wordList = this._anagramIndex.get(subKey);
        if (!wordList) continue;
        const rest = this._subtractSortedKey(remainingKey, subKey);
        for (const [word, rank] of wordList) {
          current.push([word, rank]);
          solve(rest, subKey);
          current.pop();
          if (multiCount >= MAX_MULTI) return;
        }
      }
    };

    solve(queryKey, '');
    results.sort((a, b) =>
      a.words.length !== b.words.length ? a.words.length - b.words.length : a.rank - b.rank
    );
    const out = [];
    let prevLen = 0;
    for (const r of results) {
      if (r.words.length !== prevLen) {
        if (prevLen > 0) out.push({ _break: true });
        prevLen = r.words.length;
      }
      out.push(r);
    }
    return out;
  }

  // All non-empty sub-multisets of a sorted letter string, returned as sorted strings.
  _subMultisets(sortedStr) {
    const runs = [];
    let i = 0;
    while (i < sortedStr.length) {
      const ch = sortedStr[i];
      let j = i;
      while (j < sortedStr.length && sortedStr[j] === ch) j++;
      runs.push([ch, j - i]);
      i = j;
    }
    const out = [];
    const build = (idx, acc) => {
      if (idx === runs.length) {
        if (acc) out.push(acc);
        return;
      }
      const [ch, count] = runs[idx];
      for (let n = 0; n <= count; n++) build(idx + 1, n === 0 ? acc : acc + ch.repeat(n));
    };
    build(0, '');
    return out;
  }

  // Remove letters of sorted string b from sorted string a (b must be a sub-multiset of a).
  _subtractSortedKey(a, b) {
    let out = '', ai = 0, bi = 0;
    while (ai < a.length) {
      if (bi < b.length && a[ai] === b[bi]) { bi++; ai++; }
      else { out += a[ai++]; }
    }
    return out;
  }

  // Returns grouped hidden-word results.
  // Each group: { parts, w0Words, wLastWords, topPairs }
  //   parts: [tail, ...middleWords, head] — the partition of the query
  //   w0Words/wLastWords: top candidates for the first/last word
  //   topPairs: top-ranked example (w0, wLast) combinations
  hidden(query) {
    const q = query.toLowerCase().replace(/[^a-z]/g, '');
    if (q.length < 2) return [];

    const n = q.length;
    const LIMIT = 10;
    const PAIRS_SHOWN = 4;
    const MAX_GROUPS = 60;
    const groups = [];

    for (let jStart = 1; jStart < n; jStart++) {
      const tail = q.slice(0, jStart);

      const w0Words = this._endsWith(tail)
        .filter(([w]) => w.length > jStart)
        .sort(([, a], [, b]) => a - b)
        .slice(0, LIMIT);

      if (!w0Words.length) continue;

      for (let jEnd = jStart; jEnd < n; jEnd++) {
        const head = q.slice(jEnd);

        const wLastWords = this._startsWith(head)
          .filter(([w]) => w.length > head.length)
          .sort(([, a], [, b]) => a - b)
          .slice(0, LIMIT);

        if (!wLastWords.length) continue;

        // Pre-compute top example pairs (same for all mid-segmentations of this jStart/jEnd)
        const s0 = w0Words.slice(0, 4);
        const sL = wLastWords.slice(0, 4);
        const pairs = [];
        for (const [w0, r0] of s0) {
          for (const [wLast, rLast] of sL) {
            pairs.push({ w0, r0, wLast, rLast, avgRank: (r0 + rLast) / 2 });
          }
        }
        pairs.sort((a, b) => a.avgRank - b.avgRank);
        const topPairs = pairs.slice(0, PAIRS_SHOWN);

        // All segmentations of the middle become alternatives within one group
        const middle = q.slice(jStart, jEnd);
        const midOptions = middle.length === 0
          ? [[]]
          : this._wordBreak(middle).map(opt => opt.map(w => [w, this._wordRank.get(w) ?? 49999]));
        if (midOptions.length && groups.length < MAX_GROUPS) {
          groups.push({ tail, head, midOptions, w0Words, wLastWords, topPairs });
        }
        if (groups.length >= MAX_GROUPS) break;
      }
      if (groups.length >= MAX_GROUPS) break;
    }

    // Sort by best available combination
    groups.sort((a, b) => a.topPairs[0].avgRank - b.topPairs[0].avgRank);
    return groups;
  }

  // Returns {word, rank, match, after}[] for words starting with the pattern.
  // Requires at least one char after the match. Null if pattern invalid.
  prefix(patternStr) {
    const inner = this._patternToInner(patternStr);
    if (inner === null) return null;
    let regex;
    try { regex = new RegExp(`^(${inner})(.+)$`); } catch (_) { return null; }
    const results = [];
    for (let i = 0; i < this._words.length; i++) {
      const w = this._words[i];
      const m = regex.exec(w);
      if (m) results.push({ word: w, rank: i, match: m[1], after: m[2] });
    }
    return results;
  }

  // Returns {word, rank, before, match}[] for words ending with the pattern.
  // Requires at least one char before the match. Null if pattern invalid.
  suffix(patternStr) {
    const inner = this._patternToInner(patternStr);
    if (inner === null) return null;
    let regex;
    try { regex = new RegExp(`^(.+?)(${inner})$`); } catch (_) { return null; }
    const results = [];
    for (let i = 0; i < this._words.length; i++) {
      const w = this._words[i];
      const m = regex.exec(w);
      if (m) results.push({ word: w, rank: i, before: m[1], match: m[2] });
    }
    return results;
  }

  // Finds phrases where the query appears as a hidden word in reverse.
  hiddenReverse(query) {
    const rev = query.toLowerCase().replace(/[^a-z]/g, '').split('').reverse().join('');
    return this.hidden(rev);
  }

  // Returns all ways to segment s into a sequence of complete dictionary words.
  // Returns [] if no segmentation exists. Caps at 20 results per sub-problem.
  _wordBreak(s) {
    const n = s.length;
    const memo = new Map();

    const solve = (start) => {
      if (start === n) return [[]];
      if (memo.has(start)) return memo.get(start);

      const result = [];
      for (let end = start + 1; end <= n; end++) {
        const sub = s.slice(start, end);
        if (this._wordRank.has(sub)) {
          for (const seg of solve(end)) {
            result.push([sub, ...seg]);
            if (result.length >= 20) break;
          }
          if (result.length >= 20) break;
        }
      }
      memo.set(start, result);
      return result;
    };

    return solve(0);
  }


  // Words starting with prefix, returned as [word, rank][].
  _startsWith(prefix) {
    const lo = this._lowerBound(this._sortedWords, prefix);
    const out = [];
    for (let i = lo; i < this._sortedWords.length; i++) {
      if (!this._sortedWords[i][0].startsWith(prefix)) break;
      out.push(this._sortedWords[i]);
    }
    return out;
  }

  // Words ending with suffix, returned as [word, rank][].
  _endsWith(suffix) {
    const rev = suffix.split('').reverse().join('');
    const lo = this._lowerBound(this._sortedReversed, rev);
    const out = [];
    for (let i = lo; i < this._sortedReversed.length; i++) {
      if (!this._sortedReversed[i][0].startsWith(rev)) break;
      out.push([this._sortedReversed[i][1], this._sortedReversed[i][2]]);
    }
    return out;
  }

  _lowerBound(arr, target) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid][0] < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  // Converts a user pattern string to a regex fragment (no anchors).
  // Returns null if the pattern is syntactically invalid.
  _patternToInner(pattern) {
    let result = '';
    const lower = pattern.toLowerCase();
    let i = 0;
    while (i < lower.length) {
      const c = lower[i];
      if (c === '?' || c === '.') {
        result += '[a-z]';
        i++;
      } else if (c === '*') {
        result += '[a-z]*';
        i++;
      } else if (c === '[') {
        const j = lower.indexOf(']', i);
        if (j === -1) return null;
        result += lower.slice(i, j + 1);
        i = j + 1;
      } else if (/[a-z]/.test(c)) {
        result += c;
        i++;
      } else {
        return null;
      }
    }
    return result;
  }
}
