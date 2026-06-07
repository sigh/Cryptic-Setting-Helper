# Cryptic Setting Helper

A word-finding tool for cryptic crossword setters. Search by pattern or anagram, with results ranked by frequency.

Explore it at <https://sigh.github.io/Cryptic-Setting-Helper/>.

## Usage

Enter a pattern or letters in the search box. The mode toggles switch between search types:

- **Match** — pattern search. `?` matches one letter, `*` matches any number of letters, `[abc]` matches one of the given letters. Example: `C??T`, `*TION`, `[aeiou]??`
- **Anagram** — finds all anagrams of the entered letters
- **Alternate** / **Alternate reverse** — finds words whose alternating letters match
- **Hidden word** modes — finds words hidden inside other words

Results are colour-coded by word frequency.

## Running locally

```bash
python3 -m http.server 8000
```

## License

[MIT](LICENSE)
