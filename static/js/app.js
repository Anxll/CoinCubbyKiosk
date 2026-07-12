const AppState = {
    user: null,
    flow: 'rent', // 'rent' or 'retrieve'
    selectedCompartment: null,
    rentalType: null, // 'fixed' or 'open_time'
    durationHours: null,
    rentalPricing: null,
    totalDue: 0,
    paymentMethod: null,
    cashInserted: 0,
    cashWalletCredit: 0,
    activeRentals: [],
    selectedRental: null,
};

class AppController {
    constructor() {
        this.history = [];
        this.currentScreen = 'dashboard';
        
        // Timeout handling for kiosk
        this.INACTIVITY_LIMIT_MS = 15000; // 15s
        this.COUNTDOWN_START = 15;
        this.countdownValue = this.COUNTDOWN_START;
        this.inactivityTimeout = null;
        this.countdownInterval = null;
        this.isCountingDown = false;

        this.init();
    }

    init() {
        document.addEventListener('click', () => this.resetTimeout());
        document.addEventListener('touchstart', () => this.resetTimeout());
        document.addEventListener('keydown', () => this.resetTimeout());
        this.navigate('dashboard', {flow: 'rent'}, true);
        
        // Update header clock
        setInterval(() => Header.updateClock(), 1000);
        Header.updateClock();
    }

    resetTimeout() {
        if (this.inactivityTimeout) clearTimeout(this.inactivityTimeout);
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        
        // Hide overlay if it was showing
        this.isCountingDown = false;
        const overlay = document.getElementById('timeout-overlay');
        if (overlay) overlay.classList.add('hidden');

        if (this.currentScreen !== 'dashboard') {
            this.inactivityTimeout = setTimeout(() => {
                this.startCountdown();
            }, this.INACTIVITY_LIMIT_MS);
        }
    }

    startCountdown() {
        this.isCountingDown = true;
        this.countdownValue = this.COUNTDOWN_START;
        const overlay = document.getElementById('timeout-overlay');
        const counterEl = document.getElementById('timeout-counter');
        
        if (overlay && counterEl) {
            counterEl.innerText = this.countdownValue;
            overlay.classList.remove('hidden');
            
            this.countdownInterval = setInterval(() => {
                this.countdownValue--;
                if (this.countdownValue > 0) {
                    counterEl.innerText = this.countdownValue;
                } else {
                    clearInterval(this.countdownInterval);
                    this.navigate('dashboard', {}, true);
                }
            }, 1000);
        }
    }

    navigate(screenId, stateUpdates = {}, resetHistory = false) {
        // Apply state updates
        Object.assign(AppState, stateUpdates);

        if (resetHistory) {
            this.history = [];
            if (screenId === 'dashboard') {
                AppState.user = null;
                AppState.selectedCompartment = null;
                AppState.rentalType = null;
                AppState.durationHours = null;
                AppState.totalDue = 0;
                AppState.paymentMethod = null;
                AppState.cashInserted = 0;
                AppState.cashWalletCredit = 0;
                AppState.selectedRental = null;
            }
        } else if (this.currentScreen !== screenId) {
            this.history.push(this.currentScreen);
        }

        // Hide old screen
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        
        // Show new screen
        const screenEl = document.getElementById(`screen-${screenId}`);
        if (screenEl) {
            screenEl.classList.add('active');
            this.currentScreen = screenId;
        }

        // Trigger screen init if exists
        const screenAliases = {
            'select-compartment': 'CompartmentScreen'
        };
        const screenObjName = screenAliases[screenId] || (screenId.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('') + 'Screen');
        if (window[screenObjName] && typeof window[screenObjName].init === 'function') {
            window[screenObjName].init();
        }

        Header.update(this.currentScreen);
        Stepper.update(this.currentScreen, AppState.flow);
        
        this.resetTimeout();
    }

    goBack() {
        if (this.history.length > 0) {
            const prevScreen = this.history.pop();
            this.navigate(prevScreen, {}, false);
            this.history.pop(); // prevent double adding to history
        } else {
            this.navigate('dashboard', {}, true);
        }
    }
}
window.App = new AppController();
