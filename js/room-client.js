/**
 * HearthDoku — Room WebSocket client
 */
const RoomClient = (() => {
    const WS_URL = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
        ? `ws://${location.hostname}:8080`
        : 'wss://hearthdoku-server.fly.dev';

    let ws = null;
    let roomCode = null;
    let playerId = null;
    let roomState = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT = 5;
    let handlers = {};

    function on(event, fn) {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(fn);
    }

    function emit(event, data) {
        if (handlers[event]) {
            handlers[event].forEach(fn => fn(data));
        }
    }

    function connect() {
        if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;

        emit('status', { status: 'connecting' });
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            reconnectAttempts = 0;
            emit('status', { status: 'connected' });

            if (roomCode && !roomState) {
                send({ type: 'join', code: roomCode, name: getStoredName() });
            }
        };

        ws.onmessage = (e) => {
            let msg;
            try { msg = JSON.parse(e.data); } catch { return; }
            handleMessage(msg);
        };

        ws.onclose = () => {
            emit('status', { status: 'disconnected' });
            tryReconnect();
        };

        ws.onerror = () => {};
    }

    function tryReconnect() {
        if (reconnectAttempts >= MAX_RECONNECT) return;
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
        setTimeout(connect, delay);
    }

    function send(msg) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
        }
    }

    function handleMessage(msg) {
        switch (msg.type) {
            case 'room_created':
                roomCode = msg.code;
                emit('room_created', msg);
                break;

            case 'room_state':
                playerId = msg.you;
                roomState = msg;
                emit('room_state', msg);
                break;

            case 'player_joined':
                emit('player_joined', msg);
                break;

            case 'player_left':
                emit('player_left', msg);
                break;

            case 'game_started':
                if (roomState) roomState.started = true;
                if (roomState) roomState.startedAt = msg.startedAt;
                emit('game_started', msg);
                break;

            case 'cell_filled':
                emit('cell_filled', msg);
                break;

            case 'cell_error':
                emit('cell_error', msg);
                break;

            case 'cell_rejected':
                emit('cell_rejected', msg);
                break;

            case 'player_progress':
                emit('player_progress', msg);
                break;

            case 'player_finished':
                emit('player_finished', msg);
                break;

            case 'player_eliminated':
                emit('player_eliminated', msg);
                break;

            case 'game_over':
                emit('game_over', msg);
                break;

            case 'error':
                emit('error', msg);
                break;
        }
    }

    function createRoom(mode, name, config) {
        connect();
        const waitForOpen = () => {
            if (ws.readyState === WebSocket.OPEN) {
                send({ type: 'create', mode, name: name || getStoredName(), config });
            } else {
                setTimeout(waitForOpen, 100);
            }
        };
        waitForOpen();
    }

    function joinRoom(code, name) {
        roomCode = code.toUpperCase().trim();
        connect();
        const waitForOpen = () => {
            if (ws.readyState === WebSocket.OPEN) {
                send({ type: 'join', code: roomCode, name: name || getStoredName() });
            } else {
                setTimeout(waitForOpen, 100);
            }
        };
        waitForOpen();
    }

    function startGame() {
        send({ type: 'start' });
    }

    function placeCard(row, col, cardId, dbfId) {
        send({ type: 'place', row, col, cardId, dbfId });
    }

    function getPlayerId() {
        return playerId;
    }

    function getRoomCode() {
        return roomCode;
    }

    function getRoomState() {
        return roomState;
    }

    function getStoredName() {
        return localStorage.getItem('hearthdoku_player_name') || null;
    }

    function setStoredName(name) {
        if (name) localStorage.setItem('hearthdoku_player_name', name);
    }

    function disconnect() {
        reconnectAttempts = MAX_RECONNECT;
        if (ws) ws.close();
    }

    return {
        on, connect, createRoom, joinRoom, startGame, placeCard,
        getPlayerId, getRoomCode, getRoomState, getStoredName, setStoredName, disconnect,
    };
})();
