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
    }
    updateSetupText();

    document.querySelectorAll('input[name="roomMode"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.querySelectorAll('.room-mode-option').forEach(opt => {
                opt.classList.toggle('room-mode-option--selected', opt.querySelector('input').checked);
            });
        });
    });

    HearthstoneAPI.fetchCards().then(() => {
        console.log('[room] Cards loaded for display');
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

    document.getElementById('btnCreateRoom').addEventListener('click', () => {
        const name = document.getElementById('playerName').value.trim();
        const modeEl = document.querySelector('input[name="roomMode"]:checked');
        const mode = modeEl ? modeEl.value : 'coop';

        if (name) RoomClient.setStoredName(name);
        document.getElementById('btnCreateRoom').disabled = true;
        showSetupStatus(I18n.t('connecting'), false);
        RoomClient.createRoom(mode, name || null, null);
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
        history.replaceState(null, '', '/room/' + msg.code);
    });

    document.getElementById('btnGameOverClose').addEventListener('click', () => {
        RoomUI.closeGameOverModal();
    });
})();
