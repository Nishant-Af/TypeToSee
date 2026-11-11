# TypeToSee

> Type a word. Watch the wall of images reshape itself around it.

TypeToSee is a single-page web app with a frosted-glass search box floating over a living mosaic of 12 to 18 images. Search for anything and the whole background fades out and a new set of tiles rolls in, one after another.

Plain HTML, CSS and vanilla JavaScript. No framework, no build step, no dependencies.

## Features

- Live search with a 500 ms debounce (press **Enter** to search instantly)
- 12 to 18 tiles per search, laid out as a responsive bento grid (3 / 4 / 6 columns)
- Staggered fade and scale animations, shimmer placeholders while images load
- Mouse parallax on the background (turned off if your OS asks for reduced motion)
- Click a tile to open it in a lightbox with a photographer credit
- Suggestion chips: Nature, Space, Cars, Anime, Food, City, Cyberpunk
- Keyboard shortcuts: `/` focuses the search box, `Esc` closes dialogs
- Works out of the box with built-in curated collections, no API key needed
- Optional live search through the Unsplash or Pexels API

## Run it

No install needed.

1. Download or clone this repo.
2. Open `index.html` in your browser.

Or serve it locally if you prefer:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Live search with your own API key

Out of the box the app only knows its seven built-in themes. Any other word falls back to random placeholder photos. To search for literally anything:

1. Get a free key from [Unsplash](https://unsplash.com/developers) (Access Key) or [Pexels](https://www.pexels.com/api/).
2. Click **Connect API** in the bottom-left corner.
3. Pick the provider, paste the key, hit **Save & Connect**.

The key is stored only in your own browser (`localStorage`). It is never sent anywhere except to the provider you picked. Since this is a pure front-end app, don't put a secret or paid key in it.

## Project structure

```
typetosee/
├── index.html          # Page markup
├── css/
│   └── styles.css      # All styling (glassmorphism, grid, animations)
├── js/
│   ├── collections.js  # Built-in curated photo collections (data only)
│   └── app.js          # Search, fetching, rendering, events
├── README.md
├── LICENSE
└── .gitignore
```

`collections.js` must load before `app.js`, which `index.html` already does.

## Customising

| What | Where |
| --- | --- |
| Tile count range | `MIN_TILES` / `MAX_TILES` in `js/app.js` |
| Typing delay | `DEBOUNCE_DELAY_MS` in `js/app.js` |
| Animation stagger | `STAGGER_DELAY_MS` in `js/app.js` |
| Default theme | `DEFAULT_THEME` in `js/app.js` |
| Colours, radius | CSS variables at the top of `css/styles.css` |
| Built-in themes | add a key to `CURATED_COLLECTIONS` in `js/collections.js`, then add a chip in `index.html` |

## Credits

Built-in photos are served from [Unsplash](https://unsplash.com) and credited to their photographers in the lightbox. Placeholder images come from [Picsum](https://picsum.photos). Font: [Inter](https://rsms.me/inter/).

## License

[MIT](LICENSE)
