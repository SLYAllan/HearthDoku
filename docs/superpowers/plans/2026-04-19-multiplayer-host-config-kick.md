# Multiplayer: Host Migration, Puzzle Config & Kick/Ban — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add host migration on disconnect, collapsible puzzle filter panel in room setup, and host-only kick/ban (by IP, per-room) to HearthDoku multiplayer.

**Architecture:** Server-authoritative — all game logic lives in `server/room-manager.js`. The client sends simple WS messages and renders what the server tells it. No test runner — manual browser verification.

**Tech Stack:** Vanilla JS (client), Node.js + ws@^8.18.0 (server), no build step.

---

## Files Modified

| File | Role |
|------|------|
| `js/i18n.js` | New translation keys for all 3 features |
| `server/room-manager.js` | Host migration in `handleDisconnect()`, `kickPlayer()`, `bannedIPs` per room, IP check in `joinRoom()` |
| `server/index.js` | New `kick` case in message switch |
| `js/room-client.js` | New WS cases (`host_changed`, `kicked`, `player_kicked`), new `kickPlayer()` method |
| `js/room-ui.js` | `onHostChanged()`, `onKicked()`, `onPlayerKicked()`, kick button in player list, config summary in sidebar |
| `room.html` | Collapsible filter panel in setup |
| `css/style.css` | Filter panel styles, kick button styles |
| `js/room-app.js` | Filter toggle/wiring, config collection on create, kicked redirect |

---

## Task 1 — i18n: Add all new translation keys

**Files:** Modify `js/i18n.js`

- [ ] **Step 1: Add FR keys after `multiplayer: 'Multijoueur',` (line 89)**

In `js/i18n.js`, inside the `fr:` object, add after `multiplayer: 'Multijoueur',`:

```js
            hostChanged: '{name} est le nouvel hôte',
            kick: 'Expulser',
            kicked: 'Vous avez été expulsé de la room',
            playerKicked: '{name} a été expulsé',
            bannedFromRoom: 'Vous êtes banni de cette room',
            advancedFilters: 'Filtres avancés',
            filterExtensions: 'Extensions',
            filterRarities: 'Raretés',
            filterClasses: 'Classes',
            filterAll: 'Tout',
            filterNone: 'Rien',
```

- [ ] **Step 2: Add EN keys after `multiplayer: 'Multiplayer',` (line 342)**

In `js/i18n.js`, inside the `en:` object, add after `multiplayer: 'Multiplayer',`:

```js
            hostChanged: '{name} is the new host',
            kick: 'Kick',
            kicked: 'You have been kicked from the room',
            playerKicked: '{name} was kicked',
            bannedFromRoom: 'You are banned from this room',
            advancedFilters: 'Advanced filters',
            filterExtensions: 'Sets',
            filterRarities: 'Rarities',
            filterClasses: 'Classes',
            filterAll: 'All',
            filterNone: 'None',
```

- [ ] **Step 3: Commit**

```bash
git add js/i18n.js
git commit -m "feat(i18n): add keys for host migration, puzzle config & kick/ban"
```

---

## Task 2 — Server: Host migration in handleDisconnect

**Files:** Modify `server/room-manager.js`

- [ ] **Step 1: Add host migration logic in `handleDisconnect()`**

In `server/room-manager.js`, replace the `handleDisconnect` method (lines 347–367) with:

```js
    handleDisconnect(ws) {
        const info = this.playerToRoom.get(ws);
        if (!info) return;

        const room = this.rooms.get(info.code);
        if (room) {
            const wasHost = info.playerId === room.hostId;
            room.players.delete(info.playerId);
            this.rateLimiter.remove(info.playerId);

            if (room.players.size === 0) {
                this.rooms.delete(info.code);
            } else {
                if (wasHost) {
                    const newHost = room.players.values().next().value;
                    room.hostId = newHost.id;
                    this.broadcast(room, {
                        type: 'host_changed',
                        hostId: newHost.id,
                        name: newHost.name,
                    });
                }
                this.broadcast(room, { type: 'player_left', playerId: info.playerId });
                if (room.mode === 'versus' && room.startedAt) {
                    this.checkVersusEnd(room);
                }
            }
        }

        this.playerToRoom.delete(ws);
    }
```

- [ ] **Step 2: Test manually — start server, create room with 2 browser tabs, disconnect host tab, verify second tab gets host badge**

```bash
cd server && npm run dev
```

Open two browser tabs to `http://localhost:8000/room.html`. Create room in tab 1, join in tab 2. Close tab 1. Verify tab 2 shows "host" badge and start button (versus mode).

- [ ] **Step 3: Commit**

```bash
git add server/room-manager.js
git commit -m "feat(server): auto-migrate host when host disconnects"
```

---

## Task 3 — Server: Kick/ban with IP-scoped ban

**Files:** Modify `server/room-manager.js`, `server/index.js`

- [ ] **Step 1: Add `bannedIPs` to room object in `createRoom()`**

In `server/room-manager.js`, in the `createRoom` method, add `bannedIPs: new Set(),` to the room object. Insert after `finished: false,` (line 84):

```js
            bannedIPs: new Set(),
```

- [ ] **Step 2: Add IP ban check in `joinRoom()`**

In `server/room-manager.js`, in the `joinRoom` method, add after the `room.players.size >= MAX_PLAYERS` check (after line 119):

```js
        const ip = ws._socket.remoteAddress;
        if (room.bannedIPs.has(ip)) {
            this.sendTo(ws, { type: 'error', message: 'Banned from this room' });
            return;
        }
```

- [ ] **Step 3: Add `kickPlayer()` method**

In `server/room-manager.js`, add this method after `startGame()` (after line 165):

```js
    kickPlayer(ws, { playerId }) {
        const info = this.playerToRoom.get(ws);
        if (!info) return;

        const room = this.rooms.get(info.code);
        if (!room) return;

        if (info.playerId !== room.hostId) {
            this.sendTo(ws, { type: 'error', message: 'Only host can kick' });
            return;
        }
        if (playerId === room.hostId) {
            this.sendTo(ws, { type: 'error', message: 'Cannot kick yourself' });
            return;
        }

        const target = room.players.get(playerId);
        if (!target) {
            this.sendTo(ws, { type: 'error', message: 'Player not found' });
            return;
        }

        const targetIp = target.ws._socket.remoteAddress;
        room.bannedIPs.add(targetIp);

        this.sendTo(target.ws, { type: 'kicked' });

        room.players.delete(playerId);
        this.playerToRoom.delete(target.ws);
        this.rateLimiter.remove(playerId);

        target.ws.close();

        this.broadcast(room, {
            type: 'player_kicked',
            playerId,
            name: target.name,
        });

        if (room.mode === 'versus' && room.startedAt) {
            this.checkVersusEnd(room);
        }
    }
```

- [ ] **Step 4: Add `kick` case in `server/index.js`**

In `server/index.js`, add after the `place` case (after line 69):

```js
            case 'kick':
                roomManager.kickPlayer(ws, { playerId: msg.playerId });
                break;
```

- [ ] **Step 5: Commit**

```bash
git add server/room-manager.js server/index.js
git commit -m "feat(server): add kick/ban with per-room IP ban"
```

---

## Task 4 — Client WS: Handle new message types

**Files:** Modify `js/room-client.js`

- [ ] **Step 1: Add `host_changed`, `kicked`, `player_kicked` cases in `handleMessage()`**

In `js/room-client.js`, add these cases inside the `switch (msg.type)` block, after the `player_left` case (after line 105):

```js
            case 'host_changed':
                if (roomState) roomState.hostId = msg.hostId;
                emit('host_changed', msg);
                break;

            case 'kicked':
                emit('kicked', msg);
                break;

            case 'player_kicked':
                emit('player_kicked', msg);
                break;
```

- [ ] **Step 2: Add `kickPlayer()` method**

In `js/room-client.js`, add after `placeCard` function (after line 168):

```js
    function kickPlayer(playerId) {
        send({ type: 'kick', playerId });
    }
```

- [ ] **Step 3: Export `kickPlayer` in the return statement**

In `js/room-client.js`, update the return object (line 196) to include `kickPlayer`:

```js
    return {
        on, connect, createRoom, joinRoom, startGame, placeCard, kickPlayer,
        getPlayerId, getRoomCode, getRoomState, getStoredName, setStoredName, disconnect,
    };
```

- [ ] **Step 4: Commit**

```bash
git add js/room-client.js
git commit -m "feat(client): handle host_changed, kicked, player_kicked WS messages"
```

---

## Task 5 — Room UI: Host migration + Kick button + Config summary

**Files:** Modify `js/room-ui.js`

- [ ] **Step 1: Add `roomConfig` state variable**

In `js/room-ui.js`, add after `let errors = 0;` (line 19):

```js
    let roomConfig = null;
```

- [ ] **Step 2: Store config in `onRoomState()`**

In `js/room-ui.js`, in the `onRoomState` function, add after `puzzle = state.puzzle;` (line 116):

```js
        roomConfig = state.config;
```

- [ ] **Step 3: Add `onHostChanged` handler**

In `js/room-ui.js`, add after the `onPlayerLeft` function (after line 152):

```js
    function onHostChanged(msg) {
        hostId = msg.hostId;
        renderPlayerList();
        renderSidebar();
        const text = I18n.t('hostChanged').replace('{name}', msg.name);
        setStatus(text);
    }
```

- [ ] **Step 4: Add `onKicked` handler**

In `js/room-ui.js`, add after the `onHostChanged` function:

```js
    function onKicked() {
        gameFinished = true;
        clearInterval(timerInterval);
        sessionStorage.setItem('hearthdoku_kicked', '1');
        window.location.replace('/room.html');
    }
```

- [ ] **Step 5: Add `onPlayerKicked` handler**

In `js/room-ui.js`, add after the `onKicked` function:

```js
    function onPlayerKicked(msg) {
        players.delete(msg.playerId);
        renderPlayerList();
        const text = I18n.t('playerKicked').replace('{name}', msg.name);
        setStatus(text);
    }
```

- [ ] **Step 6: Bind the new WS events in `bindWsEvents()`**

In `js/room-ui.js`, add at the end of `bindWsEvents()` (after line 104):

```js
        RoomClient.on('host_changed', onHostChanged);
        RoomClient.on('kicked', onKicked);
        RoomClient.on('player_kicked', onPlayerKicked);
```

- [ ] **Step 7: Add kick button to `renderPlayerList()`**

In `js/room-ui.js`, replace the player item HTML generation inside `renderPlayerList()`. Replace the block that builds `html` (lines 288–319) with:

```js
        let html = '';
        for (const [id, p] of players) {
            const isMe = id === myId;
            const isHost = id === hostId;
            const nameTag = isMe ? `${p.name} (${I18n.t('you')})` : p.name;
            const hostBadge = isHost ? `<span class="player-badge player-badge--host">${I18n.t('host')}</span>` : '';
            const canKick = myId === hostId && !isMe && !isHost;
            const kickBtn = canKick
                ? `<button class="player-kick" data-kick-id="${id}" title="${I18n.t('kick')}">&#10005;</button>`
                : '';

            let statusHtml = '';
            if (mode === 'versus') {
                if (p.eliminated) {
                    statusHtml = `<span class="player-status player-status--eliminated">${I18n.t('eliminated')}</span>`;
                } else if (p.finishedAt) {
                    statusHtml = `<span class="player-status player-status--finished">${formatTime(p.finishedAt)} &mdash; ${p.score}pts</span>`;
                } else {
                    const filled = p.filled || 0;
                    const pct = Math.round((filled / 9) * 100);
                    statusHtml = `<div class="player-progress">
                        <div class="player-progress__bar" style="width:${pct}%"></div>
                        <span class="player-progress__text">${filled}/9</span>
                    </div>`;
                }
            } else {
                statusHtml = `<span class="player-score">${p.score}pts</span>`;
            }

            html += `<div class="player-item">
                <span class="player-color" style="background:${p.color}"></span>
                <div class="player-info">
                    <span class="player-name">${nameTag}${hostBadge}</span>
                    ${statusHtml}
                </div>
                ${kickBtn}
            </div>`;
        }
        list.innerHTML = html;

        list.querySelectorAll('.player-kick').forEach(btn => {
            btn.addEventListener('click', () => {
                RoomClient.kickPlayer(btn.dataset.kickId);
            });
        });
```

- [ ] **Step 8: Add config summary in `renderSidebar()`**

In `js/room-ui.js`, add after `els.sidebarMode.className = ...;` (after line 267) and before the start button logic:

```js
        if (roomConfig && els.sidebarConfig) {
            const parts = [];
            if (roomConfig.sets && roomConfig.sets.length > 0) {
                const stdSets = HearthstoneAPI.STANDARD_SETS || [];
                const isStd = stdSets.length > 0 && roomConfig.sets.length === stdSets.length &&
                    stdSets.every(s => roomConfig.sets.includes(s));
                if (isStd) {
                    parts.push('Standard');
                } else {
                    parts.push(`${roomConfig.sets.length} sets`);
                }
            }
            if (roomConfig.rarities && roomConfig.rarities.length > 0 && roomConfig.rarities.length < 5) {
                parts.push(roomConfig.rarities.map(r => I18n.getMap('RARITY_MAP')[r] || r).join(', '));
            }
            if (roomConfig.classes && roomConfig.classes.length > 0 && roomConfig.classes.length < 12) {
                parts.push(`${roomConfig.classes.length} ${I18n.t('filterClasses').toLowerCase()}`);
            }
            els.sidebarConfig.textContent = parts.length > 0 ? parts.join(' · ') : '';
            els.sidebarConfig.style.display = parts.length > 0 ? 'block' : 'none';
        }
```

- [ ] **Step 9: Commit**

```bash
git add js/room-ui.js
git commit -m "feat(room-ui): host migration handler, kick button, config summary"
```

---

## Task 6 — HTML: Collapsible filter panel + config summary element

**Files:** Modify `room.html`

- [ ] **Step 1: Add filter panel section in room setup**

In `room.html`, add after the `</div>` that closes `.room-setup__modes` parent `<div class="room-setup__section">` (after line 82) and before the create button (line 84):

```html
                <div class="room-setup__section">
                    <button type="button" class="room-setup__toggle" id="toggleFilters">
                        <span class="room-setup__toggle-arrow">&#9656;</span>
                        <span id="labelAdvancedFilters">Filtres avancés</span>
                    </button>
                    <div class="room-setup__filters" id="filtersPanel" style="display:none">
                        <div class="room-filters__presets">
                            <button type="button" class="btn btn--preset btn--small" data-room-preset="standard">Standard</button>
                            <button type="button" class="btn btn--preset btn--small" data-room-preset="wild">Wild</button>
                            <button type="button" class="btn btn--preset btn--small" data-room-preset="classic">Classic</button>
                        </div>
                        <div class="room-filters__group">
                            <div class="room-filters__group-header">
                                <h4 id="labelFilterExtensions">Extensions</h4>
                                <span class="room-filters__actions">
                                    <button type="button" class="room-filters__action" id="roomBtnCheckAll">&#10003;</button>
                                    <button type="button" class="room-filters__action" id="roomBtnUncheckAll">&#10007;</button>
                                </span>
                            </div>
                            <div class="room-filters__list" id="roomSetFilters"></div>
                        </div>
                        <div class="room-filters__group">
                            <div class="room-filters__group-header">
                                <h4 id="labelFilterRarities">Raretés</h4>
                                <span class="room-filters__actions">
                                    <button type="button" class="room-filters__action" id="roomBtnCheckAllRarity">&#10003;</button>
                                    <button type="button" class="room-filters__action" id="roomBtnUncheckAllRarity">&#10007;</button>
                                </span>
                            </div>
                            <div class="room-filters__list" id="roomRarityFilters"></div>
                        </div>
                        <div class="room-filters__group">
                            <div class="room-filters__group-header">
                                <h4 id="labelFilterClasses">Classes</h4>
                                <span class="room-filters__actions">
                                    <button type="button" class="room-filters__action" id="roomBtnCheckAllClass">&#10003;</button>
                                    <button type="button" class="room-filters__action" id="roomBtnUncheckAllClass">&#10007;</button>
                                </span>
                            </div>
                            <div class="room-filters__list" id="roomClassFilters"></div>
                        </div>
                    </div>
                </div>
```

- [ ] **Step 2: Add config summary element in sidebar**

In `room.html`, add after the `<span class="room-sidebar__mode-tag" id="sidebarMode"></span>` line (line 111):

```html
                        <span class="room-sidebar__config" id="sidebarConfig" style="display:none"></span>
```

- [ ] **Step 3: Cache `sidebarConfig` in `room-ui.js`**

In `js/room-ui.js`, add after `els.sidebarMode = document.getElementById('sidebarMode');` in `cacheElements()`:

```js
        els.sidebarConfig = document.getElementById('sidebarConfig');
```

- [ ] **Step 4: Commit**

```bash
git add room.html js/room-ui.js
git commit -m "feat(html): add collapsible filter panel and config summary element"
```

---

## Task 7 — CSS: Filter panel, kick button, config summary styles

**Files:** Modify `css/style.css`

- [ ] **Step 1: Add filter panel styles**

In `css/style.css`, add after `.room-setup__back:hover { ... }` (after line 1901):

```css
/* --- Room Setup: Filter Toggle --- */
.room-setup__toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
    background: none;
    border: 1px solid var(--border-oat-light);
    border-radius: 8px;
    padding: 0.6rem 0.75rem;
    color: var(--text-secondary);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
}

.room-setup__toggle:hover {
    color: var(--text-primary);
    border-color: var(--text-secondary);
}

.room-setup__toggle-arrow {
    font-size: 0.7rem;
    transition: transform 0.2s;
}

.room-setup__toggle--open .room-setup__toggle-arrow {
    transform: rotate(90deg);
}

/* --- Room Setup: Filter Panel --- */
.room-setup__filters {
    margin-top: 0.5rem;
    padding: 0.75rem;
    border: 1px solid var(--border-oat-light);
    border-radius: 8px;
    background: var(--bg-canvas);
}

.room-filters__presets {
    display: flex;
    gap: 0.4rem;
    margin-bottom: 0.75rem;
}

.room-filters__group {
    margin-bottom: 0.6rem;
}

.room-filters__group:last-child {
    margin-bottom: 0;
}

.room-filters__group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.35rem;
}

.room-filters__group-header h4 {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0;
}

.room-filters__actions {
    display: flex;
    gap: 0.25rem;
}

.room-filters__action {
    background: none;
    border: 1px solid var(--border-oat-light);
    border-radius: 4px;
    padding: 0.15rem 0.4rem;
    color: var(--text-secondary);
    font-size: 0.7rem;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
}

.room-filters__action:hover {
    color: var(--text-primary);
    border-color: var(--text-secondary);
}

.room-filters__list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.2rem;
}

.room-filters__list label {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.78rem;
    padding: 0.2rem 0.3rem;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.room-filters__list label:hover {
    background: var(--bg-elevated);
}

.room-filters__list label img {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
}
```

- [ ] **Step 2: Add kick button styles**

In `css/style.css`, add after the `.player-progress__text { ... }` block (after line 2094):

```css
/* --- Player Kick Button --- */
.player-kick {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--text-secondary);
    font-size: 0.7rem;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s, color 0.15s, border-color 0.15s;
}

.player-item:hover .player-kick {
    opacity: 1;
}

.player-kick:hover {
    color: var(--accent-red);
    border-color: var(--accent-red);
}
```

- [ ] **Step 3: Add config summary style in sidebar**

In `css/style.css`, add after `.room-sidebar__mode-tag--versus { ... }` (after line 1977):

```css
.room-sidebar__config {
    font-size: 0.7rem;
    color: var(--text-secondary);
    font-family: var(--font-mono);
    padding: 0.2rem 0.5rem;
}
```

- [ ] **Step 4: Commit**

```bash
git add css/style.css
git commit -m "feat(css): filter panel, kick button, config summary styles"
```

---

## Task 8 — Room App: Filter wiring, config collection, kicked redirect

**Files:** Modify `js/room-app.js`

- [ ] **Step 1: Replace the entire `room-app.js`**

Replace `js/room-app.js` with the updated version that adds filter panel logic, config collection, and kicked redirect handling:

```js
/**
 * HearthDoku — Room page initialization
 */
(function() {
    const langSelect = document.getElementById('langSelect');
    langSelect.value = I18n.getLang();
    langSelect.addEventListener('change', () => {
        I18n.setLang(langSelect.value);
        location.reload();
    });

    function updateSetupText() {
        document.getElementById('setupTitle').textContent = I18n.t('createRoom');
        document.getElementById('labelPlayerName').textContent = I18n.t('enterName');
        document.getElementById('labelModeSelection').textContent = I18n.t('modeSelection');
        document.getElementById('labelCoop').textContent = I18n.t('cooperative');
        document.getElementById('labelCoopDesc').textContent = I18n.t('coopDesc');
        document.getElementById('labelVersus').textContent = I18n.t('competitive');
        document.getElementById('labelVersusDesc').textContent = I18n.t('versusDesc');
        document.getElementById('btnCreateRoom').textContent = I18n.t('createRoom');
        document.getElementById('labelOrJoin').textContent = I18n.t('orJoinRoom');
        document.getElementById('btnJoinRoom').textContent = I18n.t('joinRoom');
        document.getElementById('linkBackToSolo').textContent = I18n.t('backToSolo');
        document.getElementById('joinCode').placeholder = I18n.t('enterCode');
        document.getElementById('labelAdvancedFilters').textContent = I18n.t('advancedFilters');
        document.getElementById('labelFilterExtensions').textContent = I18n.t('filterExtensions');
        document.getElementById('labelFilterRarities').textContent = I18n.t('filterRarities');
        document.getElementById('labelFilterClasses').textContent = I18n.t('filterClasses');
    }
    updateSetupText();

    document.querySelectorAll('input[name="roomMode"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.querySelectorAll('.room-mode-option').forEach(opt => {
                opt.classList.toggle('room-mode-option--selected', opt.querySelector('input').checked);
            });
        });
    });

    // --- Kicked redirect check ---
    if (sessionStorage.getItem('hearthdoku_kicked')) {
        sessionStorage.removeItem('hearthdoku_kicked');
        const setupStatus = document.getElementById('setupStatus');
        setupStatus.textContent = I18n.t('kicked');
        setupStatus.className = 'room-setup__status room-setup__status--error';
        setupStatus.style.display = 'block';
    }

    // --- Filter panel toggle ---
    const toggleFilters = document.getElementById('toggleFilters');
    const filtersPanel = document.getElementById('filtersPanel');
    toggleFilters.addEventListener('click', () => {
        const open = filtersPanel.style.display !== 'none';
        filtersPanel.style.display = open ? 'none' : 'block';
        toggleFilters.classList.toggle('room-setup__toggle--open', !open);
    });

    // --- Render filter checkboxes ---
    function renderRoomFilters(sets) {
        const setContainer = document.getElementById('roomSetFilters');
        const rarityContainer = document.getElementById('roomRarityFilters');
        const classContainer = document.getElementById('roomClassFilters');

        // Sets
        setContainer.innerHTML = sets.map(s => {
            const name = HearthstoneAPI.getSetDisplayName(s);
            const iconPath = HearthstoneAPI.getSetIcon(s);
            const iconHtml = iconPath
                ? `<img src="${iconPath}" alt="" onerror="this.style.display='none'">`
                : '';
            return `<label><input type="checkbox" value="${s}" checked>${iconHtml}<span>${name}</span></label>`;
        }).join('');

        // Rarities
        const rarityMap = HearthstoneAPI.getRarityMap();
        const rarityOrder = ['LEGENDARY', 'EPIC', 'RARE', 'COMMON', 'FREE'];
        rarityContainer.innerHTML = rarityOrder.filter(r => rarityMap[r]).map(r => {
            const name = rarityMap[r];
            const iconPath = HearthstoneAPI.getRarityIcon(r);
            const iconHtml = iconPath
                ? `<img src="${iconPath}" alt="" onerror="this.style.display='none'">`
                : '';
            return `<label><input type="checkbox" value="${r}" checked>${iconHtml}<span>${name}</span></label>`;
        }).join('');

        // Classes
        const classMap = HearthstoneAPI.getClassMap();
        const classOrder = [
            'DEATHKNIGHT', 'DEMONHUNTER', 'DRUID', 'HUNTER', 'MAGE',
            'PALADIN', 'PRIEST', 'ROGUE', 'SHAMAN', 'WARLOCK',
            'WARRIOR', 'NEUTRAL',
        ];
        classContainer.innerHTML = classOrder.filter(c => classMap[c]).map(cls => {
            const name = classMap[cls];
            const iconPath = HearthstoneAPI.getClassIcon(cls);
            const iconHtml = iconPath
                ? `<img src="${iconPath}" alt="" onerror="this.style.display='none'">`
                : '';
            return `<label><input type="checkbox" value="${cls}" checked>${iconHtml}<span>${name}</span></label>`;
        }).join('');
    }

    function getCheckedValues(containerId) {
        const container = document.getElementById(containerId);
        return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    }

    function setAllCheckedIn(containerId, checked) {
        document.getElementById(containerId).querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = checked;
        });
    }

    function setPresetSets(presetSets) {
        document.getElementById('roomSetFilters').querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = presetSets.includes(cb.value);
        });
    }

    // --- Wire filter buttons ---
    document.getElementById('roomBtnCheckAll').addEventListener('click', () => setAllCheckedIn('roomSetFilters', true));
    document.getElementById('roomBtnUncheckAll').addEventListener('click', () => setAllCheckedIn('roomSetFilters', false));
    document.getElementById('roomBtnCheckAllRarity').addEventListener('click', () => setAllCheckedIn('roomRarityFilters', true));
    document.getElementById('roomBtnUncheckAllRarity').addEventListener('click', () => setAllCheckedIn('roomRarityFilters', false));
    document.getElementById('roomBtnCheckAllClass').addEventListener('click', () => setAllCheckedIn('roomClassFilters', true));
    document.getElementById('roomBtnUncheckAllClass').addEventListener('click', () => setAllCheckedIn('roomClassFilters', false));

    document.querySelectorAll('[data-room-preset]').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.roomPreset;
            switch (preset) {
                case 'standard':
                    setPresetSets(HearthstoneAPI.STANDARD_SETS);
                    break;
                case 'wild':
                    setAllCheckedIn('roomSetFilters', true);
                    break;
                case 'classic':
                    setPresetSets(HearthstoneAPI.CLASSIC_SETS);
                    break;
            }
        });
    });

    // --- Collect config from filters ---
    function collectConfig() {
        const sets = getCheckedValues('roomSetFilters');
        const rarities = getCheckedValues('roomRarityFilters');
        const classes = getCheckedValues('roomClassFilters');

        const allSets = HearthstoneAPI.getAllSets();
        const allRarities = ['LEGENDARY', 'EPIC', 'RARE', 'COMMON', 'FREE'];
        const allClasses = [
            'DEATHKNIGHT', 'DEMONHUNTER', 'DRUID', 'HUNTER', 'MAGE',
            'PALADIN', 'PRIEST', 'ROGUE', 'SHAMAN', 'WARLOCK',
            'WARRIOR', 'NEUTRAL',
        ];

        const isAllSets = sets.length === 0 || sets.length >= allSets.length;
        const isAllRarities = rarities.length === 0 || rarities.length >= allRarities.length;
        const isAllClasses = classes.length === 0 || classes.length >= allClasses.length;

        if (isAllSets && isAllRarities && isAllClasses) return null;

        return {
            sets: isAllSets ? [] : sets,
            rarities: isAllRarities ? [] : rarities,
            classes: isAllClasses ? [] : classes,
        };
    }

    // --- Load cards then render filters ---
    HearthstoneAPI.fetchCards().then(() => {
        console.log('[room] Cards loaded for display');
        const allSets = HearthstoneAPI.getAllSets();
        renderRoomFilters(allSets);
    });

    const params = new URLSearchParams(location.search);
    const codeFromUrl = params.get('code');

    if (codeFromUrl) {
        document.getElementById('joinCode').value = codeFromUrl;
    }

    const savedName = RoomClient.getStoredName();
    if (savedName) {
        document.getElementById('playerName').value = savedName;
    }

    const setupStatus = document.getElementById('setupStatus');
    function showSetupStatus(text, isError) {
        setupStatus.textContent = text;
        setupStatus.className = 'room-setup__status' + (isError ? ' room-setup__status--error' : '');
        setupStatus.style.display = 'block';
    }

    RoomClient.on('status', (msg) => {
        if (msg.status === 'connecting') showSetupStatus(I18n.t('connecting'), false);
        if (msg.status === 'disconnected') showSetupStatus(I18n.t('disconnected'), true);
    });
    RoomClient.on('error', (msg) => {
        showSetupStatus(msg.message, true);
        document.getElementById('btnCreateRoom').disabled = false;
        document.getElementById('btnJoinRoom').disabled = false;
    });
    RoomClient.on('kicked', () => {
        sessionStorage.setItem('hearthdoku_kicked', '1');
        window.location.replace('/room.html');
    });

    document.getElementById('btnCreateRoom').addEventListener('click', () => {
        const name = document.getElementById('playerName').value.trim();
        const modeEl = document.querySelector('input[name="roomMode"]:checked');
        const mode = modeEl ? modeEl.value : 'coop';
        const config = collectConfig();

        if (name) RoomClient.setStoredName(name);
        document.getElementById('btnCreateRoom').disabled = true;
        showSetupStatus(I18n.t('connecting'), false);
        RoomClient.createRoom(mode, name || null, config);
    });

    document.getElementById('btnJoinRoom').addEventListener('click', () => {
        const name = document.getElementById('playerName').value.trim();
        const code = document.getElementById('joinCode').value.trim();
        if (!code) return;

        if (name) RoomClient.setStoredName(name);
        document.getElementById('btnJoinRoom').disabled = true;
        showSetupStatus(I18n.t('connecting'), false);
        RoomClient.joinRoom(code, name || null);
    });

    if (codeFromUrl) {
        const name = document.getElementById('playerName').value.trim();
        if (name) RoomClient.setStoredName(name);
        showSetupStatus(I18n.t('connecting'), false);
        RoomClient.joinRoom(codeFromUrl, name || null);
    }

    RoomUI.init();

    RoomClient.on('room_created', (msg) => {
        history.replaceState(null, '', '/room.html?code=' + msg.code);
    });

    document.getElementById('btnGameOverClose').addEventListener('click', () => {
        RoomUI.closeGameOverModal();
    });
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/room-app.js
git commit -m "feat(room-app): filter panel wiring, config collection, kicked redirect"
```

---

## Task 9 — Manual verification

- [ ] **Step 1: Start the server**

```bash
cd server && npm run dev
```

- [ ] **Step 2: Start the static file server**

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/room.html`.

- [ ] **Step 3: Test host migration**

1. Open 2 tabs. Create a versus room in tab 1. Join in tab 2.
2. Close tab 1.
3. Verify: tab 2 shows host badge, "Start" button appears, status banner says "{name} is the new host".
4. Open tab 3, join same room. Verify: tab 2 can start the game.

- [ ] **Step 4: Test puzzle customization**

1. Open room setup. Click "Filtres avancés" — panel should expand with arrow rotating.
2. Click "Standard" preset — only standard sets should be checked.
3. Click "Créer une room" — room should create with filtered puzzle.
4. Open a second tab, join the room. Verify: sidebar shows config summary (e.g. "Standard").
5. Test with very restrictive filters (uncheck almost everything) — should get error "Failed to generate puzzle with these filters".

- [ ] **Step 5: Test kick/ban**

1. Open 3 tabs. Create room in tab 1 (host). Join in tab 2 and tab 3.
2. In tab 1 (host), hover over a player in the sidebar — kick button (✕) should appear.
3. Click kick on tab 2's player.
4. Verify: tab 2 redirects to setup with "Vous avez été expulsé de la room" message.
5. In tab 2, try to rejoin the same room code — should get "Banned from this room" error.
6. Verify: tab 2 can still create a new room (ban is per-room only).
7. Verify: non-host tabs do NOT see kick buttons.

- [ ] **Step 6: Test i18n**

1. Switch language to EN. Verify all new strings appear in English.
2. Switch back to FR. Verify all new strings appear in French.

- [ ] **Step 7: Final commit with all verification done**

```bash
git add -A
git commit -m "feat: host migration, puzzle config filters & kick/ban for multiplayer"
```
