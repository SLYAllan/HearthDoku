const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const read = file => fs.readFileSync(file, 'utf8');

test('the current Hearthstone set is available everywhere', () => {
    const api = read('js/api.js');
    const i18n = read('js/i18n.js');

    assert.match(api, /STANDARD_SETS[\s\S]*'JAIL'/);
    assert.match(api, /'JAIL':\s*'logo\/extensions\/Escape_from_Violet_Hold\.png'/);
    assert.match(i18n, /'JAIL':\s*'Évasion du fort Pourpre'/);
    assert.match(i18n, /'JAIL':\s*'Escape from Violet Hold'/);
    assert.ok(fs.existsSync('logo/extensions/Escape_from_Violet_Hold.png'));
});

test('game choices use native buttons', () => {
    const index = read('index.html');
    const ui = read('js/ui.js');

    assert.match(index, /<button type="button" class="grid-cell"/);
    assert.equal((index.match(/<button[^>]*class="grid-cell"[^>]*aria-label=/g) || []).length, 9);
    assert.match(ui, /<button type="button" class="search-result/);
    assert.match(ui, /duplicateNames\.has\(card\.name\)/);
    assert.doesNotMatch(ui, /if \(dailyOpts\) \{\s*showSolutionPopup\(\);/);
});

test('mobile grid fits its container', () => {
    const css = read('css/style.css');

    assert.match(css, /grid-template-columns:\s*72px repeat\(3, minmax\(0, 1fr\)\)/);
    assert.match(css, /grid-template-columns:\s*120px repeat\(3, minmax\(0, 1fr\)\)/);
    assert.match(css, /\.btn-twitter,[\s\S]*?\.btn-coffee[\s\S]*?min-block-size:\s*44px/);
    assert.match(css, /\.puzzle-grid\s*\{[\s\S]*?width:\s*100%/);
});

test('multiplayer icon controls have names', () => {
    const room = read('room.html');

    assert.match(room, /id="roomBtnCheckAll"[^>]*aria-label=/);
    assert.match(room, /id="roomBtnUncheckAll"[^>]*aria-label=/);
    assert.match(room, /<label for="joinCode"/);
    assert.match(room, /id="setupStatus"[^>]*role="status"/);
});

test('dialogs manage focus and background state', () => {
    for (const file of ['js/ui.js', 'js/room-ui.js']) {
        const source = read(file);
        assert.match(source, /function openModal\(/);
        assert.match(source, /\.inert = true/);
        assert.match(source, /function closeModal\(/);
    }
});
