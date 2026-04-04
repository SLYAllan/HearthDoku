/**
 * HearthDoku — PNG export & clipboard sharing
 */
const ExportManager = (() => {

    async function exportPNG(withSolutions) {
        const container = document.getElementById('puzzleContainer');
        if (!container) return;

        // If with solutions, temporarily show them
        if (withSolutions && UI.currentPuzzle) {
            UI.showSolution();
        }

        try {
            const canvas = await html2canvas(container, {
                backgroundColor: '#1a1a2e',
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: false,
            });

            const link = document.createElement('a');
            const today = new Date().toISOString().slice(0, 10);
            const suffix = withSolutions ? '-solutions' : '-vide';
            link.download = `hearthdoku-${today}${suffix}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('Export failed:', err);
            alert('Erreur lors de l\'export. Veuillez réessayer.');
        }
    }

    async function shareToClipboard() {
        const text = UI.getShareText();
        try {
            await navigator.clipboard.writeText(text);
            showCopyToast();
        } catch {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showCopyToast();
        }
    }

    function showCopyToast() {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = '📋 Copié dans le presse-papier !';
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('toast--visible'));
        setTimeout(() => {
            toast.classList.remove('toast--visible');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    return {
        exportPNG,
        shareToClipboard,
    };
})();
