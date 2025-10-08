// accessibility.js - Модуль доступности для людей с нарушениями слуха и зрения
class AccessibilityModule {
    constructor() {
        this.isPanelOpen = false;
        this.currentFontSizePercent = 100;
        this.speechSynthesis = window.speechSynthesis;
        this.speechUtterance = null;
        this.currentHighlightedElement = null;
        
        this.init();
    }

    init() {
        this.createAccessibilityPanel();
        this.bindEvents();
        this.loadSettings();
    }

    createAccessibilityPanel() {
        const panelHTML = `
            <button class="accessibility-toggle" aria-expanded="false" title="Настройки доступности">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 5.5V7H9V5.5L3 7V9L5 9.5V15.5L3 16V18L9 16.5V15H15V16.5L21 18V16L19 15.5V9.5L21 9Z"/>
                </svg>
            </button>
    
            <div class="accessibility-panel">
                <div id="accessibility-title">Настройки доступности</div>
    
                <!-- Цветовые схемы -->
                <div class="option-group">
                    <h3 class="option-group-title">Цветовая схема</h3>
                    <button id="black-on-white" class="color-scheme-btn black-on-white">Черным по белому</button>
                    <button id="white-on-black" class="color-scheme-btn white-on-black">Белым по черному</button>
                    <button id="brown-on-beige" class="color-scheme-btn brown-on-beige">Коричневым по бежевому</button>
                    <button id="dark-blue-on-blue" class="color-scheme-btn dark-blue-on-blue">Темно-синим по синему</button>
                </div>
    
                <!-- Размер шрифта -->
                <div class="option-group">
                    <h3 class="option-group-title">Размер текста</h3>
                    <div class="font-size-controls">
                        <button id="decrease-font" class="font-size-btn">A-</button>
                        <button id="normal-font" class="font-size-btn">A</button>
                        <button id="increase-font" class="font-size-btn">A+</button>
                    </div>
                </div>
    
                <!-- ТОЛЬКО черно-белый фильтр (инверсия удалена) -->
                <div class="option-group">
                    <h3 class="option-group-title">Фильтры</h3>
                    <button id="grayscale" class="filter-btn" aria-pressed="false">
                        <div class="filter-icon"></div>Черно-белый
                    </button>
                </div>
    
                <!-- Курсор -->
                <div class="option-group">
                    <h3 class="option-group-title">Курсор</h3>
                    <button id="large-cursor" class="filter-btn" aria-pressed="false">
                        <div class="filter-icon"></div>Крупный курсор
                    </button>
                </div>
    
                <!-- УДАЛЕНА СЕКЦИЯ ИЗОБРАЖЕНИЙ -->
    
                <!-- Чтение вслух -->
                <div class="option-group">
                    <h3 class="option-group-title">Чтение вслух</h3>
                    <button id="read-aloud" class="filter-btn">
                        <div class="filter-icon"></div>Чтение вслух
                    </button>
                    <button id="stop-reading" class="filter-btn">
                        <div class="filter-icon"></div>Остановить чтение
                    </button>
                </div>
    
                <!-- Сброс -->
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
        // Переключение панели
        const toggle = document.querySelector('.accessibility-toggle');
        const panel = document.querySelector('.accessibility-panel');
    
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePanel();
        });
    
        // Закрытие панели при клике вне её
        document.addEventListener('click', (e) => {
            if (this.isPanelOpen && 
                !panel.contains(e.target) && 
                !toggle.contains(e.target)) {
                this.closePanel();
            }
        });
    
        // Цветовые схемы
        const colorSchemeButtons = document.querySelectorAll('.color-scheme-btn');
        colorSchemeButtons.forEach(button => {
            button.addEventListener('click', () => this.handleColorScheme(button));
        });
    
        // Размер шрифта
        document.getElementById('decrease-font').addEventListener('click', () => this.changeFontSize(-10));
        document.getElementById('normal-font').addEventListener('click', () => this.resetFontSize());
        document.getElementById('increase-font').addEventListener('click', () => this.changeFontSize(10));
    
        // ТОЛЬКО черно-белый фильтр
        document.getElementById('grayscale').addEventListener('click', (e) => this.toggleGrayscale(e.target));
    
        // Курсор
        document.getElementById('large-cursor').addEventListener('click', (e) => this.toggleLargeCursor(e.target));
    
        // Чтение вслух
        document.getElementById('read-aloud').addEventListener('click', () => this.readAloud());
        document.getElementById('stop-reading').addEventListener('click', () => this.stopReading());
    
        // Сброс
        document.getElementById('reset-accessibility').addEventListener('click', () => this.resetAll());
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
        
        // Сбрасываем цветовые схемы при выборе фильтра
        this.removeColorScheme();
    
        if (isActive) {
            // Выключаем фильтр
            document.body.classList.remove('accessibility-grayscale');
            button.setAttribute('aria-pressed', 'false');
            button.classList.remove('active');
            localStorage.removeItem('accessibilityGrayscale');
        } else {
            // Включаем фильтр
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

        // Сбрасываем фильтры при выборе цветовой схемы
        this.resetFilters();

        // Удаляем все цветовые схемы
        document.body.classList.remove(
            'accessibility-black-on-white',
            'accessibility-white-on-black',
            'accessibility-brown-on-beige',
            'accessibility-dark-blue-on-blue'
        );

        // Снимаем активность со всех кнопок цветовых схем
        document.querySelectorAll('.color-scheme-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Применяем выбранную схему
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
        
        // Устанавливаем CSS переменную
        document.documentElement.style.setProperty('--accessibility-font-scale', scale);
        
        // Также устанавливаем для body для обратной совместимости
        document.body.style.fontSize = this.currentFontSizePercent + '%';
        
        // Принудительно обновляем header
        this.updateHeaderFontSize(scale);
        
        localStorage.setItem('accessibilityFontSizePercent', this.currentFontSizePercent);
    }

    toggleFilter(filter, button) {
        const isActive = button.getAttribute('aria-pressed') === 'true';
        const filterClass = 'accessibility-' + (filter === 'invert' ? 'invert' : 'grayscale');
        
        // Сбрасываем цветовые схемы при выборе фильтра
        this.removeColorScheme();
        
        // Сбрасываем другой фильтр (если активен)
        this.resetOtherFilter(filter, button);

        if (isActive) {
            // Выключаем фильтр
            document.body.classList.remove(filterClass);
            button.setAttribute('aria-pressed', 'false');
            button.classList.remove('active');
            localStorage.removeItem('accessibility' + (filter === 'invert' ? 'Invert' : 'Grayscale'));
        } else {
            // Включаем фильтр
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
            localStorage.removeItem('accessibilityLargeCursor');
        } else {
            document.body.classList.add('large-cursor');
            button.setAttribute('aria-pressed', 'true');
            button.classList.add('active');
            localStorage.setItem('accessibilityLargeCursor', 'true');
        }
    }

        // Новый метод для сброса другого фильтра
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
            // Сбрасываем только grayscale
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

    readAloud() {
        if (this.speechSynthesis.speaking) {
            this.speechSynthesis.cancel();
        }

        // Собираем весь текст со страницы, исключая элементы доступности
        const elements = document.querySelectorAll('body *:not(.accessibility-module *):not(script):not(style)');
        let textContent = '';
        
        elements.forEach(element => {
            if (element.children.length === 0 && element.textContent.trim()) {
                textContent += element.textContent + '. ';
            }
        });

        if (!textContent.trim()) {
            alert('Не найден текст для чтения');
            return;
        }

        this.speechUtterance = new SpeechSynthesisUtterance(textContent);
        
        // Пытаемся найти русский голос
        const voices = this.speechSynthesis.getVoices();
        const russianVoice = voices.find(voice => voice.lang.includes('ru'));
        if (russianVoice) {
            this.speechUtterance.voice = russianVoice;
        }

        this.speechUtterance.rate = 0.8;
        this.speechUtterance.pitch = 1;
        this.speechUtterance.volume = 1;

        this.speechUtterance.onend = () => {
            document.getElementById('read-aloud').classList.remove('active');
        };

        this.speechSynthesis.speak(this.speechUtterance);
        document.getElementById('read-aloud').classList.add('active');
        document.getElementById('stop-reading').classList.remove('active');
    }

    stopReading() {
        if (this.speechSynthesis.speaking) {
            this.speechSynthesis.cancel();
            document.getElementById('read-aloud').classList.remove('active');
            document.getElementById('stop-reading').classList.add('active');
        }
    }

    updateHeaderFontSize(scale) {
        const header = document.querySelector('.header');
        if (!header) return;
        
        // Обновляем все текстовые элементы в header
        const headerElements = header.querySelectorAll('*');
        headerElements.forEach(element => {
            const tagName = element.tagName.toLowerCase();
            
            // Для заголовка
            if (tagName === 'h1') {
                element.style.fontSize = `calc(1.8rem * ${scale})`;
            }
            // Для кнопок
            else if (element.classList.contains('btn')) {
                element.style.fontSize = `calc(14px * ${scale})`;
            }
            // Для остального текста
            else if (['span', 'div', 'p'].includes(tagName)) {
                element.style.fontSize = `calc(1rem * ${scale})`;
            }
        });
    }

    resetAll() {
        // Сбрасываем CSS переменную
        document.documentElement.style.setProperty('--accessibility-font-scale', '1');
        
        // Сбрасываем остальные настройки
        document.body.classList.remove(
            'accessibility-black-on-white',
            'accessibility-white-on-black',
            'accessibility-brown-on-beige',
            'accessibility-dark-blue-on-blue',
            'accessibility-grayscale',
            'large-cursor'
        );

        document.body.style.fontSize = '';
        this.currentFontSizePercent = 100;
    
        // Сбрасываем кнопки
        document.querySelectorAll('.color-scheme-btn, .filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.hasAttribute('aria-pressed')) {
                btn.setAttribute('aria-pressed', 'false');
            }
        });
    
        // Останавливаем чтение
        this.stopReading();
    
        // Очищаем localStorage
        const keys = [
            'accessibilityColorScheme',
            'accessibilityFontSizePercent',
            'accessibilityGrayscale',
            'accessibilityLargeCursor'
            // Убрали 'accessibilityInvert' и 'accessibilityHideImages'
        ];
        
        keys.forEach(key => localStorage.removeItem(key));
    }

    loadSettings() {
        // Загружаем цветовую схему
        const colorScheme = localStorage.getItem('accessibilityColorScheme');
        if (colorScheme) {
            document.body.classList.add('accessibility-' + colorScheme);
            document.getElementById(colorScheme).classList.add('active');
        }
    
        // Загружаем grayscale фильтр (если нет цветовой схемы)
        const grayscale = localStorage.getItem('accessibilityGrayscale') === 'true';
        if (grayscale && !colorScheme) {
            document.body.classList.add('accessibility-grayscale');
            document.getElementById('grayscale').classList.add('active');
            document.getElementById('grayscale').setAttribute('aria-pressed', 'true');
        }
    
        // Размер шрифта
        const fontSize = localStorage.getItem('accessibilityFontSizePercent');
        if (fontSize) {
            this.currentFontSizePercent = parseInt(fontSize);
            this.updateFontSize();
        }
    
        // Курсор
        if (localStorage.getItem('accessibilityLargeCursor') === 'true') {
            document.body.classList.add('large-cursor');
            document.getElementById('large-cursor').classList.add('active');
            document.getElementById('large-cursor').setAttribute('aria-pressed', 'true');
        }
    
        // Убрали загрузку настроек изображений
    }

    loadGrayscale() {
        document.body.classList.add('accessibility-grayscale');
        document.getElementById('grayscale').classList.add('active');
        document.getElementById('grayscale').setAttribute('aria-pressed', 'true');
        // Сбрасываем цветовую схему при загрузке фильтра
        this.removeColorScheme();
    }

    loadInvert() {
        document.body.classList.add('accessibility-invert');
        document.getElementById('invert-colors').classList.add('active');
        document.getElementById('invert-colors').setAttribute('aria-pressed', 'true');
        // Сбрасываем цветовую схему при загрузке фильтра

        this.removeColorScheme();
    }
}

// Инициализация модуля доступности
let accessibilityModule;
document.addEventListener('DOMContentLoaded', () => {
    accessibilityModule = new AccessibilityModule();
});