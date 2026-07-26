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
    amountPaid: 0,       // gross cash inserted for retrieval flow
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
        this.navigate('dashboard', { flow: 'rent' }, true);

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
        const noTimeoutScreens = ['welcome', 'cash-payment', 'admin-login', 'locker-warning', 'rental-confirmed', 'retrieval-ready'];
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
            overlay.style.cursor = 'pointer';
            overlay.onclick = () => {
                if (this.isCountingDown) {
                    this.navigate('welcome', {}, true);
                    this.resetTimeout();
                }
            };

            this.countdownInterval = setInterval(() => {
                this.countdownValue--;
                if (this.countdownValue > 0) {
                    counterEl.innerText = this.countdownValue;
                } else {
                    clearInterval(this.countdownInterval);
                    overlay.classList.add('hidden');
                    this.isCountingDown = false;
                    // If a user is logged in, show "Logging out..." before clearing session
                    if (AppState.user) {
                        this.showLoading('Logging out...');
                        setTimeout(() => {
                            this.hideLoading();
                            this.navigate('dashboard', {}, true);
                        }, 1500);
                    } else if (this.currentScreen === 'dashboard') {
                        // On home screen with no user — go to step-by-step guide
                        this.navigate('welcome', {}, true);
                    } else {
                        this.navigate('dashboard', {}, true);
                    }
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
                AppState.amountPaid = 0;
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

    /**
     * Show a brief, non-blocking toast notification.
     * @param {string} message  - Text to display.
     * @param {'info'|'warning'|'error'} type - Visual style.
     * @param {number} duration - Auto-dismiss after this many ms (default 4000).
     */
    showToast(message, type = 'info', duration = 4000) {
        // Reuse or create a dedicated toast container
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = [
                'position:fixed', 'bottom:32px', 'left:50%',
                'transform:translateX(-50%)', 'z-index:9999',
                'display:flex', 'flex-direction:column', 'align-items:center',
                'gap:10px', 'pointer-events:none',
            ].join(';');
            document.body.appendChild(container);
        }

        const colorMap = {
            info:    { bg: '#1e40af', border: '#3b82f6', icon: 'info' },
            warning: { bg: '#92400e', border: '#f59e0b', icon: 'warning_amber' },
            error:   { bg: '#7f1d1d', border: '#ef4444', icon: 'error' },
        };
        const { bg, border, icon } = colorMap[type] || colorMap.info;

        const toast = document.createElement('div');
        toast.style.cssText = [
            `background:${bg}`, `border:2px solid ${border}`,
            'color:#fff', 'border-radius:12px',
            'padding:14px 22px', 'font-size:15px', 'font-weight:600',
            'display:flex', 'align-items:center', 'gap:10px',
            'box-shadow:0 4px 24px rgba(0,0,0,0.4)',
            'opacity:0', 'transition:opacity 0.3s ease',
            'pointer-events:none', 'max-width:360px', 'text-align:center',
        ].join(';');
        toast.innerHTML = `<span class="material-icons-round" style="font-size:20px">${icon}</span>${message}`;

        container.appendChild(toast);

        // Fade in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => { toast.style.opacity = '1'; });
        });

        // Auto-dismiss
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 350);
        }, duration);
    }

    /** Show the "no receipt paper" popup dialog. */
    showNoPaperDialog() {
        const overlay = document.getElementById('no-paper-dialog');
        if (overlay) {
            overlay.style.display = 'flex';
            // Force reflow so the CSS transition fires
            overlay.offsetHeight;
            overlay.classList.add('active');
        }
    }

    /** Dismiss the "no receipt paper" popup dialog. */
    hideNoPaperDialog() {
        const overlay = document.getElementById('no-paper-dialog');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => {
                if (!overlay.classList.contains('active')) {
                    overlay.style.display = 'none';
                }
            }, 250);
        }
    }

    showDialog(message, title = 'Alert', type = 'warning', buttonText = 'OK', onConfirm = null) {
        const overlay = document.getElementById('global-dialog');
        if (overlay) {
            const msgEl = document.getElementById('global-dialog-message');
            const titleEl = document.getElementById('global-dialog-title');
            const iconEl = document.getElementById('global-dialog-icon');
            const boxEl = document.querySelector('#global-dialog .global-dialog-box');
            const btnEl = document.getElementById('global-dialog-ok-btn');
            
            if (msgEl) msgEl.innerHTML = message; // Use innerHTML to support formatted text
            if (titleEl) titleEl.innerText = title;
            
            // Icon mapping based on type
            const iconMap = {
                success: 'check_circle',
                error: 'error',
                warning: 'warning',
                info: 'info',
                question: 'help_outline',
                coins: 'savings',
                payment: 'payments'
            };
            
            const iconName = iconMap[type] || 'warning';
            
            if (iconEl) {
                iconEl.innerText = iconName;
                // Remove all color classes first
                iconEl.classList.remove('success', 'error', 'warning', 'info', 'question', 'coins', 'payment');
                // Apply specific color class
                iconEl.classList.add(type);
            }
            
            // Apply background color classes to the dialog box
            if (boxEl) {
                boxEl.classList.remove('success-bg', 'error-bg', 'warning-bg', 'info-bg', 'question-bg', 'coins-bg', 'payment-bg');
                boxEl.classList.add(`${type}-bg`);
            }
            
            // Update button text and callback
            if (btnEl) {
                btnEl.innerHTML = `<span class="material-icons-round">check</span>${buttonText}`;
                btnEl.onclick = () => {
                    this.hideDialog();
                    if (typeof onConfirm === 'function') onConfirm();
                };
            }
            
            overlay.style.display = 'flex';
            // Force reflow
            overlay.offsetHeight;
            overlay.classList.add('active');
        }
    }

    showConfirmDialog(message, title, icon, onConfirm) {
        const overlay = document.getElementById('global-confirm-dialog');
        if (overlay) {
            const msgEl = document.getElementById('global-confirm-dialog-message');
            const titleEl = document.getElementById('global-confirm-dialog-title');
            const iconEl = document.getElementById('global-confirm-dialog-icon');
            const confirmBtn = document.getElementById('global-confirm-dialog-btn');
            const boxEl = document.querySelector('#global-confirm-dialog .global-dialog-box');
            
            if (msgEl) msgEl.innerText = message;
            if (titleEl) titleEl.innerText = title || 'Confirm';
            if (iconEl) {
                iconEl.innerText = icon || 'help_outline';
                iconEl.style.color = 'var(--primary-green)'; // Default positive color
            }
            
            if (confirmBtn) {
                // Clear old event listeners by cloning or just assigning onclick
                confirmBtn.onclick = () => {
                    this.hideConfirmDialog();
                    if (typeof onConfirm === 'function') onConfirm();
                };
            }
            
            overlay.style.display = 'flex';
            // Force reflow
            overlay.offsetHeight;
            overlay.classList.add('active');
        }
    }

    hideConfirmDialog() {
        const overlay = document.getElementById('global-confirm-dialog');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => {
                if (!overlay.classList.contains('active')) {
                    overlay.style.display = 'none';
                }
            }, 300);
        }
    }

    hideDialog() {
        const overlay = document.getElementById('global-dialog');
        if (overlay) {
            overlay.classList.remove('active');
            overlay.style.display = 'none';
        }

        // If a screen requested post-retrieval/post-rental actions after the dialog,
        // schedule showing those choice dialogs 5 seconds after the user dismisses the reminder.
        if (this._postRetrievalAfterDialog) {
            this._postRetrievalAfterDialog = false;
            setTimeout(() => {
                this.showPostRetrievalDialog();
            }, 5000);
        }

        if (this._postRentalAfterDialog) {
            this._postRentalAfterDialog = false;
            setTimeout(() => {
                this.showPostRentalDialog();
            }, 5000);
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

    logout() {
        this.showLoading('Logging out...');
        setTimeout(() => {
            this.hideLoading();
            this.navigate('dashboard', {}, true);
        }, 1500);
    }
}
window.App = new AppController();
if (!App.showAdminLoading) App.showAdminLoading = App.showLoading.bind(App);
if (!App.hideAdminLoading) App.hideAdminLoading = App.hideLoading.bind(App);
