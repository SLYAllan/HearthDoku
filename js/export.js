/**
 * HearthDoku — PNG export & clipboard sharing
 */
const ExportManager = (() => {

    async function exportPNG(withSolutions) {
        const container = document.getElementById('puzzleContainer');
        if (!container) return;

        if (withSolutions && UI.currentPuzzle) {
            UI.showSolution();
        }

        const images = container.querySelectorAll('img');
        await Promise.all(Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
            });
        }));

        try {
            let canvas;
            try {
                canvas = await html2canvas(container, {
                    backgroundColor: '#1a1a2e',
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    imageTimeout: 5000,
                });
            } catch {
                canvas = await html2canvas(container, {
                    backgroundColor: '#1a1a2e',
                    scale: 2,
                    allowTaint: true,
                    logging: false,
                    imageTimeout: 5000,
                });
            }

            const link = document.createElement('a');
            const today = new Date().toISOString().slice(0, 10);
            const suffix = withSolutions ? '-solutions' : '-empty';
            link.download = `hearthdoku-${today}${suffix}.png`;

            try {
                link.href = canvas.toDataURL('image/png');
                link.click();
            } catch {
                canvas.toBlob(blob => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank');
                        setTimeout(() => URL.revokeObjectURL(url), 10000);
                    } else {
                        alert(I18n.t('errorExportBlocked'));
                    }
                });
            }
        } catch (err) {
            console.error('Export failed:', err);
            alert(I18n.t('errorExport'));
        }
    }

    async function shareToClipboard() {
        const text = UI.getShareText();
        try {
            await navigator.clipboard.writeText(text);
            showCopyToast();
        } catch {
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
        toast.textContent = '📋 ' + I18n.t('copiedClipboard');
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
