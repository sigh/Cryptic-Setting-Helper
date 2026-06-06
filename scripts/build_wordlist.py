#!/usr/bin/env python3
"""
Generate data/words.txt from the Wikipedia word frequency list.

Usage:
  python scripts/build_wordlist.py                  # downloads source
  python scripts/build_wordlist.py path/to/file.txt # uses local file

Source: https://github.com/IlyaSemenov/wikipedia-word-frequency
"""
import re
import os
import sys
import urllib.request

URL = 'https://raw.githubusercontent.com/IlyaSemenov/wikipedia-word-frequency/master/results/enwiki-2023-04-13.txt'
OUTPUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'words.txt')
MAX_WORDS = 50000
MIN_LENGTH = 3

WORD_RE = re.compile(r'^[a-z]{' + str(MIN_LENGTH) + r',}$')


def process(lines):
    words = []
    for line in lines:
        if isinstance(line, bytes):
            line = line.decode('utf-8', errors='ignore')
        parts = line.split()
        if not parts:
            continue
        word = parts[0]
        if WORD_RE.match(word):
            words.append(word)
            if len(words) >= MAX_WORDS:
                break
    return words


def main():
    source = sys.argv[1] if len(sys.argv) > 1 else None

    if source:
        print(f'Reading {source}...')
        with open(source, encoding='utf-8') as f:
            words = process(f)
    else:
        print(f'Downloading {URL}...')
        with urllib.request.urlopen(URL) as response:
            words = process(response)

    os.makedirs(os.path.dirname(os.path.abspath(OUTPUT)), exist_ok=True)
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        f.write('\n'.join(words))

    print(f'Wrote {len(words)} words to {os.path.normpath(OUTPUT)}')


if __name__ == '__main__':
    main()
