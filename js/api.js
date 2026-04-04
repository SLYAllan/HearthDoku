/**
 * HearthDoku — API fetch & cache for HearthstoneJSON
 */
const HearthstoneAPI = (() => {
    const API_URL_FR = 'https://api.hearthstonejson.com/v1/latest/frFR/cards.json';
    const API_URL_EN = 'https://api.hearthstonejson.com/v1/latest/enUS/cards.json';
    const CACHE_KEY = 'hearthdoku_cards_cache';
    const CACHE_VERSION_KEY = 'hearthdoku_cache_version';
    const CACHE_VERSION = '2';

    let allCards = [];
    let collectibleCards = [];
    let setNames = {};

    function getCachedData() {
        try {
            const version = localStorage.getItem(CACHE_VERSION_KEY);
            if (version !== CACHE_VERSION) return null;
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    function setCachedData(data) {
        try {
            localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        } catch {
            // localStorage full or unavailable
        }
    }

    async function fetchCards() {
        const cached = getCachedData();
        if (cached) {
            allCards = cached;
            processCards();
            return collectibleCards;
        }

        try {
            const resp = await fetch(API_URL_FR);
            if (!resp.ok) throw new Error('FR fetch failed');
            allCards = await resp.json();
        } catch {
            const resp = await fetch(API_URL_EN);
            if (!resp.ok) throw new Error('Failed to fetch card data');
            allCards = await resp.json();
        }

        setCachedData(allCards);
        processCards();
        return collectibleCards;
    }

    function processCards() {
        collectibleCards = allCards.filter(c => c.collectible === true);

        // Build set name mapping
        setNames = {};
        collectibleCards.forEach(c => {
            if (c.set && !setNames[c.set]) {
                setNames[c.set] = c.set;
            }
        });
    }

    // Standard sets (approximate for 2025-2026 rotation)
    const STANDARD_SETS = [
        'CORE',
        'PATH_OF_ARTHAS',
        'BATTLE_OF_THE_BANDS',
        'TITANS',
        'WILD_WEST',
        'WHIZBANGS_WORKSHOP',
        'ISLAND_VACATION',
        'GREAT_DARK_BEYOND',
        'EMERALD_DREAM',
        'SPACE',
    ];

    const CLASSIC_SETS = ['EXPERT1', 'CORE'];

    // Map set codes to French display names
    const SET_DISPLAY_NAMES = {
        'CORE': 'Ensemble de base',
        'EXPERT1': 'Classique',
        'NAXX': 'Naxxramas',
        'GVG': 'Gobelins et Gnomes',
        'BRM': 'Mont Rochenoire',
        'TGT': 'Le Grand Tournoi',
        'LOE': 'La Ligue des Explorateurs',
        'OG': 'Les Murmures des Dieux Anciens',
        'KARA': 'One Night in Karazhan',
        'GANGS': 'Main basse sur Gadgetzan',
        'UNGORO': "Voyage au centre d'Un'Goro",
        'ICECROWN': 'Chevaliers du Trône de Glace',
        'LOOTAPALOOZA': 'Kobolds et Catacombes',
        'GILNEAS': 'Bois-Maudit',
        'BOOMSDAY': 'Le Projet Armageboum',
        'TROLL': "Jeux de Rastakhan",
        'DALARAN': "L'Envol des Ombres",
        'ULDUM': 'Les Aventuriers d\'Uldum',
        'DRAGONS': "L'Envol des Dragons",
        'YEAR_OF_THE_DRAGON': 'Année du Dragon',
        'BLACK_TEMPLE': "L'Académie Scholomance",
        'SCHOLOMANCE': "L'Académie Scholomance",
        'DARKMOON_FAIRE': 'Foire de Sombrelune',
        'THE_BARRENS': 'Forgés dans les Tarides',
        'STORMWIND': 'Unis à Hurlevent',
        'ALTERAC_VALLEY': 'Fractured in Alterac Valley',
        'THE_SUNKEN_CITY': 'Voyage au Cœur du Maelström',
        'REVENDRETH': 'Meurtre au Château Nathria',
        'RETURN_OF_THE_LICH_KING': 'Le Retour du Roi-Liche',
        'PATH_OF_ARTHAS': 'La Voie d\'Arthas',
        'BATTLE_OF_THE_BANDS': 'Festival de Légendes',
        'TITANS': 'TITANS',
        'WILD_WEST': 'Tonnerre à Badlands',
        'WHIZBANGS_WORKSHOP': "L'Atelier du Bricoleur",
        'ISLAND_VACATION': 'Vacances Insulaires',
        'GREAT_DARK_BEYOND': 'Au-delà de la Grande Ténèbre',
        'EMERALD_DREAM': 'Rêve d\'Émeraude',
        'SPACE': 'Espace',
        'LEGACY': 'Héritage',
        'VANILLA': 'Classique',
        'BASIC': 'Basique',
        'DEMON_HUNTER_INITIATE': 'Initiation du Chasseur de démons',
        'WONDERS': 'Sentiers des merveilles',
        'PLACEHOLDER_202404': 'Extension 2024',
    };

    // Map English keyword mechanics to their field representation
    const KEYWORD_FIELD_MAP = {
        'TAUNT': 'Provocation',
        'DIVINE_SHIELD': 'Bouclier divin',
        'BATTLECRY': 'Cri de guerre',
        'DEATHRATTLE': 'Râle d\'agonie',
        'RUSH': 'Ruée',
        'CHARGE': 'Charge',
        'LIFESTEAL': 'Vol de vie',
        'WINDFURY': 'Furie des vents',
        'POISONOUS': 'Toxicité',
        'STEALTH': 'Camouflage',
        'SPELL_DAMAGE': 'Dégâts des sorts',
        'DISCOVER': 'Découverte',
        'MAGNETIC': 'Magnétisme',
        'REBORN': 'Renaissance',
        'OUTCAST': 'Paria',
        'TRADEABLE': 'Échangeable',
        'FREEZE': 'Gel',
        'SILENCE': 'Silence',
        'CHOOSE_ONE': 'Choix des armes',
        'COMBO': 'Combo',
        'OVERLOAD': 'Surcharge',
        'SECRET': 'Secret',
    };

    // Card type mapping
    const TYPE_MAP = {
        'MINION': 'Serviteur',
        'SPELL': 'Sort',
        'WEAPON': 'Arme',
        'HERO': 'Héros',
        'LOCATION': 'Lieu',
    };

    // Race mapping
    const RACE_MAP = {
        'BEAST': 'Bête',
        'DRAGON': 'Dragon',
        'MURLOC': 'Murloc',
        'DEMON': 'Démon',
        'MECHANICAL': 'Méca',
        'PIRATE': 'Pirate',
        'ELEMENTAL': 'Élémentaire',
        'TOTEM': 'Totem',
        'UNDEAD': 'Mort-vivant',
        'NAGA': 'Naga',
        'ALL': 'Tout',
    };

    // Class mapping
    const CLASS_MAP = {
        'MAGE': 'Mage',
        'WARRIOR': 'Guerrier',
        'PALADIN': 'Paladin',
        'HUNTER': 'Chasseur',
        'ROGUE': 'Voleur',
        'PRIEST': 'Prêtre',
        'SHAMAN': 'Chaman',
        'WARLOCK': 'Démoniste',
        'DRUID': 'Druide',
        'DEATHKNIGHT': 'Chevalier de la mort',
        'DEMONHUNTER': 'Chasseur de démons',
        'NEUTRAL': 'Neutre',
    };

    // Rarity mapping
    const RARITY_MAP = {
        'FREE': 'Basique',
        'COMMON': 'Commune',
        'RARE': 'Rare',
        'EPIC': 'Épique',
        'LEGENDARY': 'Légendaire',
    };

    function getSetDisplayName(setCode) {
        return SET_DISPLAY_NAMES[setCode] || setCode;
    }

    function getCollectibleCards() {
        return collectibleCards;
    }

    function getCardsByFilter(filterFn) {
        return collectibleCards.filter(filterFn);
    }

    function getAllSets() {
        const sets = new Set();
        collectibleCards.forEach(c => {
            if (c.set) sets.add(c.set);
        });
        return Array.from(sets).sort();
    }

    function cardHasKeyword(card, keyword) {
        // Check mechanics array
        if (card.mechanics && card.mechanics.includes(keyword)) return true;
        // For DISCOVER, FREEZE, CHOOSE_ONE, COMBO, OVERLOAD, SECRET — also check referencedTags
        if (card.referencedTags && card.referencedTags.includes(keyword)) return true;
        // Special: SECRET is also indicated by card.secret === true
        if (keyword === 'SECRET' && card.secret === true) return true;
        // OVERLOAD: check for overload field
        if (keyword === 'OVERLOAD' && card.overload && card.overload > 0) return true;
        // SPELL_DAMAGE: check spellDamage field
        if (keyword === 'SPELL_DAMAGE' && card.spellDamage && card.spellDamage > 0) return true;
        return false;
    }

    function cardMatchesCriterion(card, category, value) {
        switch (category) {
            case 'mana': {
                if (value === '10+') return card.cost >= 10;
                return card.cost === parseInt(value);
            }
            case 'health': {
                const hp = card.health ?? card.durability;
                if (hp === undefined || hp === null) return false;
                if (value === '12+') return hp >= 12;
                return hp === parseInt(value);
            }
            case 'attack': {
                if (card.attack === undefined || card.attack === null) return false;
                if (value === '12+') return card.attack >= 12;
                return card.attack === parseInt(value);
            }
            case 'keyword': {
                return cardHasKeyword(card, value);
            }
            case 'type': {
                return card.type === value;
            }
            case 'race': {
                if (value === 'ALL') {
                    return card.race === 'ALL' || card.races?.includes('ALL');
                }
                return card.race === value || card.races?.includes(value) ||
                       card.race === 'ALL' || card.races?.includes('ALL');
            }
            case 'class': {
                if (value === 'NEUTRAL') {
                    return card.cardClass === 'NEUTRAL' || (!card.cardClass && !card.classes);
                }
                return card.cardClass === value || card.classes?.includes(value);
            }
            case 'set': {
                return card.set === value;
            }
            case 'rarity': {
                return card.rarity === value;
            }
            default:
                return false;
        }
    }

    return {
        fetchCards,
        getCollectibleCards,
        getCardsByFilter,
        getAllSets,
        cardMatchesCriterion,
        cardHasKeyword,
        getSetDisplayName,
        STANDARD_SETS,
        CLASSIC_SETS,
        KEYWORD_FIELD_MAP,
        TYPE_MAP,
        RACE_MAP,
        CLASS_MAP,
        RARITY_MAP,
        SET_DISPLAY_NAMES,
    };
})();
