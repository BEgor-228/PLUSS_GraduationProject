class AccessibilityModule {
    constructor() {
        this.isPanelOpen = false;
        this.currentFontSizePercent = 100;
        this.speechSynthesis = window.speechSynthesis;
        this.speechUtterance = null;
        this.currentHighlightedElement = null;
        this.showColorSchemes = window.ACCESSIBILITY_SHOW_COLOR_SCHEMES !== false;
        this.init();
    }

    init() {
        this.createAccessibilityPanel();
        this.bindEvents();
    }

    createAccessibilityPanel() {
        const colorSchemeBlock = this.showColorSchemes
            ? `
                <div class="option-group">
                    <h3 class="option-group-title">Цветовая схема</h3>
                    <button id="black-on-white" class="color-scheme-btn black-on-white">Черным по белому</button>
                    <button id="white-on-black" class="color-scheme-btn white-on-black">Белым по черному</button>
                    <button id="brown-on-beige" class="color-scheme-btn brown-on-beige">Коричневым по бежевому</button>
                    <button id="dark-blue-on-blue" class="color-scheme-btn dark-blue-on-blue">Темно-синим по синему</button>
                </div>
            `
            : "";

        const panelHTML = `
            <button class="accessibility-toggle" aria-expanded="false" title="Настройки доступности">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-icon lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
    
            <div class="accessibility-panel">
                <div id="accessibility-title">Настройки доступности</div>
    
                ${colorSchemeBlock}
    
                <div class="option-group">
                    <h3 class="option-group-title">Размер текста</h3>
                    <div class="font-size-controls">
                        <button id="decrease-font" class="font-size-btn">A-</button>
                        <button id="normal-font" class="font-size-btn">A</button>
                        <button id="increase-font" class="font-size-btn">A+</button>
                    </div>
                </div>
    
                <div class="option-group">
                    <h3 class="option-group-title">Фильтры</h3>
                    <button id="grayscale" class="filter-btn" aria-pressed="false">
                        <div class="filter-icon"></div>Черно-белый
                    </button>
                </div>
    
                <div class="option-group">
                    <h3 class="option-group-title">Курсор</h3>
                    <button id="large-cursor" class="filter-btn" aria-pressed="false">
                        <div class="filter-icon"></div>Крупный курсор
                    </button>
                </div>
    
                <div class="option-group">
                    <h3 class="option-group-title">Чтение вслух</h3>
                    <button id="read-aloud" class="filter-btn">
                        <div class="filter-icon"></div>Чтение вслух
                    </button>
                    <button id="stop-reading" class="filter-btn">
                        <div class="filter-icon"></div>Остановить чтение
                    </button>
                </div>
    
                <div class="option-group">
                    <button id="reset-accessibility">Сбросить настройки</button>
                </div>
            </div>
        `;
    
        const container = document.createElement('div');
        container.className = 'accessibility-module';
        container.innerHTML = panelHTML;
        document.body.appendChild(container);
    }

    bindEvents() {
        const toggle = document.querySelector('.accessibility-toggle');
        const panel = document.querySelector('.accessibility-panel');
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePanel();
        });
        document.addEventListener('click', (e) => {
            if (this.isPanelOpen && 
                !panel.contains(e.target) && 
                !toggle.contains(e.target)) {
                this.closePanel();
            }
        });
        const colorSchemeButtons = document.querySelectorAll('.color-scheme-btn');
        if (this.showColorSchemes) {
            colorSchemeButtons.forEach(button => {
                button.addEventListener('click', () => this.handleColorScheme(button));
            });
        }
    
        document.getElementById('decrease-font').addEventListener('click', () => this.changeFontSize(-10));
        document.getElementById('normal-font').addEventListener('click', () => this.resetFontSize());
        document.getElementById('increase-font').addEventListener('click', () => this.changeFontSize(10));
        document.getElementById('grayscale').addEventListener('click', (e) => this.toggleGrayscale(e.target));
        document.getElementById('large-cursor').addEventListener('click', (e) => this.toggleLargeCursor(e.target));
        document.getElementById('reset-accessibility').addEventListener('click', () => this.resetAll());
        document.getElementById('read-aloud').addEventListener('click', () => this.enableTextReading());
        document.getElementById('stop-reading').addEventListener('click', () => this.disableTextReading());
    }

    togglePanel() {
        const panel = document.querySelector('.accessibility-panel');
        const toggle = document.querySelector('.accessibility-toggle');
        this.isPanelOpen = !this.isPanelOpen;
        panel.classList.toggle('open');
        toggle.setAttribute('aria-expanded', this.isPanelOpen);
    }

    closePanel() {
        const panel = document.querySelector('.accessibility-panel');
        const toggle = document.querySelector('.accessibility-toggle');
        this.isPanelOpen = false;
        panel.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
    }

    toggleGrayscale(button) {
        const isActive = button.getAttribute('aria-pressed') === 'true';
        this.removeColorScheme();
        if (isActive) {
            document.body.classList.remove('accessibility-grayscale');
            button.setAttribute('aria-pressed', 'false');
            button.classList.remove('active');
            localStorage.removeItem('accessibilityGrayscale');
        } else {
            document.body.classList.add('accessibility-grayscale');
            button.setAttribute('aria-pressed', 'true');
            button.classList.add('active');
            localStorage.setItem('accessibilityGrayscale', 'true');
        }
    }

    handleColorScheme(button) {
        if (button.classList.contains('active')) {
            this.removeColorScheme();
            return;
        }
        this.resetFilters();
        document.body.classList.remove(
            'accessibility-black-on-white',
            'accessibility-white-on-black',
            'accessibility-brown-on-beige',
            'accessibility-dark-blue-on-blue'
        );
        document.querySelectorAll('.color-scheme-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const schemeId = button.id;
        document.body.classList.add('accessibility-' + schemeId);
        button.classList.add('active');
        localStorage.setItem('accessibilityColorScheme', schemeId);
    }

    removeColorScheme() {
        document.body.classList.remove(
            'accessibility-black-on-white',
            'accessibility-white-on-black',
            'accessibility-brown-on-beige',
            'accessibility-dark-blue-on-blue'
        );
        document.querySelectorAll('.color-scheme-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        localStorage.removeItem('accessibilityColorScheme');
    }

    changeFontSize(change) {
        this.currentFontSizePercent = Math.max(70, Math.min(130, this.currentFontSizePercent + change));
        this.updateFontSize();
    }

    resetFontSize() {
        this.currentFontSizePercent = 100;
        this.updateFontSize();
    }

    updateFontSize() {
        const scale = this.currentFontSizePercent / 100;
        document.documentElement.style.setProperty('--accessibility-font-scale', scale);
        document.body.style.fontSize = this.currentFontSizePercent + '%';
        this.updateHeaderFontSize(scale);
        localStorage.setItem('accessibilityFontSizePercent', this.currentFontSizePercent);
    }

    toggleFilter(filter, button) {
        const isActive = button.getAttribute('aria-pressed') === 'true';
        const filterClass = 'accessibility-' + (filter === 'invert' ? 'invert' : 'grayscale');
        this.removeColorScheme();
        this.resetOtherFilter(filter, button);
        if (isActive) {
            document.body.classList.remove(filterClass);
            button.setAttribute('aria-pressed', 'false');
            button.classList.remove('active');
            localStorage.removeItem('accessibility' + (filter === 'invert' ? 'Invert' : 'Grayscale'));
        } else {
            document.body.classList.add(filterClass);
            button.setAttribute('aria-pressed', 'true');
            button.classList.add('active');
            localStorage.setItem('accessibility' + (filter === 'invert' ? 'Invert' : 'Grayscale'), 'true');
        }
    }

    toggleLargeCursor(button) {
        const isActive = button.getAttribute('aria-pressed') === 'true';
        if (isActive) {
            document.body.classList.remove('large-cursor');
            button.setAttribute('aria-pressed', 'false');
            button.classList.remove('active');
        } else {
            document.body.classList.add('large-cursor');
            button.setAttribute('aria-pressed', 'true');
            button.classList.add('active');
        }
    }

    resetOtherFilter(currentFilter, currentButton) {
        const otherFilter = currentFilter === 'invert' ? 'grayscale' : 'invert';
        const otherButton = document.getElementById(otherFilter === 'invert' ? 'invert-colors' : 'grayscale');
        const otherFilterClass = 'accessibility-' + otherFilter;
        if (otherButton.getAttribute('aria-pressed') === 'true') {
            document.body.classList.remove(otherFilterClass);
            otherButton.setAttribute('aria-pressed', 'false');
            otherButton.classList.remove('active');
            localStorage.removeItem('accessibility' + (otherFilter === 'invert' ? 'Invert' : 'Grayscale'));
        }
    }

    resetFilters() {
        const grayscaleButton = document.getElementById('grayscale');
        if (grayscaleButton.getAttribute('aria-pressed') === 'true') {
            document.body.classList.remove('accessibility-grayscale');
            grayscaleButton.setAttribute('aria-pressed', 'false');
            grayscaleButton.classList.remove('active');
            localStorage.removeItem('accessibilityGrayscale');
        }
    }

    hideImages() {
        document.body.classList.add('accessibility-hide-images');
        document.getElementById('hide-images').classList.add('active');
        document.getElementById('show-images').classList.remove('active');
        localStorage.setItem('accessibilityHideImages', 'true');
    }

    showImages() {
        document.body.classList.remove('accessibility-hide-images');
        document.getElementById('show-images').classList.add('active');
        document.getElementById('hide-images').classList.remove('active');
        localStorage.setItem('accessibilityHideImages', 'false');
    }

    enableTextReading() {
        document.body.classList.add('read-aloud-mode');
        document.getElementById('read-aloud').classList.add('active');
        document.getElementById('stop-reading').classList.remove('active');
        this.readAloudHandler = (e) => this.handleTextClick(e);
        document.addEventListener('click', this.readAloudHandler);
        document.body.style.cursor = 'text';
        localStorage.setItem('accessibilityReadAloudMode', 'true');
    }

    disableTextReading() {
        document.body.classList.remove('read-aloud-mode');
        document.getElementById('read-aloud').classList.remove('active');
        document.getElementById('stop-reading').classList.add('active');
        if (this.readAloudHandler) {
            document.removeEventListener('click', this.readAloudHandler);
        }
        document.body.style.cursor = '';
        if (this.speechSynthesis.speaking) {
            this.speechSynthesis.cancel();
        }
        localStorage.setItem('accessibilityReadAloudMode', 'false');
    }

    handleTextClick(event) {
        event.preventDefault();
        event.stopPropagation();
        if (this.speechSynthesis.speaking) {
            this.speechSynthesis.cancel();
        }
        const target = event.target;
        if (target.closest('.accessibility-module')) {
            return;
        }
        let textToRead = this.extractTextFromElement(target);
        if (textToRead && textToRead.trim()) {
            this.speakText(textToRead, target);
        }
    }

    extractTextFromElement(element) {
        if (element.children.length === 0 && element.textContent.trim()) {
            return element.textContent.trim();
        }
        if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName)) {
            return element.textContent.trim();
        }
        if (element.tagName === 'P') {
            return element.textContent.trim();
        }
        if (['BUTTON', 'A'].includes(element.tagName)) {
            return element.textContent.trim() || element.getAttribute('aria-label') || element.title;
        }
        if (element.getAttribute('aria-label')) {
            return element.getAttribute('aria-label');
        }
        let parent = element;
        for (let i = 0; i < 3; i++) {
            if (parent.textContent && parent.textContent.trim()) {
                return parent.textContent.trim();
            }
            parent = parent.parentElement;
            if (!parent) break;
        }
        return null;
    }

    speakText(text, element) {
        if (!text || !text.trim()) return;
        this.highlightElement(element);
        this.speechUtterance = new SpeechSynthesisUtterance(text);
        const voices = this.speechSynthesis.getVoices();
        const russianVoice = voices.find(voice => voice.lang.includes('ru'));
        if (russianVoice) {
            this.speechUtterance.voice = russianVoice;
        }
        this.speechUtterance.rate = 0.8;
        this.speechUtterance.pitch = 1;
        this.speechUtterance.volume = 1;
        this.speechUtterance.onend = () => {
            this.removeHighlight(element);
        };
        this.speechUtterance.onerror = () => {
            this.removeHighlight(element);
        };
        this.speechSynthesis.speak(this.speechUtterance);
    }

    highlightElement(element) {
        if (this.currentHighlightedElement) {
            this.removeHighlight(this.currentHighlightedElement);
        }
        element.classList.add('accessibility-reading-highlight');
        this.currentHighlightedElement = element;
    }

    removeHighlight(element) {
        if (element) {
            element.classList.remove('accessibility-reading-highlight');
        }
        this.currentHighlightedElement = null;
    }

    updateHeaderFontSize(scale) {
        const header = document.querySelector('.header');
        if (!header) return;
        const headerElements = header.querySelectorAll('*');
        headerElements.forEach(element => {
            const tagName = element.tagName.toLowerCase();
            if (tagName === 'h1') {
                element.style.fontSize = `calc(1.8rem * ${scale})`;
            }
            else if (element.classList.contains('btn')) {
                element.style.fontSize = `calc(14px * ${scale})`;
            }
            else if (['span', 'div', 'p'].includes(tagName)) {
                element.style.fontSize = `calc(1rem * ${scale})`;
            }
        });
    }

    resetAll() {
        document.documentElement.style.setProperty('--accessibility-font-scale', '1');
        document.body.classList.remove(
            'accessibility-black-on-white',
            'accessibility-white-on-black',
            'accessibility-brown-on-beige',
            'accessibility-dark-blue-on-blue',
            'accessibility-grayscale',
            'large-cursor'
        );
        document.body.style.fontSize = '';
        document.body.style.cursor = '';
        this.currentFontSizePercent = 100;
        document.querySelectorAll('.color-scheme-btn, .filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.hasAttribute('aria-pressed')) {
                btn.setAttribute('aria-pressed', 'false');
            }
        });
        this.disableTextReading();
        const keys = [
            'accessibilityColorScheme',
            'accessibilityFontSizePercent',
            'accessibilityGrayscale',
            'accessibilityLargeCursor',
            'accessibilityReadAloudMode'
        ];
        keys.forEach(key => localStorage.removeItem(key));
    }

    loadGrayscale() {
        document.body.classList.add('accessibility-grayscale');
        document.getElementById('grayscale').classList.add('active');
        document.getElementById('grayscale').setAttribute('aria-pressed', 'true');
        this.removeColorScheme();
    }

    loadInvert() {
        document.body.classList.add('accessibility-invert');
        document.getElementById('invert-colors').classList.add('active');
        document.getElementById('invert-colors').setAttribute('aria-pressed', 'true');
        this.removeColorScheme();
    }
}

let accessibilityModule;
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.accessibilityWidget === '0') {
        return;
    }
    accessibilityModule = new AccessibilityModule();
});