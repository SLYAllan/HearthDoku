/**
 * HearthDoku — Room WebSocket client
 */
const RoomClient = (() => {
    function getServerOrigin() {
        const h = location.hostname;
        if (!h || h === 'localhost' || h === '127.0.0.1') {
            return { http: 'http://localhost:8080', ws: 'ws://localhost:8080' };
        }
        return { http: 'https://ws.hearthdoku.fr', ws: 'wss://ws.hearthdoku.fr' };
    }
    const SERVER = getServerOrigin();

    let ws = null;
    let roomCode = null;
    let playerId = null;
    let roomState = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT = 5;
    let handlers = {};
    let serverAwake = false;

    function on(event, fn) {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(fn);
    }

    function emit(event, data) {
        if (handlers[event]) {
            handlers[event].forEach(fn => fn(data));
        }
    }

    async function wakeServer() {
        if (serverAwake) return;
        try {
            const res = await fetch(SERVER.http + '/health', { mode: 'cors' });
            if (res.ok) serverAwake = true;
        } catch {
            // server may still be waking up
        }
    }

    async function connect(onOpen) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            if (onOpen) onOpen();
            return;
        }
        if (ws && ws.readyState === WebSocket.CONNECTING) {
            if (onOpen) ws.addEventListener('open', onOpen, { once: true });
            return;
        }

        emit('status', { status: 'connecting' });

        await wakeServer();

        try {
            ws = new WebSocket(SERVER.ws);
        } catch (e) {
            emit('error', { message: 'WebSocket connection failed' });
            return;
        }

        ws.onopen = () => {
            reconnectAttempts = 0;
            serverAwake = true;
            emit('status', { status: 'connected' });
            if (onOpen) onOpen();
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

        ws.onerror = () => {
            emit('error', { message: 'Connection error' });
        };
    }

    function tryReconnect() {
        if (reconnectAttempts >= MAX_RECONNECT) return;
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
        setTimeout(() => connect(), delay);
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

            case 'surrender_vote':
                emit('surrender_vote', msg);
                break;

            case 'error':
                emit('error', msg);
                break;
        }
    }

    function createRoom(mode, name, config) {
        connect(() => {
            send({ type: 'create', mode, name: name || getStoredName(), config });
        });
    }

    function joinRoom(code, name) {
        roomCode = code.toUpperCase().trim();
        connect(() => {
            send({ type: 'join', code: roomCode, name: name || getStoredName() });
        });
    }

    function startGame() {
        send({ type: 'start' });
    }

    function placeCard(row, col, cardId, dbfId) {
        send({ type: 'place', row, col, cardId, dbfId });
    }

    function kickPlayer(playerId) {
        send({ type: 'kick', playerId });
    }

    function surrender() {
        send({ type: 'surrender' });
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
        on, connect, createRoom, joinRoom, startGame, placeCard, kickPlayer, surrender,
        getPlayerId, getRoomCode, getRoomState, getStoredName, setStoredName, disconnect,
    };
})();
