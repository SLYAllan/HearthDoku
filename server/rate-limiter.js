const MIN_INTERVAL_MS = 1000;

class RateLimiter {
    constructor() {
        this.timestamps = new Map();
    }

    check(playerId) {
        const now = Date.now();
        const last = this.timestamps.get(playerId) || 0;
        if (now - last < MIN_INTERVAL_MS) return false;
        this.timestamps.set(playerId, now);
        return true;
    }

    remove(playerId) {
        this.timestamps.delete(playerId);
    }

    clear() {
        this.timestamps.clear();
    }
}

module.exports = { RateLimiter };
