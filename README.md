# HearthDoku

A Hearthstone-themed Sudoku puzzle game where players match cards to criteria on a 3x3 grid.

## How to Play

1. **Start a puzzle** -- Click "Nouveau puzzle" to generate a new grid
2. **Read the criteria** -- Each row and column header shows a Hearthstone attribute (class, mana cost, keyword, set, rarity, etc.)
3. **Place cards** -- Click any empty cell to search for a card that matches both its row AND column criteria
4. **Score points** -- Rarer and more unique picks earn higher scores
5. **Win** -- Fill all 9 cells correctly before running out of guesses (PP)

## Features

- 3x3 puzzle grid with randomized Hearthstone card criteria
- Real-time card search with autocomplete
- Extension/set filtering (Standard, Wild, Classic presets)
- Score tracking with uniqueness bonus
- Timer and guess counter
- Victory screen with confetti animation
- Export puzzle as PNG (empty or with solutions)
- Share results
- Full solution viewer showing all valid cards per cell
- Bilingual support (French / English)

## Tech Stack

- **HTML/CSS/JS** -- Pure vanilla, no frameworks
- **Design** -- Clay Design System (dark mode) with DM Sans + Space Mono typography
- **API** -- Hearthstone card data via external API
- **Export** -- html2canvas for PNG generation

## Project Structure

```
HearthDoku/
├── index.html          # Main game page
├── css/
│   └── style.css       # Clay dark theme styles
├── js/
│   ├── app.js          # App initialization
│   ├── api.js          # Hearthstone API calls
│   ├── puzzle-engine.js # Puzzle generation logic
│   ├── card-search.js  # Card search & filtering
│   ├── ui.js           # UI rendering & interactions
│   ├── export.js       # PNG export & sharing
│   └── i18n.js         # Internationalization (FR/EN)
├── logo/               # Game logo assets
└── DESIGN.md           # Design system reference (Clay)
```

## Design System

Based on the **Clay** design system, adapted to dark mode:

- **Canvas**: Deep warm stone (`#1c1917`) background
- **Surfaces**: Elevated stone cards (`#292524`) with subtle inset shadows
- **Accents**: Lemon gold (`#fbbd41`), Matcha green (`#22c55e`), Slushie cyan (`#3bd3fd`), Ube purple (`#a78bfa`), Pomegranate pink (`#fc7981`)
- **Typography**: DM Sans (headings & body) + Space Mono (stats & code)
- **Borders**: Warm stone oat tones with dashed variants for decoration
- **Interactions**: Subtle lift on hover for buttons, glow borders on grid cells

## Running Locally

Simply open `index.html` in a browser. No build step required.

```bash
# Or use any local server
python3 -m http.server 8000
# Then visit http://localhost:8000
```

## License

All Hearthstone assets and card data are property of Blizzard Entertainment.
