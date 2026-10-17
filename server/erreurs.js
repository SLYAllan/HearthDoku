// Erreurs du serveur WS vers le Dashboard du serveur maison (plan 2026-10-17 du dépôt serveur).
// Gardées en mémoire, regroupées par type et message, envoyées au plus une fois par période à
// POST /api/erreurs/hearthdoku avec le jeton du projet. Un envoi en échec ne lève jamais.

// Le Dashboard refuse un lot de plus de 50 : 49 sortes, plus une pour le reste.
const SORTES_MAX = 49;
const DEBORDEMENT = 'erreurs non envoyées';

async function envoyerFetch(url, jeton, lot) {
    const r = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ erreurs: lot }),
        signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
}

function creerEnvoi({ url, jeton, envoyer = envoyerFetch, periode = 60_000 }) {
    const actif = Boolean(url && jeton);
    if (!actif) console.warn('[erreurs] Non envoyées au Dashboard : DASHBOARD_ERREURS_URL ou DASHBOARD_ERREURS_JETON absente');
    let groupes = new Map();
    let deborde = 0;

    function signaler(e, origine) {
        if (!actif) return;
        const erreur = e instanceof Error
            ? { type: e.name || 'Error', message: String(e.message).slice(0, 1000), pile: `${origine}\n${e.stack ?? ''}`.slice(0, 8000) }
            : { type: origine, message: String(e).slice(0, 1000), pile: '' };
        const cle = `${erreur.type}\n${erreur.message}`;
        const groupe = groupes.get(cle);
        if (groupe) groupe.nombre += 1;
        else if (groupes.size < SORTES_MAX) groupes.set(cle, { ...erreur, nombre: 1 });
        else deborde += 1;
    }

    function vider() {
        const lot = [...groupes.values()];
        if (deborde) lot.push({ type: DEBORDEMENT, message: `${deborde} erreurs de plus dans la période, au-delà de ${SORTES_MAX} sortes`, pile: '', nombre: deborde });
        groupes = new Map();
        deborde = 0;
        return lot;
    }

    async function partir() {
        const lot = vider();
        if (!lot.length) return;
        try {
            await envoyer(url, jeton, lot);
        } catch (e) {
            console.warn('[erreurs] Erreurs non envoyées :', e.message);
        }
    }

    // unref : la minuterie ne garde pas le processus en vie à l'arrêt.
    const minuterie = actif ? setInterval(partir, periode) : null;
    minuterie?.unref();

    // À l'arrêt, ce qui reste part une dernière fois.
    function arreter() {
        if (minuterie) clearInterval(minuterie);
        return partir();
    }

    return { signaler, vider, arreter };
}

// Node 24 arrête le processus sur une exception non attrapée comme sur une promesse rejetée
// non gérée, et Docker relance le serveur. Écouter ces événements supprimerait cet arrêt : on
// le garde, après l'envoi de l'erreur au Dashboard.
function arreterSurErreur(envoi, sortir = (code) => process.exit(code)) {
    for (const evenement of ['uncaughtException', 'unhandledRejection']) {
        process.on(evenement, async (e) => {
            console.error(`[server] ${evenement}:`, e);
            envoi.signaler(e, evenement);
            await envoi.arreter();
            sortir(1);
        });
    }
}

module.exports = { creerEnvoi, arreterSurErreur };
