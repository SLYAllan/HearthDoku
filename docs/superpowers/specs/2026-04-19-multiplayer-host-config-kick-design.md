# Multiplayer: Host Migration, Puzzle Customization & Kick/Ban — Design Spec

**Date:** 2026-04-19
**Branch:** `feat/multiplayer-rooms`
**Approach:** Server-authoritative — all logic in `room-manager.js`, client displays what the server sends.

---

## 1. Host Migration

### Trigger

When the host disconnects (`handleDisconnect()`), if at least one player remains in the room.

### Logic

- The next host is the first player in the `Map` insertion order (= the oldest connected player).
- Update `room.hostId` to the new player's ID.
- Broadcast `host_changed` to all remaining players.

### New WS Message

```
Server → All: { type: 'host_changed', hostId: 'p_xxx', name: 'Joueur#1234' }
```

### Server Changes (`server/room-manager.js`)

In `handleDisconnect()`, after deleting the player and before broadcasting `player_left`:

```
if (info.playerId === room.hostId && room.players.size > 0) {
    const newHost = room.players.values().next().value;
    room.hostId = newHost.id;
    broadcast(room, { type: 'host_changed', hostId: newHost.id, name: newHost.name });
}
```

### Client Changes

**`js/room-client.js`:**
- New case `host_changed` in `handleMessage()` → updates `roomState.hostId`, emits event.

**`js/room-ui.js`:**
- New handler `onHostChanged(msg)`:
  - Updates local `hostId`.
  - Re-renders player list (host badge moves).
  - If `myId === hostId` and game not started and mode is versus: show "Start" button.
  - Status banner: "{name} est le nouvel hôte" / "{name} is the new host".

### Edge Cases

- Game already started (`startedAt != null`): migration still happens, but start button stays hidden.
- Last player leaves: room is deleted (existing behavior, unchanged).
- The new host inherits all powers: start game + kick.

---

## 2. Puzzle Customization

### Data Flow

1. Host selects filters in the setup UI.
2. On "Create room" click, `room-app.js` collects checked filters into `config: { sets: [...], rarities: [...], classes: [...] }`.
3. `RoomClient.createRoom(mode, name, config)` sends config to server.
4. Server's `createRoom()` already passes `config` to `generatePuzzle(cards, config)`.
5. `puzzle-server.js` already filters by sets/rarities/classes.
6. Config is stored in `room.config` and broadcast in `room_state`.

### Server Changes

None required. The server already supports `config` in `createRoom()` and `generatePuzzle()`. Currently the client sends `null`.

### UI Changes (`room.html`)

Collapsible filter panel in the setup, after mode selection and before the "Create room" button:

```html
<div class="room-setup__section">
    <button type="button" class="room-setup__toggle" id="toggleFilters">
        ▸ Filtres avancés
    </button>
    <div class="room-setup__filters" id="filtersPanel" style="display:none">
        <!-- Presets -->
        <div class="room-filters__presets">
            <button data-preset="standard">Standard</button>
            <button data-preset="wild">Wild</button>
            <button data-preset="classic">Classic</button>
        </div>
        <!-- Sets checkboxes -->
        <div class="room-filters__group">
            <h4>Extensions</h4>
            <div id="roomSetFilters"></div>
            <button id="roomBtnCheckAll">✓ Tout</button>
            <button id="roomBtnUncheckAll">✗ Rien</button>
        </div>
        <!-- Rarity checkboxes -->
        <div class="room-filters__group">
            <h4>Raretés</h4>
            <div id="roomRarityFilters"></div>
            <button id="roomBtnCheckAllRarity">✓ Tout</button>
            <button id="roomBtnUncheckAllRarity">✗ Rien</button>
        </div>
        <!-- Class checkboxes -->
        <div class="room-filters__group">
            <h4>Classes</h4>
            <div id="roomClassFilters"></div>
            <button id="roomBtnCheckAllClass">✓ Tout</button>
            <button id="roomBtnUncheckAllClass">✗ Rien</button>
        </div>
    </div>
</div>
```

### Client Changes

**`js/room-app.js`:**
- Toggle button wires `filtersPanel` visibility (display none/block), toggles arrow (▸/▾).
- After cards load (`HearthstoneAPI.fetchCards()`), render set/rarity/class checkboxes into `#roomSetFilters`, `#roomRarityFilters`, `#roomClassFilters`.
- Wire preset buttons, check-all / uncheck-all buttons.
- On "Create room" click, collect checked values:
  ```js
  const sets = getCheckedValues('#roomSetFilters');
  const rarities = getCheckedValues('#roomRarityFilters');
  const classes = getCheckedValues('#roomClassFilters');
  const config = { sets, rarities, classes };
  RoomClient.createRoom(mode, name, config);
  ```
- Helper `getCheckedValues(containerSelector)` returns array of checked checkbox values.

**`js/room-ui.js`:**
- In `renderSidebar()`, display a config summary below the mode tag if filters are active.
- Logic: compare config against "all" to determine if filters are active. Display concise summary like "Standard · Rare+" or "Wild" if everything is checked.

### CSS Changes (`css/style.css`)

- `.room-setup__toggle`: button styled as a clickable header with arrow indicator.
- `.room-setup__filters`: container with padding, subtle border.
- `.room-filters__presets`: flex row of preset buttons.
- `.room-filters__group`: section with title + checkbox grid + action buttons.
- Checkboxes: compact grid layout (2-3 columns) to keep the panel manageable.

### Behavior

- Panel closed by default — everything checked by default (= wild, all rarities, all classes).
- Filters only visible to the room creator (the join section doesn't show them).
- Joiners see the config summary in the sidebar after joining.
- If the host selects filters that produce too few cards for a valid puzzle, the server returns the existing error "Failed to generate puzzle with these filters" and the host sees it in the setup status.

---

## 3. Kick/Ban

### New WS Messages

```
Client → Server:  { type: 'kick', playerId: 'p_xxx' }
Server → Kicked:  { type: 'kicked' }
Server → Others:  { type: 'player_kicked', playerId: 'p_xxx', name: 'Joueur#1234' }
```

### Room Data Change

Add `bannedIPs: new Set()` to the room object in `createRoom()`. Ban is scoped per-room only — the player can still create or join other rooms.

### Server Changes (`server/room-manager.js`)

New method `kickPlayer(ws, { playerId })`:

1. Validate: caller is host (`info.playerId === room.hostId`).
2. Validate: target exists in room and is not the host.
3. Get target's IP from `target.ws._socket.remoteAddress`.
4. Add IP to `room.bannedIPs`.
5. Send `{ type: 'kicked' }` to target.
6. Remove target from room (`room.players.delete()`), clean up `playerToRoom` and `rateLimiter`. This must happen **before** closing the WS, so that the `handleDisconnect()` triggered by the close finds no `playerToRoom` entry and returns early.
7. Close target's WebSocket.
8. Broadcast `{ type: 'player_kicked', playerId, name }` to remaining players.
9. If mode is versus and game started, call `checkVersusEnd()`.

In `joinRoom()`, add validation before accepting:
```
const ip = ws._socket.remoteAddress;
if (room.bannedIPs.has(ip)) {
    sendTo(ws, { type: 'error', message: 'Banned from this room' });
    return;
}
```

### Server Changes (`server/index.js`)

Add case `kick` in the message switch:
```js
case 'kick':
    roomManager.kickPlayer(ws, { playerId: msg.playerId });
    break;
```

### Client Changes

**`js/room-client.js`:**
- New cases in `handleMessage()`: `kicked` and `player_kicked`.
- New method `kickPlayer(playerId)`: sends `{ type: 'kick', playerId }`.

**`js/room-ui.js`:**
- In `renderPlayerList()`: for each player that is not me and not the host, if I am the host, show a kick button (✕ icon) next to the player name.
- Click handler on kick button: calls `RoomClient.kickPlayer(playerId)`.
- New handler `onKicked()`: sets a flag or sessionStorage marker, redirects to setup.
- New handler `onPlayerKicked(msg)`: removes player from local `players` map, re-renders player list, shows status banner "{name} a été expulsé" / "{name} was kicked".

**`js/room-app.js`:**
- On page load, check for kicked marker (sessionStorage). If present, show setup status message "Vous avez été expulsé de la room" and clear the marker.
- Listen to `RoomClient.on('kicked', ...)` at setup level to handle the redirect.

### CSS Changes (`css/style.css`)

- `.player-kick`: small button (✕), positioned right side of player item, red on hover. Only visible for host.

### i18n (`js/i18n.js`)

New keys for both FR and EN:

| Key | FR | EN |
|-----|----|----|
| `kick` | `Expulser` | `Kick` |
| `kicked` | `Vous avez été expulsé de la room` | `You have been kicked from the room` |
| `playerKicked` | `{name} a été expulsé` | `{name} was kicked` |
| `bannedFromRoom` | `Vous êtes banni de cette room` | `You are banned from this room` |
| `advancedFilters` | `Filtres avancés` | `Advanced filters` |
| `extensions` | `Extensions` | `Sets` |
| `rarities` | `Raretés` | `Rarities` |
| `classes` | `Classes` | `Classes` |
| `checkAll` | `Tout` | `All` |
| `uncheckAll` | `Rien` | `None` |
| `hostChanged` | `{name} est le nouvel hôte` | `{name} is the new host` |

---

## Files Modified

| File | Changes |
|------|---------|
| `server/room-manager.js` | Host migration in `handleDisconnect()`, `kickPlayer()` method, `bannedIPs` on room, IP check in `joinRoom()` |
| `server/index.js` | New `kick` case in message switch |
| `js/room-client.js` | New cases: `host_changed`, `kicked`, `player_kicked`. New method: `kickPlayer()` |
| `js/room-ui.js` | Handlers: `onHostChanged()`, `onKicked()`, `onPlayerKicked()`. Kick button in player list. Config summary in sidebar |
| `js/room-app.js` | Filter panel toggle, collect config on create, preset/check-all wiring, kicked redirect handling |
| `room.html` | Collapsible filter panel in setup section |
| `css/style.css` | Filter panel styles, kick button styles, toggle button styles |
| `js/i18n.js` | New keys for kick, ban, filters, host migration |
