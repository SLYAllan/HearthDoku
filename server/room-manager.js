const crypto = require('crypto');
const { generatePuzzle, calculateScore, validatePlacement } = require('./puzzle-server');
const { getCards } = require('./card-fetcher');
const { RateLimiter } = require('./rate-limiter');

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_PLAYERS = 8;
const MAX_ERRORS = 3;
const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const CLEANUP_INTERVAL_MS = 60 * 1000;

const PLAYER_COLORS = [
    '#22c55e', '#3bd3fd', '#f8cc65', '#fc7981',
    '#a78bfa', '#60a5fa', '#f97316', '#e040a0',
];

class RoomManager {
    constructor() {
        this.rooms = new Map();
        this.playerToRoom = new Map();
        this.rateLimiter = new RateLimiter();
        this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
    }

    generateCode() {
        for (let i = 0; i < 100; i++) {
            const bytes = crypto.randomBytes(6);
            let code = '';
            for (let j = 0; j < 6; j++) {
                code += CHARS[bytes[j] % CHARS.length];
            }
            if (!this.rooms.has(code)) return code;
        }
        throw new Error('Failed to generate unique room code');
    }

    generatePlayerId() {
        return 'p_' + crypto.randomBytes(4).toString('hex');
    }

    generatePlayerName() {
        const num = Math.floor(1000 + Math.random() * 9000);
        return `Player#${num}`;
    }

    sanitizeName(name) {
        if (!name || typeof name !== 'string') return null;
        return name.replace(/[<>"]/g, '').trim().slice(0, 20) || null;
    }

    createRoom(ws, { mode, name: rawName, config }) {
        const name = this.sanitizeName(rawName);
        if (mode !== 'coop' && mode !== 'versus') {
            this.sendTo(ws, { type: 'error', message: 'Invalid mode' });
            return;
        }

        const cards = getCards();
        if (!cards) {
            this.sendTo(ws, { type: 'error', message: 'Cards not loaded yet' });
            return;
        }

        const puzzle = generatePuzzle(cards, config || null);
        if (!puzzle) {
            this.sendTo(ws, { type: 'error', message: 'Failed to generate puzzle with these filters' });
            return;
        }

        const code = this.generateCode();
        const playerId = this.generatePlayerId();
        const playerName = name || this.generatePlayerName();
        const now = Date.now();

        const room = {
            code,
            mode,
            hostId: playerId,
            createdAt: now,
            expiresAt: now + ROOM_TTL_MS,
            startedAt: null,
            config: config || null,
            puzzle: {
                rowCriteria: puzzle.rowCriteria,
                colCriteria: puzzle.colCriteria,
                cellCards: puzzle.cellCards,
            },
            grid: Array(9).fill(null),
            players: new Map(),
            finished: false,
            bannedIPs: new Set(),
            coopErrors: 0,
            surrenderVotes: new Set(),
        };

        const player = {
            id: playerId,
            name: playerName,
            color: PLAYER_COLORS[0],
            score: 0,
            errors: 0,
            grid: Array(9).fill(null),
            finishedAt: null,
            eliminated: false,
            ws,
        };

        room.players.set(playerId, player);
        this.rooms.set(code, room);
        this.playerToRoom.set(ws, { code, playerId });

        this.sendTo(ws, { type: 'room_created', code });
        this.sendRoomState(ws, room, playerId);
    }

    joinRoom(ws, { code, name: rawName }) {
        const name = this.sanitizeName(rawName);
        if (!code || typeof code !== 'string' || !/^[A-Z0-9]{4,8}$/.test(code)) {
            this.sendTo(ws, { type: 'error', message: 'Invalid room code' });
            return;
        }
        const room = this.rooms.get(code);
        if (!room) {
            this.sendTo(ws, { type: 'error', message: 'Room not found' });
            return;
        }
        if (room.finished) {
            this.sendTo(ws, { type: 'error', message: 'Game already finished' });
            return;
        }
        if (room.players.size >= MAX_PLAYERS) {
            this.sendTo(ws, { type: 'error', message: 'Room is full (max 8 players)' });
            return;
        }

        const ip = ws._socket.remoteAddress;
        if (room.bannedIPs.has(ip)) {
            this.sendTo(ws, { type: 'error', message: 'Banned from this room' });
            return;
        }

        const playerId = this.generatePlayerId();
        const playerName = name || this.generatePlayerName();
        const colorIndex = room.players.size % PLAYER_COLORS.length;

        const player = {
            id: playerId,
            name: playerName,
            color: PLAYER_COLORS[colorIndex],
            score: 0,
            errors: 0,
            grid: Array(9).fill(null),
            finishedAt: null,
            eliminated: false,
            ws,
        };

        room.players.set(playerId, player);
        this.playerToRoom.set(ws, { code, playerId });

        this.sendRoomState(ws, room, playerId);
        this.broadcast(room, {
            type: 'player_joined',
            player: this.serializePlayer(player),
        }, playerId);
    }

    startGame(ws) {
        const info = this.playerToRoom.get(ws);
        if (!info) return;

        const room = this.rooms.get(info.code);
        if (!room) return;
        if (info.playerId !== room.hostId) {
            this.sendTo(ws, { type: 'error', message: 'Only host can start' });
            return;
        }
        if (room.startedAt) {
            this.sendTo(ws, { type: 'error', message: 'Game already started' });
            return;
        }

        room.startedAt = Date.now();
        this.broadcast(room, { type: 'game_started', startedAt: room.startedAt });
    }

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

    handleSurrender(ws) {
        const info = this.playerToRoom.get(ws);
        if (!info) return;
        const room = this.rooms.get(info.code);
        if (!room || room.finished) return;
        if (!room.startedAt) return;

        if (room.surrenderVotes.has(info.playerId)) {
            room.surrenderVotes.delete(info.playerId);
        } else {
            room.surrenderVotes.add(info.playerId);
        }

        const total = room.players.size;
        const needed = total <= 2 ? total : Math.ceil(total * 0.75);

        this.broadcast(room, {
            type: 'surrender_vote',
            playerId: info.playerId,
            votes: room.surrenderVotes.size,
            needed,
            total,
        });

        if (room.surrenderVotes.size >= needed) {
            this.endGame(room, 'surrender');
        }
    }

    placeCard(ws, { row, col, cardId, dbfId }) {
        const info = this.playerToRoom.get(ws);
        if (!info) return;

        const room = this.rooms.get(info.code);
        if (!room || room.finished) return;

        const player = room.players.get(info.playerId);
        if (!player) return;

        if (row < 0 || row > 2 || col < 0 || col > 2) return;
        const cellIndex = row * 3 + col;

        if (!room.startedAt) {
            this.sendTo(ws, { type: 'cell_rejected', row, col, reason: 'game_not_started' });
            return;
        }
        if (player.eliminated) {
            this.sendTo(ws, { type: 'cell_rejected', row, col, reason: 'eliminated' });
            return;
        }
        if (!this.rateLimiter.check(info.playerId)) {
            this.sendTo(ws, { type: 'cell_rejected', row, col, reason: 'rate_limited' });
            return;
        }

        if (room.mode === 'coop') {
            this.placeCardCoop(room, player, cellIndex, row, col, dbfId, cardId);
        } else {
            this.placeCardVersus(room, player, cellIndex, row, col, dbfId, cardId);
        }
    }

    placeCardCoop(room, player, cellIndex, row, col, dbfId, cardId) {
        if (room.grid[cellIndex]) {
            this.sendTo(player.ws, { type: 'cell_rejected', row, col, reason: 'already_filled' });
            return;
        }

        const card = validatePlacement(room.puzzle.cellCards, cellIndex, dbfId);
        if (card) {
            const score = calculateScore(card, room.puzzle.cellCards[cellIndex]);
            player.score += score;
            room.grid[cellIndex] = {
                playerId: player.id,
                cardId: card.id,
                cardName: card.name,
                dbfId: card.dbfId,
            };

            this.broadcast(room, {
                type: 'cell_filled',
                row, col,
                playerId: player.id,
                cardId: card.id,
                cardName: card.name,
                dbfId: card.dbfId,
                score,
            });

            if (room.grid.every(c => c !== null)) {
                this.endGame(room);
            }
        } else {
            player.errors++;
            const allCards = getCards();
            const wrongCard = allCards.find(c => c.dbfId === dbfId);
            this.broadcast(room, {
                type: 'cell_error',
                row, col,
                playerId: player.id,
                cardName: wrongCard ? wrongCard.name : cardId,
                dbfId,
                playerErrors: player.errors,
            });
            if (player.errors >= MAX_ERRORS) {
                const allEliminated = [...room.players.values()].every(p => p.errors >= MAX_ERRORS);
                if (allEliminated) {
                    this.endGame(room, 'errors');
                }
            }
        }
    }

    placeCardVersus(room, player, cellIndex, row, col, dbfId, cardId) {
        if (player.grid[cellIndex]) {
            this.sendTo(player.ws, { type: 'cell_rejected', row, col, reason: 'already_filled' });
            return;
        }

        const card = validatePlacement(room.puzzle.cellCards, cellIndex, dbfId);
        if (card) {
            const score = calculateScore(card, room.puzzle.cellCards[cellIndex]);
            player.score += score;
            player.grid[cellIndex] = {
                cardId: card.id,
                cardName: card.name,
                dbfId: card.dbfId,
            };

            this.sendTo(player.ws, {
                type: 'cell_filled',
                row, col,
                playerId: player.id,
                cardId: card.id,
                cardName: card.name,
                dbfId: card.dbfId,
                score,
            });

            const filled = player.grid.filter(c => c !== null).length;
            this.broadcast(room, {
                type: 'player_progress',
                playerId: player.id,
                filled,
                total: 9,
            });

            if (filled === 9) {
                player.finishedAt = Date.now();
                const finishedPlayers = [...room.players.values()].filter(p => p.finishedAt);
                const rank = finishedPlayers.length;
                const time = player.finishedAt - room.startedAt;

                this.broadcast(room, {
                    type: 'player_finished',
                    playerId: player.id,
                    name: player.name,
                    time,
                    score: player.score,
                    rank,
                });

                this.checkVersusEnd(room);
            }
        } else {
            player.errors++;
            const allCards = getCards();
            const wrongCard = allCards.find(c => c.dbfId === dbfId);
            this.sendTo(player.ws, {
                type: 'cell_error',
                row, col,
                playerId: player.id,
                cardName: wrongCard ? wrongCard.name : cardId,
                dbfId,
                playerErrors: player.errors,
            });

            if (player.errors >= MAX_ERRORS) {
                player.eliminated = true;
                this.broadcast(room, {
                    type: 'player_eliminated',
                    playerId: player.id,
                    name: player.name,
                });
                this.checkVersusEnd(room);
            }
        }
    }

    checkVersusEnd(room) {
        const active = [...room.players.values()].filter(p => !p.finishedAt && !p.eliminated);
        if (active.length === 0) {
            this.endGame(room);
        }
    }

    endGame(room, reason = 'completed') {
        room.finished = true;
        const elapsed = room.startedAt ? Date.now() - room.startedAt : null;

        const scores = [...room.players.values()]
            .map(p => ({
                playerId: p.id,
                name: p.name,
                score: p.score,
                errors: p.errors,
                filled: (room.mode === 'coop' ? room.grid : p.grid).filter(c => c !== null).length,
                finishedAt: p.finishedAt,
                eliminated: p.eliminated,
                time: p.finishedAt && room.startedAt ? p.finishedAt - room.startedAt : null,
            }))
            .sort((a, b) => {
                if (a.eliminated && !b.eliminated) return 1;
                if (!a.eliminated && b.eliminated) return -1;
                if (b.filled !== a.filled) return b.filled - a.filled;
                if (a.time && b.time) return a.time - b.time;
                return b.score - a.score;
            });

        const solutions = room.puzzle.cellCards.map(cellCards => {
            const best = cellCards[0];
            return best ? { cardId: best.id, cardName: best.name, dbfId: best.dbfId } : null;
        });

        this.broadcast(room, {
            type: 'game_over',
            scores,
            reason,
            time: elapsed,
            totalErrors: room.mode === 'coop'
                ? [...room.players.values()].reduce((sum, p) => sum + p.errors, 0)
                : null,
            mode: room.mode,
            solutions,
        });
    }

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

    sendRoomState(ws, room, playerId) {
        const players = [];
        for (const p of room.players.values()) {
            players.push(this.serializePlayer(p));
        }

        const puzzleForClient = {
            rowCriteria: room.puzzle.rowCriteria,
            colCriteria: room.puzzle.colCriteria,
        };

        const state = {
            type: 'room_state',
            mode: room.mode,
            config: room.config,
            puzzle: puzzleForClient,
            grid: room.mode === 'coop' ? room.grid : null,
            players,
            you: playerId,
            started: !!room.startedAt,
            startedAt: room.startedAt,
            hostId: room.hostId,
        };

        this.sendTo(ws, state);
    }

    serializePlayer(p) {
        return {
            id: p.id,
            name: p.name,
            color: p.color,
            score: p.score,
            errors: p.errors,
            filled: p.grid.filter(c => c !== null).length,
            finishedAt: p.finishedAt,
            eliminated: p.eliminated,
        };
    }

    broadcast(room, msg, excludePlayerId) {
        for (const p of room.players.values()) {
            if (excludePlayerId && p.id === excludePlayerId) continue;
            this.sendTo(p.ws, msg);
        }
    }

    sendTo(ws, msg) {
        if (ws.readyState === 1) {
            ws.send(JSON.stringify(msg));
        }
    }

    cleanup() {
        const now = Date.now();
        for (const [code, room] of this.rooms.entries()) {
            if (now > room.expiresAt) {
                for (const p of room.players.values()) {
                    this.sendTo(p.ws, { type: 'error', message: 'Room expired' });
                    this.playerToRoom.delete(p.ws);
                }
                this.rooms.delete(code);
            }
        }
    }

    getStats() {
        return {
            rooms: this.rooms.size,
            players: this.playerToRoom.size,
        };
    }

    destroy() {
        clearInterval(this.cleanupTimer);
    }
}

module.exports = { RoomManager };
