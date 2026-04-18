/**
 * HearthDoku — Room UI: sidebar, grid, modals for multiplayer
 */
const RoomUI = (() => {
    let mode = null;
    let players = new Map();
    let myId = null;
    let hostId = null;
    let roomCode = null;
    let gameStarted = false;
    let gameFinished = false;
    let startedAt = null;
    let timerInterval = null;
    let puzzle = null;
    let cellState = Array(9).fill(null);
    let usedCardIds = new Set();
    let activeCellIndex = null;
    let score = 0;
    let errors = 0;
    const MAX_ERRORS = 3;

    const els = {};

    function cacheElements() {
        els.sidebar = document.getElementById('roomSidebar');
        els.sidebarCode = document.getElementById('sidebarCode');
        els.sidebarMode = document.getElementById('sidebarMode');
        els.sidebarConfig = document.getElementById('sidebarConfig');
        els.sidebarPlayers = document.getElementById('sidebarPlayers');
        els.sidebarPlayerCount = document.getElementById('sidebarPlayerCount');
        els.sidebarTimer = document.getElementById('sidebarTimer');
        els.btnCopyLink = document.getElementById('btnCopyLink');
        els.btnStartGame = document.getElementById('btnStartGame');
        els.statusBanner = document.getElementById('roomStatusBanner');
        els.puzzleGrid = document.getElementById('puzzleGrid');
        els.searchModal = document.getElementById('searchModal');
        els.searchInput = document.getElementById('searchInput');
        els.searchResults = document.getElementById('searchResults');
        els.searchTitle = document.getElementById('searchTitle');
        els.searchClose = document.getElementById('searchClose');
        els.statPts = document.getElementById('statPts');
        els.statPP = document.getElementById('statPP');
        els.statTimer = document.getElementById('statTimer');
        els.gameOverModal = document.getElementById('gameOverModal');
        els.gameOverTitle = document.getElementById('gameOverTitle');
        els.gameOverRanking = document.getElementById('gameOverRanking');
    }

    function init() {
        cacheElements();
        bindEvents();
        bindWsEvents();
    }

    function bindEvents() {
        els.btnCopyLink.addEventListener('click', copyRoomLink);

        els.btnStartGame.addEventListener('click', () => {
            RoomClient.startGame();
        });

        els.searchClose.addEventListener('click', closeSearchModal);
        els.searchModal.addEventListener('click', (e) => {
            if (e.target === els.searchModal) closeSearchModal();
        });
        els.searchInput.addEventListener('input', onSearchInput);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeSearchModal();
                closeGameOverModal();
            }
        });

        document.querySelectorAll('.grid-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                if (gameFinished) return;
                if (mode === 'versus' && !gameStarted) return;
                const row = parseInt(cell.dataset.row);
                const col = parseInt(cell.dataset.col);
                const idx = row * 3 + col;

                if (mode === 'coop' && cellState[idx]) return;
                if (mode === 'versus' && cellState[idx]) return;

                openSearchModal(idx);
            });
        });
    }

    function bindWsEvents() {
        RoomClient.on('room_state', onRoomState);
        RoomClient.on('player_joined', onPlayerJoined);
        RoomClient.on('player_left', onPlayerLeft);
        RoomClient.on('game_started', onGameStarted);
        RoomClient.on('cell_filled', onCellFilled);
        RoomClient.on('cell_error', onCellError);
        RoomClient.on('cell_rejected', onCellRejected);
        RoomClient.on('player_progress', onPlayerProgress);
        RoomClient.on('player_finished', onPlayerFinished);
        RoomClient.on('player_eliminated', onPlayerEliminated);
        RoomClient.on('game_over', onGameOver);
        RoomClient.on('error', onError);
        RoomClient.on('status', onConnectionStatus);
    }

    // --- WS event handlers ---

    function onRoomState(state) {
        mode = state.mode;
        myId = state.you;
        hostId = state.hostId;
        roomCode = RoomClient.getRoomCode();
        gameStarted = state.started;
        startedAt = state.startedAt;
        puzzle = state.puzzle;

        players.clear();
        state.players.forEach(p => players.set(p.id, p));

        renderSidebar();
        renderGrid();
        renderStats();

        if (state.grid && mode === 'coop') {
            state.grid.forEach((cell, i) => {
                if (cell) {
                    cellState[i] = { cardId: cell.cardId, cardName: cell.cardName, playerId: cell.playerId, correct: true };
                    renderCoopCell(i, cell);
                }
            });
        }

        if (gameStarted) {
            startTimer();
            setStatus(I18n.t('gameStarted'));
        } else if (mode === 'versus') {
            setStatus(myId === hostId ? I18n.t('waitingForPlayers') : I18n.t('waitingForHost'));
        }

        hideSetup();
    }

    function onPlayerJoined(msg) {
        players.set(msg.player.id, msg.player);
        renderPlayerList();
    }

    function onPlayerLeft(msg) {
        players.delete(msg.playerId);
        renderPlayerList();
    }

    function onGameStarted(msg) {
        gameStarted = true;
        startedAt = msg.startedAt;
        startTimer();
        setStatus(I18n.t('gameStarted'));
        els.btnStartGame.style.display = 'none';
    }

    function onCellFilled(msg) {
        const idx = msg.row * 3 + msg.col;

        if (mode === 'coop') {
            cellState[idx] = { cardId: msg.cardId, cardName: msg.cardName, playerId: msg.playerId, correct: true };
            renderCoopCell(idx, msg);

            if (msg.playerId === myId) {
                score += msg.score;
            }

            const p = players.get(msg.playerId);
            if (p) p.score += msg.score;
            renderPlayerList();
        } else {
            if (msg.playerId === myId) {
                score += msg.score;
                cellState[idx] = { cardId: msg.cardId, cardName: msg.cardName, correct: true };
                renderMyCell(idx, msg);
            }
        }

        renderStats();
        closeSearchModal();
    }

    function onCellError(msg) {
        errors++;
        const idx = msg.row * 3 + msg.col;
        const cellEl = document.querySelector(`.grid-cell[data-row="${msg.row}"][data-col="${msg.col}"]`);
        if (cellEl) {
            cellEl.innerHTML = `<div class="cell-card cell-card--wrong">
                <span class="cell-card__x">&#10007;</span>
                <span class="cell-card__name">${msg.cardName}</span>
            </div>`;
            cellEl.classList.add('grid-cell--wrong', 'anim-wrong');
            setTimeout(() => {
                cellEl.classList.remove('anim-wrong');
                if (mode === 'versus') {
                    cellEl.innerHTML = '';
                    cellEl.classList.remove('grid-cell--wrong');
                }
            }, 800);
        }
        renderStats();
        closeSearchModal();
    }

    function onCellRejected(msg) {
        closeSearchModal();
    }

    function onPlayerProgress(msg) {
        const p = players.get(msg.playerId);
        if (p) {
            p.filled = msg.filled;
            renderPlayerList();
        }
    }

    function onPlayerFinished(msg) {
        const p = players.get(msg.playerId);
        if (p) {
            p.finishedAt = msg.time;
            p.score = msg.score;
            p.rank = msg.rank;
            renderPlayerList();
        }
    }

    function onPlayerEliminated(msg) {
        const p = players.get(msg.playerId);
        if (p) {
            p.eliminated = true;
            renderPlayerList();
        }
        if (msg.playerId === myId) {
            gameFinished = true;
            clearInterval(timerInterval);
        }
    }

    function onGameOver(msg) {
        gameFinished = true;
        clearInterval(timerInterval);
        showGameOverModal(msg.scores);
    }

    function onError(msg) {
        setStatus(msg.message, true);
    }

    function onConnectionStatus(msg) {
        if (msg.status === 'connecting') {
            setStatus(I18n.t('connecting'));
        } else if (msg.status === 'disconnected') {
            setStatus(I18n.t('disconnected'), true);
        }
    }

    // --- Rendering ---

    function renderSidebar() {
        els.sidebarCode.textContent = roomCode;
        els.sidebarMode.textContent = mode === 'coop' ? I18n.t('cooperative') : I18n.t('competitive');
        els.sidebarMode.className = `room-sidebar__mode-tag room-sidebar__mode-tag--${mode}`;

        if (mode === 'versus' && !gameStarted && myId === hostId) {
            els.btnStartGame.style.display = 'block';
            els.btnStartGame.textContent = I18n.t('startGame');
        } else {
            els.btnStartGame.style.display = 'none';
        }

        if (mode === 'versus') {
            els.sidebarTimer.style.display = 'block';
        }

        renderPlayerList();
    }

    function renderPlayerList() {
        const list = els.sidebarPlayers;
        els.sidebarPlayerCount.textContent = `${I18n.t('players')} (${players.size})`;

        let html = '';
        for (const [id, p] of players) {
            const isMe = id === myId;
            const isHost = id === hostId;
            const nameTag = isMe ? `${p.name} (${I18n.t('you')})` : p.name;
            const hostBadge = isHost ? `<span class="player-badge player-badge--host">${I18n.t('host')}</span>` : '';

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
            </div>`;
        }
        list.innerHTML = html;
    }

    function renderGrid() {
        if (!puzzle) return;
        for (let c = 0; c < 3; c++) {
            const el = document.getElementById(`colHeader${c}`);
            el.innerHTML = renderBadge(puzzle.colCriteria[c]);
        }
        for (let r = 0; r < 3; r++) {
            const el = document.getElementById(`rowHeader${r}`);
            el.innerHTML = renderBadge(puzzle.rowCriteria[r]);
        }
    }

    function renderBadge(criterion) {
        const display = PuzzleEngine.getCriterionDisplay(criterion);
        return `<div class="badge ${display.bgClass}" title="${display.tooltip}">
            <span class="badge__icon">${display.icon}</span>
            <span class="badge__label">${display.label}</span>
        </div>`;
    }

    function renderCoopCell(idx, data) {
        const row = Math.floor(idx / 3);
        const col = idx % 3;
        const cellEl = document.querySelector(`.grid-cell[data-row="${row}"][data-col="${col}"]`);
        if (!cellEl) return;

        const p = players.get(data.playerId);
        const color = p ? p.color : '#888';
        const renderUrl = HearthstoneAPI.getCardRenderUrl(data.cardId);

        cellEl.innerHTML = `<div class="cell-card cell-card--correct cell-card--coop" style="border-left: 3px solid ${color}">
            <img src="${renderUrl}" alt="${data.cardName}" onerror="this.parentElement.innerHTML='<span class=\\'cell-card__name\\'>${data.cardName}</span>'">
            <div class="cell-card__name-overlay">${data.cardName}</div>
        </div>`;
        cellEl.classList.add('grid-cell--correct');
    }

    function renderMyCell(idx, data) {
        const row = Math.floor(idx / 3);
        const col = idx % 3;
        const cellEl = document.querySelector(`.grid-cell[data-row="${row}"][data-col="${col}"]`);
        if (!cellEl) return;

        const renderUrl = HearthstoneAPI.getCardRenderUrl(data.cardId);
        cellEl.innerHTML = `<div class="cell-card cell-card--correct">
            <img src="${renderUrl}" alt="${data.cardName}" onerror="this.parentElement.innerHTML='<span class=\\'cell-card__name\\'>${data.cardName}</span>'">
            <div class="cell-card__name-overlay">${data.cardName}</div>
            <div class="cell-card__score">+${data.score}</div>
        </div>`;
        cellEl.classList.add('grid-cell--correct');
    }

    function renderStats() {
        els.statPts.textContent = score;
        els.statPP.textContent = `${errors}/${MAX_ERRORS}`;
        els.statPP.classList.toggle('stat-value--danger', errors >= MAX_ERRORS - 1);
    }

    // --- Search Modal ---

    function openSearchModal(cellIndex) {
        activeCellIndex = cellIndex;
        const row = Math.floor(cellIndex / 3);
        const col = cellIndex % 3;
        const rowDisplay = PuzzleEngine.getCriterionDisplay(puzzle.rowCriteria[row]);
        const colDisplay = PuzzleEngine.getCriterionDisplay(puzzle.colCriteria[col]);
        els.searchTitle.innerHTML = `${rowDisplay.icon} ${rowDisplay.label} <span style="margin:0 0.3rem">&times;</span> ${colDisplay.icon} ${colDisplay.label}`;
        els.searchInput.value = '';
        els.searchInput.placeholder = I18n.t('searchPlaceholder');
        els.searchResults.innerHTML = '';
        els.searchModal.classList.add('modal-overlay--visible');
        setTimeout(() => els.searchInput.focus(), 100);
    }

    function closeSearchModal() {
        els.searchModal.classList.remove('modal-overlay--visible');
        activeCellIndex = null;
        CardSearch.cancelSearch();
    }

    function onSearchInput() {
        const query = els.searchInput.value.trim();
        if (query.length < 2) {
            els.searchResults.innerHTML = '';
            return;
        }

        const allCards = HearthstoneAPI.getCollectibleCards();
        CardSearch.debouncedSearch(query, allCards, (results) => {
            renderSearchResults(results);
        });
    }

    function renderSearchResults(results) {
        if (results.length === 0) {
            els.searchResults.innerHTML = `<div class="search-empty">${I18n.t('noCardFound')}</div>`;
            return;
        }

        const AMBIGUOUS_SETS = new Set(['CORE', 'LEGACY', 'EXPERT1', 'VANILLA']);

        els.searchResults.innerHTML = results.map(card => {
            const used = usedCardIds.has(card.dbfId || card.id);
            const setCode = card.set || '';
            const showSetBadge = AMBIGUOUS_SETS.has(setCode);
            const setIcon = showSetBadge ? HearthstoneAPI.getSetIcon(setCode) : null;
            const setName = showSetBadge ? HearthstoneAPI.getSetDisplayName(setCode) : '';
            const setIconHtml = setIcon
                ? `<img class="search-result__set-icon" src="${setIcon}" alt="" onerror="this.style.display='none'">`
                : '';

            return `<div class="search-result ${used ? 'search-result--used' : ''}" data-card-id="${card.id}" data-dbf-id="${card.dbfId}">
                <div class="search-result__info">
                    <div class="search-result__name">${card.name}</div>
                    ${showSetBadge ? `<div class="search-result__set">${setIconHtml}<span>${setName}</span></div>` : ''}
                </div>
                ${used ? `<div class="search-result__used-tag">${I18n.t('alreadyUsed')}</div>` : ''}
            </div>`;
        }).join('');

        els.searchResults.querySelectorAll('.search-result:not(.search-result--used)').forEach(el => {
            el.addEventListener('click', () => {
                const cardId = el.dataset.cardId;
                const dbfId = parseInt(el.dataset.dbfId);
                selectCard(cardId, dbfId);
            });
        });
    }

    function selectCard(cardId, dbfId) {
        if (activeCellIndex === null) return;
        const row = Math.floor(activeCellIndex / 3);
        const col = activeCellIndex % 3;
        usedCardIds.add(dbfId || cardId);
        RoomClient.placeCard(row, col, cardId, dbfId);
    }

    // --- Timer ---

    function startTimer() {
        clearInterval(timerInterval);
        const base = startedAt || Date.now();
        timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - base) / 1000);
            els.statTimer.textContent = formatTime(elapsed * 1000);
            if (els.sidebarTimer) {
                els.sidebarTimer.textContent = formatTime(elapsed * 1000);
            }
        }, 1000);
    }

    function formatTime(ms) {
        const total = Math.floor(ms / 1000);
        const m = Math.floor(total / 60);
        const s = total % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    // --- Status ---

    function setStatus(text, isError) {
        if (els.statusBanner) {
            els.statusBanner.textContent = text;
            els.statusBanner.className = 'room-status-banner' + (isError ? ' room-status-banner--error' : '');
            els.statusBanner.style.display = 'block';
            if (!isError) {
                setTimeout(() => { els.statusBanner.style.display = 'none'; }, 3000);
            }
        }
    }

    // --- Game Over Modal ---

    function showGameOverModal(scores) {
        els.gameOverTitle.textContent = I18n.t('finalRanking');
        let html = '<ol class="ranking-list">';
        scores.forEach((s, i) => {
            const me = s.playerId === myId ? ' ranking-item--me' : '';
            const status = s.eliminated
                ? `<span class="ranking-status ranking-status--eliminated">${I18n.t('eliminated')}</span>`
                : s.time ? `<span class="ranking-status">${formatTime(s.time)}</span>` : '';
            html += `<li class="ranking-item${me}">
                <span class="ranking-rank">#${i + 1}</span>
                <span class="ranking-name">${s.name}</span>
                <span class="ranking-score">${s.score}pts</span>
                ${status}
            </li>`;
        });
        html += '</ol>';
        els.gameOverRanking.innerHTML = html;
        els.gameOverModal.classList.add('modal-overlay--visible');
    }

    function closeGameOverModal() {
        if (els.gameOverModal) {
            els.gameOverModal.classList.remove('modal-overlay--visible');
        }
    }

    // --- Copy link ---

    function copyRoomLink() {
        const url = `${location.origin}/room/${roomCode}`;
        navigator.clipboard.writeText(url).then(() => {
            const btn = els.btnCopyLink;
            const orig = btn.textContent;
            btn.textContent = I18n.t('linkCopied');
            setTimeout(() => { btn.textContent = orig; }, 2000);
        });
    }

    // --- Setup UI ---

    function hideSetup() {
        const setup = document.getElementById('roomSetup');
        if (setup) setup.style.display = 'none';
        const game = document.getElementById('roomGame');
        if (game) game.style.display = 'flex';
    }

    return { init, closeGameOverModal };
})();
