const http = require('http');
const { WebSocketServer } = require('ws');
const { fetchCards } = require('./card-fetcher');
const { RoomManager } = require('./room-manager');
const { creerEnvoi } = require('./erreurs');

// Erreurs vers le Dashboard du serveur maison (jeton du projet, créé sur sa fiche).
const erreurs = creerEnvoi({ url: process.env.DASHBOARD_ERREURS_URL, jeton: process.env.DASHBOARD_ERREURS_JETON });

const PORT = parseInt(process.env.PORT || process.env.WS_PORT || '8080', 10);
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

const wss = new WebSocketServer({ server, maxPayload: 8 * 1024 });

const HEARTBEAT_INTERVAL = 30_000;
const heartbeat = setInterval(() => {
    wss.clients.forEach(ws => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, HEARTBEAT_INTERVAL);

wss.on('close', () => clearInterval(heartbeat));

wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    const origin = (req.headers.origin || '').replace(/\/+$/, '');
    if (CORS_ORIGIN !== '*' && !CORS_ORIGIN.split(',').some(o => origin === o.trim().replace(/\/+$/, ''))) {
        console.log(`[ws] Origin rejected: "${origin}"`);
        ws.close(4003, 'Origin not allowed');
        return;
    }
    console.log(`[ws] Connection from "${origin}"`);

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
            case 'surrender':
                roomManager.handleSurrender(ws);
                break;
        }
    });

    ws.on('close', () => {
        roomManager.handleDisconnect(ws);
    });

    ws.on('error', (err) => {
        console.error('[ws] Client error:', err.message);
        erreurs.signaler(err, 'ws');
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

start().catch(async (err) => {
    console.error('[server] Fatal:', err);
    erreurs.signaler(err, 'demarrage');
    await erreurs.arreter();
    process.exit(1);
});

// Avant, une exception non attrapée arrêtait le serveur sans trace ailleurs que dans Docker :
// elle part au Dashboard, puis le serveur s'arrête comme avant (Docker le relance).
process.on('uncaughtException', async (err) => {
    console.error('[server] Uncaught exception:', err);
    erreurs.signaler(err, 'uncaughtException');
    await erreurs.arreter();
    process.exit(1);
});
process.on('unhandledRejection', (raison) => {
    console.error('[server] Unhandled rejection:', raison);
    erreurs.signaler(raison, 'unhandledRejection');
});

function shutdown() {
    console.log('[server] Shutting down...');
    roomManager.destroy();
    erreurs.arreter();
    wss.clients.forEach(ws => ws.close(1001, 'Server shutting down'));
    wss.close(() => {
        server.close(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 5000);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
