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
    let roomConfig = null;
    const MAX_ERRORS = 3;
    let surrenderVotes = 0;
    let surrenderNeeded = 0;
    let mySurrenderVote = false;

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
        els.btnSurrender = document.getElementById('btnSurrender');
        els.surrenderStatus = document.getElementById('surrenderStatus');
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

        els.btnSurrender.addEventListener('click', () => {
            RoomClient.surrender();
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
                if (errors >= MAX_ERRORS) return;
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
        RoomClient.on('surrender_vote', onSurrenderVote);
        RoomClient.on('error', onError);
        RoomClient.on('status', onConnectionStatus);
        RoomClient.on('host_changed', onHostChanged);
        RoomClient.on('kicked', onKicked);
        RoomClient.on('player_kicked', onPlayerKicked);
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
        roomConfig = state.config;

        players.clear();
        state.players.forEach(p => players.set(p.id, p));

        const meData = state.players.find(p => p.id === state.you);
        errors = meData ? meData.errors : 0;
        if (mode === 'coop') {
            score = state.players.reduce((sum, p) => sum + p.score, 0);
        } else {
            score = meData ? meData.score : 0;
        }

        renderSidebar();
        renderGrid();
        renderStats();

        if (state.grid && mode === 'coop') {
            state.grid.forEach((cell, i) => {
                if (cell) {
                    cellState[i] = { cardId: cell.cardId, cardName: cell.cardName, dbfId: cell.dbfId, playerId: cell.playerId, correct: true };
                    renderCoopCell(i, cell);
                }
            });
        }

        if (gameStarted) {
            startTimer();
            if (mode === 'versus') setStatus(I18n.t('gameStarted'));
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

    function onHostChanged(msg) {
        hostId = msg.hostId;
        renderPlayerList();
        renderSidebar();
        const text = I18n.t('hostChanged').replace('{name}', msg.name);
        setStatus(text);
    }

    function onKicked() {
        gameFinished = true;
        clearInterval(timerInterval);
        sessionStorage.setItem('hearthdoku_kicked', '1');
        window.location.replace('room.html');
    }

    function onPlayerKicked(msg) {
        players.delete(msg.playerId);
        renderPlayerList();
        const text = I18n.t('playerKicked').replace('{name}', msg.name);
        setStatus(text);
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
        const localName = getLocalCardName(msg.dbfId, msg.cardName);
        const localMsg = Object.assign({}, msg, { cardName: localName });

        usedCardIds.add(msg.dbfId || msg.cardId);

        if (mode === 'coop') {
            cellState[idx] = { cardId: msg.cardId, cardName: localName, dbfId: msg.dbfId, playerId: msg.playerId, correct: true };
            renderCoopCell(idx, localMsg);

            score += msg.score;

            const p = players.get(msg.playerId);
            if (p) p.score += msg.score;
            renderPlayerList();
        } else {
            if (msg.playerId === myId) {
                score += msg.score;
                cellState[idx] = { cardId: msg.cardId, cardName: localName, dbfId: msg.dbfId, correct: true };
                renderMyCell(idx, localMsg);
            }
        }

        renderStats();
        closeSearchModal();
    }

    function onCellError(msg) {
        if (msg.playerId === myId) {
            errors = msg.playerErrors !== undefined ? msg.playerErrors : (errors + 1);
        }
        const localName = getLocalCardName(msg.dbfId, msg.cardName);
        const cellEl = document.querySelector(`.grid-cell[data-row="${msg.row}"][data-col="${msg.col}"]`);
        if (cellEl) {
            cellEl.innerHTML = `<div class="cell-card cell-card--wrong">
                <span class="cell-card__x">&#10007;</span>
                <span class="cell-card__name">${escapeHtml(localName)}</span>
            </div>`;
            cellEl.classList.add('grid-cell--wrong', 'anim-wrong');
            setTimeout(() => {
                cellEl.classList.remove('anim-wrong');
                cellEl.innerHTML = '';
                cellEl.classList.remove('grid-cell--wrong');
            }, 800);
        }
        renderStats();
        if (!msg.playerId || msg.playerId === myId) {
            closeSearchModal();
        }
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

    function onSurrenderVote(msg) {
        surrenderVotes = msg.votes;
        surrenderNeeded = msg.needed;
        mySurrenderVote = msg.playerId === myId ? !mySurrenderVote : mySurrenderVote;
        updateSurrenderUI();
    }

    function onGameOver(msg) {
        gameFinished = true;
        clearInterval(timerInterval);
        showGameOverModal(msg);
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

    // --- Helpers ---

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getLocalCardName(dbfId, fallback) {
        if (!dbfId) return fallback;
        const cards = HearthstoneAPI.getCollectibleCards();
        const card = cards.find(c => c.dbfId === dbfId);
        return card ? card.name : fallback;
    }

    function updateSurrenderUI() {
        if (!els.btnSurrender) return;
        if (surrenderVotes > 0) {
            els.surrenderStatus.textContent = `${surrenderVotes}/${surrenderNeeded} votes`;
            els.surrenderStatus.style.display = 'block';
        } else {
            els.surrenderStatus.style.display = 'none';
        }
        els.btnSurrender.textContent = mySurrenderVote ? I18n.t('cancelSurrender') : I18n.t('surrender');
    }

    // --- Rendering ---

    function renderSidebar() {
        els.sidebarCode.textContent = roomCode;
        els.sidebarMode.textContent = mode === 'coop' ? I18n.t('cooperative') : I18n.t('competitive');
        els.sidebarMode.className = `room-sidebar__mode-tag room-sidebar__mode-tag--${mode}`;

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

        if (mode === 'versus' && !gameStarted && myId === hostId) {
            els.btnStartGame.style.display = 'block';
            els.btnStartGame.textContent = I18n.t('startGame');
        } else {
            els.btnStartGame.style.display = 'none';
        }

        els.sidebarTimer.style.display = 'block';

        if (gameStarted || mode === 'coop') {
            els.btnSurrender.style.display = 'block';
            els.btnSurrender.textContent = I18n.t('surrender');
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
            const nameTag = isMe ? `${escapeHtml(p.name)} (${I18n.t('you')})` : escapeHtml(p.name);
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
    }

    function bindImgFallbacks(container) {
        container.querySelectorAll('img').forEach(img => {
            if (img._fbBound) return;
            img._fbBound = true;
            img.addEventListener('error', () => {
                const fb = img.dataset.fallback || img.alt || '?';
                const text = document.createTextNode(fb);
                img.replaceWith(text);
            });
        });
    }

    function renderGrid() {
        if (!puzzle) return;
        for (let c = 0; c < 3; c++) {
            const el = document.getElementById(`colHeader${c}`);
            el.innerHTML = renderBadge(puzzle.colCriteria[c]);
            bindImgFallbacks(el);
        }
        for (let r = 0; r < 3; r++) {
            const el = document.getElementById(`rowHeader${r}`);
            el.innerHTML = renderBadge(puzzle.rowCriteria[r]);
            bindImgFallbacks(el);
        }
    }

    function renderBadge(criterion) {
        const display = PuzzleEngine.getCriterionDisplay(criterion);
        return `<div class="badge ${display.bgClass}" title="${display.tooltip}">
            <span class="badge__icon">${display.icon}</span>
            <span class="badge__label">${display.label}</span>
        </div>`;
    }

    function cardImgHtml(renderUrl, name) {
        return `<img src="${renderUrl}" alt="${escapeHtml(name)}">`;
    }

    function bindCardImgFallback(cellEl, name) {
        const img = cellEl.querySelector('img');
        if (img) {
            img.addEventListener('error', () => {
                const span = document.createElement('span');
                span.className = 'cell-card__name';
                span.textContent = name;
                const parent = img.parentElement;
                parent.textContent = '';
                parent.appendChild(span);
            });
        }
    }

    function renderCoopCell(idx, data) {
        const row = Math.floor(idx / 3);
        const col = idx % 3;
        const cellEl = document.querySelector(`.grid-cell[data-row="${row}"][data-col="${col}"]`);
        if (!cellEl) return;

        const p = players.get(data.playerId);
        const color = p ? p.color : '#888';
        const pName = p ? p.name : '';
        const localName = getLocalCardName(data.dbfId, data.cardName);
        const renderUrl = HearthstoneAPI.getCardRenderUrl(data.cardId);

        cellEl.innerHTML = `<div class="cell-card cell-card--correct cell-card--coop" style="border-left: 5px solid ${color}">
            ${cardImgHtml(renderUrl, localName)}
            <div class="cell-card__name-overlay">${escapeHtml(localName)}</div>
            <span class="cell-card__player-dot" style="background:${color}" title="${escapeHtml(pName)}"></span>
        </div>`;
        cellEl.classList.add('grid-cell--correct');
        bindCardImgFallback(cellEl, localName);
    }

    function renderMyCell(idx, data) {
        const row = Math.floor(idx / 3);
        const col = idx % 3;
        const cellEl = document.querySelector(`.grid-cell[data-row="${row}"][data-col="${col}"]`);
        if (!cellEl) return;

        const renderUrl = HearthstoneAPI.getCardRenderUrl(data.cardId);
        cellEl.innerHTML = `<div class="cell-card cell-card--correct">
            ${cardImgHtml(renderUrl, data.cardName)}
            <div class="cell-card__name-overlay">${escapeHtml(data.cardName)}</div>
            <div class="cell-card__score">+${data.score}</div>
        </div>`;
        cellEl.classList.add('grid-cell--correct');
        bindCardImgFallback(cellEl, data.cardName);
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
                ? `<img class="search-result__set-icon" src="${setIcon}" alt="">`
                : '';

            return `<div class="search-result ${used ? 'search-result--used' : ''}" data-card-id="${card.id}" data-dbf-id="${card.dbfId}">
                <div class="search-result__info">
                    <div class="search-result__name">${escapeHtml(card.name)}</div>
                    ${showSetBadge ? `<div class="search-result__set">${setIconHtml}<span>${escapeHtml(setName)}</span></div>` : ''}
                </div>
                ${used ? `<div class="search-result__used-tag">${I18n.t('alreadyUsed')}</div>` : ''}
            </div>`;
        }).join('');

        els.searchResults.querySelectorAll('.search-result__set-icon').forEach(img => {
            img.addEventListener('error', () => { img.style.display = 'none'; }, { once: true });
        });

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

    function showGameOverModal(msg) {
        const { scores, reason, time, totalErrors, mode: gameMode } = msg;

        let title;
        if (reason === 'errors') {
            title = I18n.t('gameLost');
        } else if (reason === 'surrender') {
            title = I18n.t('gameSurrendered');
        } else {
            title = (gameMode || mode) === 'coop' ? I18n.t('gameWon') : I18n.t('finalRanking');
        }
        els.gameOverTitle.textContent = title;

        let summaryHtml = '<div class="game-over-summary">';
        if (time) {
            summaryHtml += `<div class="game-over-stat"><span class="game-over-stat__label">${I18n.t('time')}</span><span class="game-over-stat__value">${formatTime(time)}</span></div>`;
        }
        const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
        summaryHtml += `<div class="game-over-stat"><span class="game-over-stat__label">${I18n.t('score')}</span><span class="game-over-stat__value">${totalScore}pts</span></div>`;
        if (totalErrors !== null && totalErrors !== undefined) {
            summaryHtml += `<div class="game-over-stat"><span class="game-over-stat__label">${I18n.t('errorsLabel')}</span><span class="game-over-stat__value">${totalErrors}/${MAX_ERRORS}</span></div>`;
        }
        summaryHtml += '</div>';

        let rankHtml = '<ol class="ranking-list">';
        scores.forEach((s, i) => {
            const me = s.playerId === myId ? ' ranking-item--me' : '';
            const status = s.eliminated
                ? `<span class="ranking-status ranking-status--eliminated">${I18n.t('eliminated')}</span>`
                : s.time ? `<span class="ranking-status">${formatTime(s.time)}</span>` : '';
            rankHtml += `<li class="ranking-item${me}">
                <span class="ranking-rank">#${i + 1}</span>
                <span class="ranking-name">${escapeHtml(s.name)}</span>
                <span class="ranking-score">${s.score}pts</span>
                ${status}
            </li>`;
        });
        rankHtml += '</ol>';

        els.gameOverRanking.innerHTML = summaryHtml + rankHtml;
        els.gameOverModal.classList.add('modal-overlay--visible');
    }

    function closeGameOverModal() {
        if (els.gameOverModal) {
            els.gameOverModal.classList.remove('modal-overlay--visible');
        }
    }

    // --- Copy link ---

    function copyRoomLink() {
        const base = location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
        const url = `${base}room.html?code=${roomCode}`;
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
