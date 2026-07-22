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
    // Admin state
    adminSelectedCompartment: null,
    adminUnlockRefund: 0,
    adminUnlockUser: null,
    adminUnlockCompartment: null,
};

class AppController {
    constructor() {
        this.history = [];
        this.currentScreen = 'dashboard';
        this.onBackOverride = null; // screens can set this to intercept the back button

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
        this.navigate('welcome', { flow: 'rent' }, true);

        // Setup listener for admin loading triggers
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-admin-loading]');
            if (btn) {
                this.showAdminLoading();
                const duration = btn.getAttribute('data-loading-duration');
                if (duration) {
                    setTimeout(() => this.hideAdminLoading(), parseInt(duration));
                } else {
                    // Default fallback of 2.5 seconds for simple simulation
                    setTimeout(() => this.hideAdminLoading(), 2500);
                }
            }
        });

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

        // Exclude screens that manage their own timeouts or must not be interrupted
        const noTimeoutScreens = ['dashboard', 'cash-payment', 'admin-login'];
        const isAdminScreen = this.currentScreen.startsWith('admin-');
        if (!noTimeoutScreens.includes(this.currentScreen) && !isAdminScreen) {
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
        const overlay = document.getElementById('global-loading');
        const isActive = overlay && overlay.classList.contains('active');
        const isAdminTarget = screenId.startsWith('admin-');

        // If loading is already active (e.g. from an API call), skip the artificial delay
        if (isActive) {
            this._doNavigate(screenId, stateUpdates, resetHistory);
        } else {
            const showFn = isAdminTarget ? this.showAdminLoading : this.showLoading;
            const hideFn = isAdminTarget ? this.hideAdminLoading : this.hideLoading;
            if (showFn) showFn.call(this, 'Loading...');
            setTimeout(() => {
                this._doNavigate(screenId, stateUpdates, resetHistory);
                if (hideFn) hideFn.call(this);
            }, 500);
        }
    }

    _doNavigate(screenId, stateUpdates, resetHistory, isGoingBack = false) {
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
        } else if (!isGoingBack && this.currentScreen !== screenId) {
            // Only push to history when moving forward, not when going back
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
            'select-compartment': 'CompartmentScreen',
            'admin-login': 'AdminLoginScreen',
            'admin-verify-otp': 'AdminVerifyOtpScreen',
            'admin-dashboard': 'AdminDashboardScreen',
            'admin-select-compartment': 'AdminSelectCompartmentScreen',
            'admin-confirm-unlock': 'AdminConfirmUnlockScreen',
            'admin-unlock-steps': 'AdminUnlockStepsScreen',
            'admin-unlock-done': 'AdminUnlockDoneScreen',
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
        // Allow screens to intercept back with custom logic (e.g. cash-payment cleanup)
        if (typeof this.onBackOverride === 'function') {
            this.onBackOverride();
            return;
        }
        if (this.history.length > 0) {
            const prevScreen = this.history.pop();
            this._doNavigate(prevScreen, {}, false, true);
        } else {
            this.navigate('dashboard', {}, true);
        }
    }

    showLoading(text = 'Loading...') {
        const overlay = document.getElementById('global-loading');
        if (overlay) {
            const textEl = document.getElementById('global-loading-text');
            if (textEl) textEl.innerText = text;
            overlay.style.display = 'flex';
            // Force reflow
            overlay.offsetHeight;
            overlay.classList.add('active');
        }
    }

    hideLoading() {
        const overlay = document.getElementById('global-loading');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => {
                if (!overlay.classList.contains('active')) {
                    overlay.style.display = 'none';
                }
            }, 300);
        }
    }

    showAdminLoading(text = 'Loading.') {
        const overlay = document.getElementById('admin-loading');
        if (overlay) {
            const textEl = overlay.querySelector('.admin-loading-text');
            if (textEl) textEl.innerText = text;
            overlay.style.display = 'flex';
            // Force reflow
            overlay.offsetHeight;
            overlay.classList.add('active');
        }
    }

    hideAdminLoading() {
        const overlay = document.getElementById('admin-loading');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => {
                if (!overlay.classList.contains('active')) {
                    overlay.style.display = 'none';
                }
            }, 300);
        }
    }

    showDialog(message, title = 'Alert', icon = 'warning') {
        const overlay = document.getElementById('global-dialog');
        if (overlay) {
            const msgEl = document.getElementById('global-dialog-message');
            const titleEl = document.getElementById('global-dialog-title');
            const iconEl = document.getElementById('global-dialog-icon');
            if (msgEl) msgEl.innerText = message;
            if (titleEl) titleEl.innerText = title;
            if (iconEl) iconEl.innerText = icon;
            overlay.style.display = 'flex';
            overlay.classList.add('active');
        }
    }

    hideDialog() {
        const overlay = document.getElementById('global-dialog');
        if (overlay) {
            overlay.classList.remove('active');
            overlay.style.display = 'none';
        }
    }

    showPostRentalDialog() {
        const overlay = document.getElementById('post-rental-dialog');
        if (overlay) {
            overlay.style.display = 'flex';
            // Force reflow so the transition runs
            overlay.offsetHeight;
            overlay.classList.add('active');
        }
    }

    hidePostRentalDialog() {
        const overlay = document.getElementById('post-rental-dialog');
        if (overlay) {
            overlay.classList.remove('active');
            overlay.style.display = 'none';
        }
    }

    showPostRetrievalDialog() {
        const overlay = document.getElementById('post-retrieval-dialog');
        if (overlay) {
            overlay.style.display = 'flex';
            // Force reflow so the transition runs
            overlay.offsetHeight;
            overlay.classList.add('active');
        }
    }

    hidePostRetrievalDialog() {
        const overlay = document.getElementById('post-retrieval-dialog');
        if (overlay) {
            overlay.classList.remove('active');
            overlay.style.display = 'none';
        }
    }
}
window.App = new AppController();
if (!App.showAdminLoading) App.showAdminLoading = App.showLoading.bind(App);
if (!App.hideAdminLoading) App.hideAdminLoading = App.hideLoading.bind(App);
