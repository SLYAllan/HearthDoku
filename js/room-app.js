/**
 * HearthDoku — Room page initialization
 */
(function() {
    const langSelect = document.getElementById('langSelect');
    langSelect.value = I18n.getLang();
    langSelect.addEventListener('change', () => {
        I18n.setLang(langSelect.value);
        location.reload();
    });

    function updateSetupText() {
        document.getElementById('setupTitle').textContent = I18n.t('createRoom');
        document.getElementById('labelPlayerName').textContent = I18n.t('enterName');
        document.getElementById('labelModeSelection').textContent = I18n.t('modeSelection');
        document.getElementById('labelCoop').textContent = I18n.t('cooperative');
        document.getElementById('labelCoopDesc').textContent = I18n.t('coopDesc');
        document.getElementById('labelVersus').textContent = I18n.t('competitive');
        document.getElementById('labelVersusDesc').textContent = I18n.t('versusDesc');
        document.getElementById('btnCreateRoom').textContent = I18n.t('createRoom');
        document.getElementById('labelOrJoin').textContent = I18n.t('orJoinRoom');
        document.getElementById('btnJoinRoom').textContent = I18n.t('joinRoom');
        document.getElementById('linkBackToSolo').textContent = I18n.t('backToSolo');
        document.getElementById('joinCode').placeholder = I18n.t('enterCode');
        document.getElementById('labelAdvancedFilters').textContent = I18n.t('advancedFilters');
        document.getElementById('labelFilterExtensions').textContent = I18n.t('filterExtensions');
        document.getElementById('labelFilterRarities').textContent = I18n.t('filterRarities');
        document.getElementById('labelFilterClasses').textContent = I18n.t('filterClasses');
    }
    updateSetupText();

    document.querySelectorAll('input[name="roomMode"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.querySelectorAll('.room-mode-option').forEach(opt => {
                opt.classList.toggle('room-mode-option--selected', opt.querySelector('input').checked);
            });
        });
    });

    // --- Kicked redirect check ---
    if (sessionStorage.getItem('hearthdoku_kicked')) {
        sessionStorage.removeItem('hearthdoku_kicked');
        const setupStatus = document.getElementById('setupStatus');
        setupStatus.textContent = I18n.t('kicked');
        setupStatus.className = 'room-setup__status room-setup__status--error';
        setupStatus.style.display = 'block';
    }

    // --- Filter panel toggle ---
    const toggleFilters = document.getElementById('toggleFilters');
    const filtersPanel = document.getElementById('filtersPanel');
    toggleFilters.addEventListener('click', () => {
        const open = filtersPanel.style.display !== 'none';
        filtersPanel.style.display = open ? 'none' : 'block';
        toggleFilters.classList.toggle('room-setup__toggle--open', !open);
    });

    function bindFilterImgFallbacks(container) {
        container.querySelectorAll('img').forEach(img => {
            img.addEventListener('error', () => { img.style.display = 'none'; }, { once: true });
        });
    }

    // --- Render filter checkboxes ---
    function renderRoomFilters(sets) {
        const setContainer = document.getElementById('roomSetFilters');
        const rarityContainer = document.getElementById('roomRarityFilters');
        const classContainer = document.getElementById('roomClassFilters');

        // Sets
        setContainer.innerHTML = sets.map(s => {
            const name = HearthstoneAPI.getSetDisplayName(s);
            const iconPath = HearthstoneAPI.getSetIcon(s);
            const iconHtml = iconPath ? `<img src="${iconPath}" alt="">` : '';
            return `<label><input type="checkbox" value="${s}" checked>${iconHtml}<span>${name}</span></label>`;
        }).join('');
        bindFilterImgFallbacks(setContainer);

        // Rarities
        const rarityMap = HearthstoneAPI.getRarityMap();
        const rarityOrder = ['LEGENDARY', 'EPIC', 'RARE', 'COMMON', 'FREE'];
        rarityContainer.innerHTML = rarityOrder.filter(r => rarityMap[r]).map(r => {
            const name = rarityMap[r];
            const iconPath = HearthstoneAPI.getRarityIcon(r);
            const iconHtml = iconPath ? `<img src="${iconPath}" alt="">` : '';
            return `<label><input type="checkbox" value="${r}" checked>${iconHtml}<span>${name}</span></label>`;
        }).join('');
        bindFilterImgFallbacks(rarityContainer);

        // Classes
        const classMap = HearthstoneAPI.getClassMap();
        const classOrder = [
            'DEATHKNIGHT', 'DEMONHUNTER', 'DRUID', 'HUNTER', 'MAGE',
            'PALADIN', 'PRIEST', 'ROGUE', 'SHAMAN', 'WARLOCK',
            'WARRIOR', 'NEUTRAL',
        ];
        classContainer.innerHTML = classOrder.filter(c => classMap[c]).map(cls => {
            const name = classMap[cls];
            const iconPath = HearthstoneAPI.getClassIcon(cls);
            const iconHtml = iconPath ? `<img src="${iconPath}" alt="">` : '';
            return `<label><input type="checkbox" value="${cls}" checked>${iconHtml}<span>${name}</span></label>`;
        }).join('');
        bindFilterImgFallbacks(classContainer);
    }

    function getCheckedValues(containerId) {
        const container = document.getElementById(containerId);
        return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    }

    function setAllCheckedIn(containerId, checked) {
        document.getElementById(containerId).querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = checked;
        });
    }

    function setPresetSets(presetSets) {
        document.getElementById('roomSetFilters').querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = presetSets.includes(cb.value);
        });
    }

    // --- Wire filter buttons ---
    document.getElementById('roomBtnCheckAll').addEventListener('click', () => setAllCheckedIn('roomSetFilters', true));
    document.getElementById('roomBtnUncheckAll').addEventListener('click', () => setAllCheckedIn('roomSetFilters', false));
    document.getElementById('roomBtnCheckAllRarity').addEventListener('click', () => setAllCheckedIn('roomRarityFilters', true));
    document.getElementById('roomBtnUncheckAllRarity').addEventListener('click', () => setAllCheckedIn('roomRarityFilters', false));
    document.getElementById('roomBtnCheckAllClass').addEventListener('click', () => setAllCheckedIn('roomClassFilters', true));
    document.getElementById('roomBtnUncheckAllClass').addEventListener('click', () => setAllCheckedIn('roomClassFilters', false));

    document.querySelectorAll('[data-room-preset]').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.roomPreset;
            switch (preset) {
                case 'standard':
                    setPresetSets(HearthstoneAPI.STANDARD_SETS);
                    break;
                case 'wild':
                    setAllCheckedIn('roomSetFilters', true);
                    break;
                case 'classic':
                    setPresetSets(HearthstoneAPI.CLASSIC_SETS);
                    break;
            }
        });
    });

    // --- Collect config from filters ---
    function collectConfig() {
        const sets = getCheckedValues('roomSetFilters');
        const rarities = getCheckedValues('roomRarityFilters');
        const classes = getCheckedValues('roomClassFilters');

        const allSets = HearthstoneAPI.getAllSets();
        const allRarities = ['LEGENDARY', 'EPIC', 'RARE', 'COMMON', 'FREE'];
        const allClasses = [
            'DEATHKNIGHT', 'DEMONHUNTER', 'DRUID', 'HUNTER', 'MAGE',
            'PALADIN', 'PRIEST', 'ROGUE', 'SHAMAN', 'WARLOCK',
            'WARRIOR', 'NEUTRAL',
        ];

        const isAllSets = sets.length === 0 || sets.length >= allSets.length;
        const isAllRarities = rarities.length === 0 || rarities.length >= allRarities.length;
        const isAllClasses = classes.length === 0 || classes.length >= allClasses.length;

        if (isAllSets && isAllRarities && isAllClasses) return null;

        return {
            sets: isAllSets ? [] : sets,
            rarities: isAllRarities ? [] : rarities,
            classes: isAllClasses ? [] : classes,
        };
    }

    // --- Load cards then render filters ---
    HearthstoneAPI.fetchCards().then(() => {
        console.log('[room] Cards loaded for display');
        const allSets = HearthstoneAPI.getAllSets();
        renderRoomFilters(allSets);
    });

    const params = new URLSearchParams(location.search);
    const codeFromUrl = params.get('code');

    if (codeFromUrl) {
        document.getElementById('joinCode').value = codeFromUrl;
    }

    const savedName = RoomClient.getStoredName();
    if (savedName) {
        document.getElementById('playerName').value = savedName;
    }

    const setupStatus = document.getElementById('setupStatus');
    function showSetupStatus(text, isError) {
        setupStatus.textContent = text;
        setupStatus.className = 'room-setup__status' + (isError ? ' room-setup__status--error' : '');
        setupStatus.style.display = 'block';
    }

    RoomClient.on('status', (msg) => {
        if (msg.status === 'connecting') showSetupStatus(I18n.t('connecting'), false);
        if (msg.status === 'disconnected') showSetupStatus(I18n.t('disconnected'), true);
    });
    RoomClient.on('error', (msg) => {
        showSetupStatus(msg.message, true);
        document.getElementById('btnCreateRoom').disabled = false;
        document.getElementById('btnJoinRoom').disabled = false;
    });
    RoomClient.on('kicked', () => {
        sessionStorage.setItem('hearthdoku_kicked', '1');
        window.location.replace('/room.html');
    });

    document.getElementById('btnCreateRoom').addEventListener('click', () => {
        const name = document.getElementById('playerName').value.trim();
        const modeEl = document.querySelector('input[name="roomMode"]:checked');
        const mode = modeEl ? modeEl.value : 'coop';
        const config = collectConfig();

        if (name) RoomClient.setStoredName(name);
        document.getElementById('btnCreateRoom').disabled = true;
        showSetupStatus(I18n.t('connecting'), false);
        RoomClient.createRoom(mode, name || null, config);
    });

    document.getElementById('btnJoinRoom').addEventListener('click', () => {
        const name = document.getElementById('playerName').value.trim();
        const code = document.getElementById('joinCode').value.trim();
        if (!code) return;

        if (name) RoomClient.setStoredName(name);
        document.getElementById('btnJoinRoom').disabled = true;
        showSetupStatus(I18n.t('connecting'), false);
        RoomClient.joinRoom(code, name || null);
    });

    if (codeFromUrl) {
        const name = document.getElementById('playerName').value.trim();
        if (name) RoomClient.setStoredName(name);
        showSetupStatus(I18n.t('connecting'), false);
        RoomClient.joinRoom(codeFromUrl, name || null);
    }

    RoomUI.init();

    RoomClient.on('room_created', (msg) => {
        history.replaceState(null, '', '/room.html?code=' + msg.code);
    });

    document.getElementById('btnGameOverClose').addEventListener('click', () => {
        RoomUI.closeGameOverModal();
    });
})();
