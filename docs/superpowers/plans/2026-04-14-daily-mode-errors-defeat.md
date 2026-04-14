# Daily Mode + 3 Errors + Defeat Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le système PP (9 vies) par 3 erreurs max, ajouter un mode quotidien seedé par la date affiché par défaut, et afficher une popup "Défaite" à la 3e erreur.

**Architecture:** (1) Le puzzle-engine reçoit un seed optionnel pour produire un puzzle déterministe via mulberry32. (2) App.js charge un puzzle quotidien (seed = YYYYMMDD) à l'init au lieu d'un puzzle aléatoire. (3) Le système PP (9 vies) est entièrement remplacé par un compteur d'erreurs (max 3) dans ui.js. (4) Un nouveau modal "Défaite" s'affiche à la 3e erreur avec les boutons "Voir solution" et "Nouveau puzzle".

**Tech Stack:** Vanilla HTML/CSS/JS, aucun build step, aucun test runner (vérification manuelle dans le navigateur).

---

## Fichiers modifiés

| Fichier | Rôle |
|---------|------|
| `js/puzzle-engine.js` | +`mulberry32(seed)` +`shuffleWithRng(arr, rng)`, modifier `generatePuzzle` et `tryGeneratePuzzle` pour accepter un seed |
| `js/i18n.js` | Remplacer les clés PP par erreurs, ajouter clés defeat/daily |
| `index.html` | Changer stat PP→Erreurs, ajouter bouton "Puzzle du jour", modale défaite, barre de mode |
| `css/style.css` | Styles defeat-modal, btn--daily, puzzle-mode-bar |
| `js/ui.js` | Remplacer `pp=9` par `errors=0/MAX_ERRORS=3`, ajouter `showDefeatModal/closeDefeatModal`, `setModeBar` |
| `js/app.js` | Ajouter `generateDailyPuzzle()`, câbler boutons defeat modal + daily button |

---

## Task 1 — Seeded RNG dans puzzle-engine.js

**Files:** Modify `js/puzzle-engine.js`

- [ ] **Étape 1 : Ajouter mulberry32 et shuffleWithRng après la fonction `shuffle`**

```js
// Après function shuffle(arr) { ... }

function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), s | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
    };
}

function shuffleWithRng(arr, rng) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
```

- [ ] **Étape 2 : Modifier la signature de `generatePuzzle` pour accepter un seed**

Remplacer `function generatePuzzle(cards, allowedSets = null)` par :

```js
function generatePuzzle(cards, allowedSets = null, seed = null) {
    // ...même code existant pour setup pool/viableValues...
    
    const rng = seed != null ? mulberry32(seed) : null;
    
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const result = tryGeneratePuzzle(pool, viableCategories, viableValues, minCards, rng);
        if (result) return result;
    }
    return null;
}
```

- [ ] **Étape 3 : Modifier `tryGeneratePuzzle` pour utiliser le RNG seedé quand fourni**

Remplacer `function tryGeneratePuzzle(pool, availableCategories, viableValues, minCards)` par :

```js
function tryGeneratePuzzle(pool, availableCategories, viableValues, minCards, rng = null) {
    const sf = rng ? (a) => shuffleWithRng(a, rng) : shuffle;
    const cats = availableCategories || CATEGORIES.filter(c => CATEGORY_VALUES[c].length > 0);
    const vals = viableValues || CATEGORY_VALUES;
    const threshold = minCards || 10;

    const shuffledCats = sf(cats);   // ← était shuffle(cats)
    if (shuffledCats.length < 6) return null;

    const rowCategories = shuffledCats.slice(0, 3);
    const colCategories = shuffledCats.slice(3, 6);

    const rowCriteria = [];
    const colCriteria = [];

    for (const cat of rowCategories) {
        const catVals = sf(vals[cat] || CATEGORY_VALUES[cat]);  // ← était shuffle(...)
        if (catVals.length === 0) return null;
        rowCriteria.push({ category: cat, value: catVals[0] });
    }

    for (const cat of colCategories) {
        const catVals = sf(vals[cat] || CATEGORY_VALUES[cat]);  // ← était shuffle(...)
        if (catVals.length === 0) return null;
        colCriteria.push({ category: cat, value: catVals[0] });
    }
    // ...reste inchangé (cellCards, hasSolution, etc.)
```

---

## Task 2 — Traductions i18n

**Files:** Modify `js/i18n.js`

- [ ] **Étape 1 : Ajouter les clés FR (dans l'objet `fr:`)**

Ajouter après `ppRemaining: 'PP restants',` :

```js
errorsLabel: 'Erreurs',
defeat: 'Défaite !',
defeatMessage: '3 erreurs — la grille est dévoilée.',
dailyPuzzle: 'Puzzle du jour',
dailyMode: '📅 Puzzle du jour',
freeMode: '🎲 Mode libre',
```

- [ ] **Étape 2 : Ajouter les clés EN (dans l'objet `en:`)**

Ajouter après `ppRemaining: 'PP remaining',` :

```js
errorsLabel: 'Errors',
defeat: 'Defeat!',
defeatMessage: '3 errors — the grid is revealed.',
dailyPuzzle: 'Daily Puzzle',
dailyMode: '📅 Daily Puzzle',
freeMode: '🎲 Free Mode',
```

---

## Task 3 — HTML : stat PP, bouton daily, barre de mode, modale défaite

**Files:** Modify `index.html`

- [ ] **Étape 1 : Changer le stat PP → Erreurs**

Remplacer le bloc stat PP :
```html
<div class="stat-item">
    <span class="stat-label">PP</span>
    <span class="stat-value" id="statPP">9/9</span>
</div>
```
Par :
```html
<div class="stat-item">
    <span class="stat-label" id="statErrorsLabel">ERREURS</span>
    <span class="stat-value" id="statPP">0/3</span>
</div>
```

- [ ] **Étape 2 : Ajouter le bouton "Puzzle du jour" avant "Nouveau puzzle"**

Remplacer `<div class="action-buttons">` contenu par :
```html
<div class="action-buttons">
    <button class="btn btn--daily" id="btnDailyPuzzle">📅 Puzzle du jour</button>
    <button class="btn btn--primary" id="btnNewPuzzle">Nouveau puzzle</button>
    <button class="btn btn--secondary" id="btnShowSolution">Voir la solution</button>
    <button class="btn btn--secondary" id="btnExport">Exporter en PNG</button>
    <button class="btn btn--secondary" id="btnShare">Partager</button>
</div>
```

- [ ] **Étape 3 : Ajouter la barre de mode AVANT `<div class="stats-panel">`**

```html
<!-- Mode bar -->
<div class="puzzle-mode-bar" id="puzzleModeBar"></div>
```

- [ ] **Étape 4 : Ajouter la modale défaite après `<!-- Victory Modal -->`**

```html
<!-- Defeat Modal -->
<div class="modal-overlay" id="defeatModal">
    <div class="modal-content defeat-modal">
        <h2 class="defeat-title" id="defeatTitle">Défaite !</h2>
        <p class="defeat-message" id="defeatMessage">3 erreurs — la grille est dévoilée.</p>
        <div class="defeat-stats">
            <div class="victory-stat">
                <span class="victory-stat__label" id="defeatScoreLabel">Score</span>
                <span class="victory-stat__value" id="defeatScore">0</span>
            </div>
            <div class="victory-stat">
                <span class="victory-stat__label" id="defeatTimeLabel">Temps</span>
                <span class="victory-stat__value" id="defeatTime">0:00</span>
            </div>
        </div>
        <div class="defeat-actions">
            <button class="btn btn--secondary" id="defeatShowSolution">Voir la solution</button>
            <button class="btn btn--primary" id="defeatNewPuzzle">Nouveau puzzle</button>
        </div>
    </div>
</div>
```

---

## Task 4 — CSS : defeat modal + btn--daily + puzzle-mode-bar

**Files:** Modify `css/style.css`

- [ ] **Étape 1 : Ajouter styles defeat modal après `.victory-actions { ... }`**

```css
/* ---------- Defeat Modal ---------- */
.defeat-modal {
    text-align: center;
    border: 1px solid rgba(252, 121, 129, 0.3);
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4), 0 0 40px rgba(252, 121, 129, 0.08);
}

.defeat-title {
    font-family: var(--font-heading);
    font-size: 2rem;
    font-weight: 600;
    color: var(--pomegranate-400);
    margin-bottom: 0.5rem;
    letter-spacing: -0.64px;
}

.defeat-message {
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
}

.defeat-stats {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
}

.defeat-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    flex-wrap: wrap;
}
```

- [ ] **Étape 2 : Ajouter btn--daily après `.btn--preset { ... }` block**

```css
.btn--daily {
    background: rgba(251, 189, 65, 0.12);
    color: var(--lemon-500);
    border: 1px solid rgba(251, 189, 65, 0.3);
    box-shadow: var(--shadow-clay);
}

.btn--daily:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-hard);
    background: rgba(251, 189, 65, 0.2);
    border-color: var(--lemon-500);
}
```

- [ ] **Étape 3 : Ajouter puzzle-mode-bar après `.stats-panel { ... }` block**

```css
/* ---------- Puzzle Mode Bar ---------- */
.puzzle-mode-bar {
    display: flex;
    justify-content: center;
    margin-bottom: 0.75rem;
    min-height: 28px;
}

.puzzle-mode-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.75rem;
    border-radius: 20px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    box-shadow: var(--shadow-clay);
}

.puzzle-mode-badge--daily {
    background: rgba(251, 189, 65, 0.1);
    border: 1px solid rgba(251, 189, 65, 0.25);
    color: var(--lemon-500);
}

.puzzle-mode-badge--free {
    background: rgba(59, 211, 253, 0.08);
    border: 1px solid rgba(59, 211, 253, 0.2);
    color: var(--slushie-500);
}
```

---

## Task 5 — ui.js : PP → errors, defeat modal, mode bar

**Files:** Modify `js/ui.js`

- [ ] **Étape 1 : Remplacer `pp = 9` par `errors = 0` + constante MAX_ERRORS**

Remplacer dans la section state :
```js
let pp = 9;
```
Par :
```js
const MAX_ERRORS = 3;
let errors = 0;
```

- [ ] **Étape 2 : Mettre à jour `cacheElements` pour ajouter defeatModal**

Ajouter après `els.victoryModal = document.getElementById('victoryModal');` :
```js
els.defeatModal = document.getElementById('defeatModal');
els.puzzleModeBar = document.getElementById('puzzleModeBar');
```

- [ ] **Étape 3 : Mettre à jour `resetGame`**

Remplacer `pp = 9;` par `errors = 0;`

- [ ] **Étape 4 : Mettre à jour `selectCard` — chemin wrong**

Remplacer :
```js
pp--;
```
Par :
```js
errors++;
```

Remplacer :
```js
if (pp <= 0) {
    endGame(false);
}
```
Par :
```js
if (errors >= MAX_ERRORS) {
    endGame(false);
}
```

- [ ] **Étape 5 : Mettre à jour `updateStats`**

Remplacer :
```js
els.statPP.textContent = `${pp}/9`;
els.statPP.classList.toggle('stat-value--danger', pp <= 3);
```
Par :
```js
els.statPP.textContent = `${errors}/${MAX_ERRORS}`;
els.statPP.classList.toggle('stat-value--danger', errors >= MAX_ERRORS - 1);
```

- [ ] **Étape 6 : Mettre à jour `showVictoryModal`**

Remplacer :
```js
document.getElementById('victoryPP').textContent = `${pp}/9`;
```
Par :
```js
document.getElementById('victoryPP').textContent = `${errors}/${MAX_ERRORS}`;
```

- [ ] **Étape 7 : Ajouter `showDefeatModal` et `closeDefeatModal`**

Ajouter après `closeVictoryModal`:
```js
function showDefeatModal() {
    document.getElementById('defeatScore').textContent = score;
    document.getElementById('defeatTime').textContent = formatTime(timerSeconds);
    els.defeatModal.classList.add('modal-overlay--visible');
}

function closeDefeatModal() {
    els.defeatModal.classList.remove('modal-overlay--visible');
}
```

- [ ] **Étape 8 : Mettre à jour `endGame` pour afficher la defeat modal**

Remplacer :
```js
function endGame(victory) {
    gameFinished = true;
    clearInterval(timerInterval);

    if (victory) {
        showVictoryModal();
    }
}
```
Par :
```js
function endGame(victory) {
    gameFinished = true;
    clearInterval(timerInterval);

    if (victory) {
        showVictoryModal();
    } else {
        showDefeatModal();
    }
}
```

- [ ] **Étape 9 : Ajouter `setModeBar` pour afficher le badge de mode**

Ajouter après `closeDefeatModal`:
```js
function setModeBar(isDaily, dateLabel) {
    if (!els.puzzleModeBar) return;
    const text = isDaily
        ? `${I18n.t('dailyMode')} — ${dateLabel}`
        : I18n.t('freeMode');
    const cls = isDaily ? 'puzzle-mode-badge--daily' : 'puzzle-mode-badge--free';
    els.puzzleModeBar.innerHTML = `<span class="puzzle-mode-badge ${cls}">${text}</span>`;
}
```

- [ ] **Étape 10 : Mettre à jour `getShareText` — supprimer référence PP**

Remplacer :
```js
return `🎴 HearthDoku — ${dateStr}\n${grid.join('\n')}\nScore: ${score} | PP: ${pp}/9 | ⏱️ ${formatTime(timerSeconds)}`;
```
Par :
```js
return `🎴 HearthDoku — ${dateStr}\n${grid.join('\n')}\nScore: ${score} | Erreurs: ${errors}/${MAX_ERRORS} | ⏱️ ${formatTime(timerSeconds)}`;
```

- [ ] **Étape 11 : Mettre à jour `updateUIText` — label erreurs + defeat modal**

Dans `updateUIText`, remplacer `victoryLabels[2].textContent = I18n.t('ppRemaining');` par :
```js
victoryLabels[2].textContent = I18n.t('errorsLabel');
```

Ajouter après cette ligne :
```js
// Stat label errors
const statErrorsLabel = document.getElementById('statErrorsLabel');
if (statErrorsLabel) statErrorsLabel.textContent = I18n.t('errorsLabel').toUpperCase();

// Defeat modal
const defeatTitle = document.getElementById('defeatTitle');
if (defeatTitle) defeatTitle.textContent = I18n.t('defeat');
const defeatMsg = document.getElementById('defeatMessage');
if (defeatMsg) defeatMsg.textContent = I18n.t('defeatMessage');
const defeatScoreLabel = document.getElementById('defeatScoreLabel');
if (defeatScoreLabel) defeatScoreLabel.textContent = I18n.t('score');
const defeatTimeLabel = document.getElementById('defeatTimeLabel');
if (defeatTimeLabel) defeatTimeLabel.textContent = I18n.t('time');
const defeatShowSol = document.getElementById('defeatShowSolution');
if (defeatShowSol) defeatShowSol.textContent = I18n.t('showSolution');
const defeatNewP = document.getElementById('defeatNewPuzzle');
if (defeatNewP) defeatNewP.textContent = I18n.t('newPuzzle');

// Daily puzzle button
const btnDailyPuzzle = document.getElementById('btnDailyPuzzle');
if (btnDailyPuzzle) btnDailyPuzzle.textContent = I18n.t('dailyPuzzle');
```

- [ ] **Étape 12 : Mettre à jour `return` pour exposer les nouvelles fonctions**

Ajouter dans le `return { ... }` :
```js
showDefeatModal,
closeDefeatModal,
setModeBar,
get errors() { return errors; },
```

Remplacer `get pp() { return pp; }` par (ou retirer si plus utilisé) — vérifier l'usage dans app.js.

---

## Task 6 — app.js : daily mode + câblage defeat modal

**Files:** Modify `js/app.js`

- [ ] **Étape 1 : Ajouter l'état `isDailyMode` et les helpers date**

Ajouter en haut de l'IIFE (après `let allClasses = []`) :
```js
let isDailyMode = false;

function getDailySeed() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return parseInt(`${y}${m}${d}`, 10);
}

function getDailyDateLabel() {
    return new Date().toLocaleDateString(I18n.t('shareDate'), {
        day: 'numeric', month: 'long', year: 'numeric'
    });
}
```

- [ ] **Étape 2 : Ajouter `generateDailyPuzzle`**

```js
function generateDailyPuzzle() {
    isDailyMode = true;
    UI.showLoading();
    setTimeout(() => {
        const seed = getDailySeed();
        const puzzle = PuzzleEngine.generatePuzzle(allCards, null, seed);
        if (!puzzle) {
            UI.hideLoading();
            alert(I18n.t('errorGenerate'));
            return;
        }
        UI.renderPuzzle(puzzle);
        UI.setModeBar(true, getDailyDateLabel());
        UI.hideLoading();
    }, 50);
}
```

- [ ] **Étape 3 : Modifier `generateNewPuzzle` pour passer en mode libre**

Ajouter au début de `generateNewPuzzle()` :
```js
isDailyMode = false;
```
Ajouter après `UI.renderPuzzle(puzzle);` :
```js
UI.setModeBar(false, null);
```

- [ ] **Étape 4 : Remplacer l'appel initial `generateNewPuzzle()` par `generateDailyPuzzle()`**

Dans `init()`, remplacer l'appel final `generateNewPuzzle();` par `generateDailyPuzzle();`.

- [ ] **Étape 5 : Câbler le bouton `btnDailyPuzzle`**

Ajouter après `document.getElementById('btnNewPuzzle').addEventListener('click', generateNewPuzzle);` :
```js
document.getElementById('btnDailyPuzzle').addEventListener('click', generateDailyPuzzle);
```

- [ ] **Étape 6 : Câbler les boutons defeat modal**

Ajouter après le bloc des boutons victory modal :
```js
// Defeat modal buttons
document.getElementById('defeatNewPuzzle').addEventListener('click', () => {
    UI.closeDefeatModal();
    generateNewPuzzle();
});
document.getElementById('defeatShowSolution').addEventListener('click', () => {
    UI.closeDefeatModal();
    UI.showSolution();
});
```

- [ ] **Étape 7 : Ajouter fermeture defeat modal sur Escape**

Dans le listener `keydown` existant :
```js
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeSearchModal();
        closeExportModal();
        closeSolutionModal();
        // ← ajouter :
        UI.closeDefeatModal();
    }
});
```

---

## Vérification manuelle

- [ ] `python3 -m http.server 8000` puis ouvrir `http://localhost:8000`
- [ ] Au chargement : badge "📅 Puzzle du jour — 14 avril 2026" visible au-dessus du puzzle
- [ ] Stat "ERREURS 0/3" visible dans la barre de stats
- [ ] Faire 3 mauvaises réponses → popup rouge "Défaite !" s'affiche
- [ ] "Voir la solution" dans la defeat modal → révèle la grille + ferme le modal
- [ ] "Nouveau puzzle" dans la defeat modal → génère un puzzle aléatoire, badge passe en mode libre
- [ ] Cliquer "Nouveau puzzle" dans le panneau → badge "🎲 Mode libre"
- [ ] Cliquer "Puzzle du jour" dans le panneau → revient sur le même puzzle du jour
- [ ] Même seed le lendemain → puzzle différent
- [ ] Victoire → modal victoire avec stat "Erreurs" au lieu de "PP"
- [ ] Changer langue → toutes les nouvelles clés traduites (defeat, daily, errors)
