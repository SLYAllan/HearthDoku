const http = require('http');
const { WebSocketServer } = require('ws');
const { fetchCards } = require('./card-fetcher');
const { RoomManager } = require('./room-manager');

const PORT = parseInt(process.env.WS_PORT || '8080', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const roomManager = new RoomManager();

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    if (req.url === '/health') {
        const stats = roomManager.getStats();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', ...stats }));
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
    const origin = req.headers.origin || '';
    if (CORS_ORIGIN !== '*' && !CORS_ORIGIN.split(',').some(o => origin.startsWith(o.trim()))) {
        ws.close(4003, 'Origin not allowed');
        return;
    }

    ws.on('message', (data) => {
        let msg;
        try {
            msg = JSON.parse(data);
        } catch {
            return;
        }

        if (!msg || typeof msg.type !== 'string') return;

        switch (msg.type) {
            case 'create':
                roomManager.createRoom(ws, {
                    mode: msg.mode,
                    name: msg.name,
                    config: msg.config,
                });
                break;
            case 'join':
                roomManager.joinRoom(ws, {
                    code: (msg.code || '').toUpperCase().trim(),
                    name: msg.name,
                });
                break;
            case 'start':
                roomManager.startGame(ws);
                break;
            case 'place':
                roomManager.placeCard(ws, {
                    row: msg.row,
                    col: msg.col,
                    cardId: msg.cardId,
                    dbfId: msg.dbfId,
                });
                break;
            case 'kick':
                roomManager.kickPlayer(ws, { playerId: msg.playerId });
                break;
        }
    });

    ws.on('close', () => {
        roomManager.handleDisconnect(ws);
    });

    ws.on('error', () => {
        roomManager.handleDisconnect(ws);
    });
});

async function start() {
    console.log('[server] Fetching card data...');
    await fetchCards();
    console.log('[server] Cards loaded.');

    server.listen(PORT, () => {
        console.log(`[server] WebSocket server listening on port ${PORT}`);
    });
}

start().catch(err => {
    console.error('[server] Fatal:', err);
    process.exit(1);
});
