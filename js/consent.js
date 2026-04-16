/**
 * HearthDoku — RGPD consent manager
 *
 * Google Tag Manager / Analytics is loaded only after explicit user consent.
 * Choice is persisted in localStorage under 'hearthdoku_consent':
 *   'accepted' | 'rejected' | null (undecided — banner is shown)
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'hearthdoku_consent';
    const GTM_ID = 'GTM-TD9R8ZXZ';
    let gtmLoaded = false;

    function loadGTM() {
        if (gtmLoaded) return;
        gtmLoaded = true;
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
        const s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(GTM_ID);
        const first = document.getElementsByTagName('script')[0];
        if (first && first.parentNode) {
            first.parentNode.insertBefore(s, first);
        } else {
            document.head.appendChild(s);
        }
    }

    function showBanner() {
        const banner = document.getElementById('consentBanner');
        if (banner) banner.hidden = false;
    }

    function hideBanner() {
        const banner = document.getElementById('consentBanner');
        if (banner) banner.hidden = true;
    }

    function setChoice(choice) {
        try {
            localStorage.setItem(STORAGE_KEY, choice);
        } catch (e) { /* ignore quota/private-mode errors */ }
    }

    function getChoice() {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch (e) {
            return null;
        }
    }

    function wire() {
        const accept = document.getElementById('consentAccept');
        const reject = document.getElementById('consentReject');
        const reopen = document.getElementById('btnReopenConsent');

        if (accept) {
            accept.addEventListener('click', () => {
                setChoice('accepted');
                hideBanner();
                loadGTM();
            });
        }
        if (reject) {
            reject.addEventListener('click', () => {
                setChoice('rejected');
                hideBanner();
            });
        }
        if (reopen) {
            reopen.addEventListener('click', (e) => {
                e.preventDefault();
                showBanner();
            });
        }

        const choice = getChoice();
        if (choice === 'accepted') {
            loadGTM();
        } else if (choice !== 'rejected') {
            showBanner();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wire);
    } else {
        wire();
    }
})();
