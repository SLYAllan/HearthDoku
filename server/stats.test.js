// Tuiles de la fiche du Dashboard, lues sur /health (plan 2026-10-17-tuiles-des-projets du dépôt serveur). node --test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { RoomManager } = require('./room-manager');

const HEURE = 60 * 60 * 1000;

// Une salle remplie à la main : createRoom charge les cartes, inutile ici.
function salle(rm, code, nbJoueurs) {
    const players = new Map();
    let hote = null;
    for (let i = 0; i < nbJoueurs; i++) {
        const ws = { readyState: 3 };
        const id = `${code}_${i}`;
        players.set(id, { id, ws });
        rm.playerToRoom.set(ws, { code, playerId: id });
        if (i === 0) hote = ws;
    }
    rm.rooms.set(code, { code, hostId: `${code}_0`, startedAt: null, players });
    return hote;
}

const parTitre = (stats) => Object.fromEntries(stats.tuiles.map((t) => [t.titre, t]));

test('deux salles, trois joueurs, deux parties lancées', (t) => {
    const rm = new RoomManager();
    t.after(() => rm.destroy());
    const a = salle(rm, 'AAAA', 2);
    const b = salle(rm, 'BBBB', 1);

    let stats = rm.getStats();
    assert.equal(stats.rooms, 2);
    assert.equal(stats.players, 3);
    let tuiles = parTitre(stats);
    assert.equal(tuiles['Joueurs connectés'].valeur, '3');
    assert.equal(tuiles['Joueurs connectés'].detail, 'dans 2 salles');
    assert.equal(tuiles['Parties du jour'].valeur, '0');

    rm.startGame(a);
    rm.startGame(a); // déjà lancée : refusée, pas comptée
    rm.startGame(b);
    tuiles = parTitre(rm.getStats());
    assert.equal(tuiles['Parties du jour'].valeur, '2');

    // Le lendemain (36 h couvrent un jour de 25 h), le compte affiché retombe à zéro.
    assert.equal(parTitre(rm.getStats(Date.now() + 36 * HEURE))['Parties du jour'].valeur, '0');
});

test('le compteur repart de un au changement de jour', (t) => {
    const rm = new RoomManager();
    t.after(() => rm.destroy());
    rm.partiesDuJour = { jour: '2000-01-01', nombre: 5 };
    rm.startGame(salle(rm, 'CCCC', 1));
    assert.equal(parTitre(rm.getStats())['Parties du jour'].valeur, '1');
});

test('« depuis HH:MM » seulement si le serveur a démarré le jour même, heure de Paris', (t) => {
    const rm = new RoomManager();
    t.after(() => rm.destroy());
    rm.demarre = Date.parse('2026-10-17T06:05:00Z'); // 8 h 05 à Paris (heure d'été)
    rm.partiesDuJour = { jour: '2026-10-17', nombre: 4 };
    let p = parTitre(rm.getStats(Date.parse('2026-10-17T20:00:00Z')))['Parties du jour'];
    assert.equal(p.valeur, '4');
    assert.equal(p.detail, 'depuis 08:05');
    p = parTitre(rm.getStats(Date.parse('2026-10-18T09:00:00Z')))['Parties du jour'];
    assert.equal(p.valeur, '0');
    assert.equal(p.detail, undefined);
});

test('les tuiles tiennent dans le contrat du Dashboard', (t) => {
    const rm = new RoomManager();
    t.after(() => rm.destroy());
    salle(rm, 'DDDD', 1);
    const { tuiles } = rm.getStats();
    assert.ok(tuiles.length >= 1 && tuiles.length <= 8);
    for (const x of tuiles) {
        assert.deepEqual(Object.keys(x).filter((k) => !['titre', 'valeur', 'detail'].includes(k)), []);
        assert.ok(x.titre.length >= 1 && x.titre.length <= 40);
        assert.ok(x.valeur.length >= 1 && x.valeur.length <= 40);
        assert.ok(x.detail === undefined || x.detail.length <= 160);
    }
    assert.equal(parTitre(rm.getStats())['Joueurs connectés'].detail, 'dans 1 salle');
});
