// Erreurs du serveur WS vers le Dashboard (plan 2026-10-17 du dépôt serveur). node --test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { creerEnvoi } = require('./erreurs');

const URL_ESSAI = 'http://dashboard.invalid/api/erreurs/hearthdoku';
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

test('la même erreur trois fois fait un groupe, avec sa pile', () => {
    const envoi = creerEnvoi({ url: URL_ESSAI, jeton: 'j', envoyer: async () => {} });
    for (let i = 0; i < 3; i++) envoi.signaler(new Error('x'), 'ws');
    const lot = envoi.vider();
    assert.equal(lot.length, 1);
    assert.equal(lot[0].type, 'Error');
    assert.equal(lot[0].message, 'x');
    assert.equal(lot[0].nombre, 3);
    assert.match(lot[0].pile, /^ws\n/);
    assert.match(lot[0].pile, /erreurs\.test\.js/);
    assert.deepEqual(envoi.vider(), []);
    envoi.arreter();
});

test("au-delà de 49 sortes, le reste est compté à part (le Dashboard refuse plus de 50)", () => {
    const envoi = creerEnvoi({ url: URL_ESSAI, jeton: 'j', envoyer: async () => {} });
    for (let i = 0; i < 60; i++) envoi.signaler(new Error(`Erreur ${i}`), 'ws');
    const lot = envoi.vider();
    assert.equal(lot.length, 50);
    assert.equal(lot[49].type, 'erreurs non envoyées');
    assert.equal(lot[49].nombre, 11);
    envoi.arreter();
});

test("une valeur jetée qui n'est pas une Error devient un message", () => {
    const envoi = creerEnvoi({ url: URL_ESSAI, jeton: 'j', envoyer: async () => {} });
    envoi.signaler('boum', 'unhandledRejection');
    assert.deepEqual(envoi.vider(), [{ type: 'unhandledRejection', message: 'boum', pile: '', nombre: 1 }]);
    envoi.arreter();
});

test('le lot part avec le jeton, une fois par période', async () => {
    const recus = [];
    const envoi = creerEnvoi({ url: URL_ESSAI, jeton: 'secret', periode: 10, envoyer: async (...a) => void recus.push(a) });
    envoi.signaler(new Error('x'), 'ws');
    await attendre(40);
    envoi.arreter();
    assert.equal(recus.length, 1);
    assert.equal(recus[0][0], URL_ESSAI);
    assert.equal(recus[0][1], 'secret');
    assert.equal(recus[0][2][0].message, 'x');
});

test("un envoi qui échoue ne lève rien et le dit sur la sortie d'avertissement", async (t) => {
    const avertir = t.mock.method(console, 'warn', () => {});
    const envoi = creerEnvoi({ url: URL_ESSAI, jeton: 'j', periode: 10, envoyer: async () => { throw new Error('Dashboard injoignable'); } });
    envoi.signaler(new Error('x'), 'ws');
    await attendre(40);
    envoi.arreter();
    assert.ok(avertir.mock.calls.some((c) => String(c.arguments.join(' ')).includes('Erreurs non envoyées')));
});

test('sans adresse ni jeton : rien gardé, un avertissement au départ', (t) => {
    const avertir = t.mock.method(console, 'warn', () => {});
    const envoi = creerEnvoi({ url: '', jeton: '' });
    envoi.signaler(new Error('x'), 'ws');
    assert.deepEqual(envoi.vider(), []);
    assert.equal(avertir.mock.callCount(), 1);
    envoi.arreter();
});

// Relecture : écouter unhandledRejection empêche Node 24 de s'arrêter. Le serveur s'arrête
// comme avant (Docker le relance), après l'envoi de l'erreur.
const { spawnSync } = require('node:child_process');
// Le fils envoie ses erreurs à un faux Dashboard qui écrit « ENVOI <origine> » : on sait ainsi
// que l'erreur est partie avant l'arrêt, et que l'arrêt a eu lieu.
const lancer = (code) => spawnSync(process.execPath, ['-e', `
    const { creerEnvoi, arreterSurErreur } = require(${JSON.stringify(require.resolve('./erreurs'))});
    const envoi = creerEnvoi({ url: 'u', jeton: 'j', envoyer: async (_u, _j, lot) => console.log('ENVOI ' + lot[0].pile.split(String.fromCharCode(10))[0]) });
    arreterSurErreur(envoi);
    ${code}`], { encoding: 'utf8' });

test("une promesse rejetée non gérée part au Dashboard, puis arrête le processus (code 1)", () => {
    const r = lancer("Promise.reject(new Error('x')); setTimeout(() => {}, 2000);");
    assert.match(r.stdout, /ENVOI unhandledRejection/);
    assert.equal(r.status, 1);
});

test("une exception non attrapée part au Dashboard, puis arrête le processus (code 1)", () => {
    const r = lancer("setTimeout(() => { throw new Error('y'); }, 0); setTimeout(() => {}, 2000);");
    assert.match(r.stdout, /ENVOI uncaughtException/);
    assert.equal(r.status, 1);
});
