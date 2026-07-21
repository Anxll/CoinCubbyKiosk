const Header = {
    el: document.getElementById('app-header'),
    backBtn: document.getElementById('header-back-btn'),
    homeBtn: document.getElementById('header-home-btn'),
    title: document.getElementById('header-title'),
    clock: document.getElementById('header-clock'),
    date: document.getElementById('header-date'),
    userInfo: document.getElementById('header-user-info'),
    userCode: document.getElementById('header-user-code'),

    init() {
        this.backBtn.addEventListener('click', () => App.goBack());
        this.homeBtn.addEventListener('click', () => App.navigate('dashboard', {}, true));
        
        let adminClicks = 0;
        let adminClickTimer = null;
        document.querySelector('.header-brand').addEventListener('click', () => {
            adminClicks++;
            if (adminClickTimer) clearTimeout(adminClickTimer);
            
            if (adminClicks >= 12) {
                adminClicks = 0;
                App.navigate('admin-login');
            } else {
                adminClickTimer = setTimeout(() => {
                    adminClicks = 0;
                }, 400); // Must tap next within 400ms — no gap
            }
        });
    },

    updateClock() {
        const now = new Date();
        this.clock.innerText = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        this.date.innerText = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    },

    update(screenId) {
        if (screenId === 'dashboard' || screenId === 'guide') {
            this.el.classList.add('hidden');
            this.el.classList.remove('admin-header-active');
            return;
        }
        
        this.el.classList.remove('hidden');
        this.backBtn.classList.toggle('hidden', screenId === 'login' || screenId === 'retrieve-login' || screenId === 'admin-login');

        // Pink admin theme toggle
        const isAdminFlow = screenId && screenId.startsWith('admin-');
        this.el.classList.toggle('admin-header-active', isAdminFlow);
        const stepper = document.getElementById('stepper-container');
        if (stepper) stepper.classList.toggle('admin-stepper-active', isAdminFlow);
        
        if (AppState.user && screenId !== 'login' && screenId !== 'retrieve-login' && !isAdminFlow) {
            this.userInfo.classList.remove('hidden');
            this.userCode.innerText = AppState.user.user_code;
        } else {
            this.userInfo.classList.add('hidden');
        }

        const titles = {
            'login': 'Login',
            'create-account': 'Create Account',
            'account': 'Account Overview',
            'select-compartment': 'Select Compartment',
            'rental-type': 'Choose Rental Type',
            'fixed-duration': 'Select Duration',
            'open-time': 'Open Time Rental',
            'payment-method': 'Payment Method',
            'wallet-payment': 'Wallet Payment',
            'cash-payment': 'Cash Payment',
            'rental-confirmed': 'Rental Successful',
            'retrieve-login': 'Login',
            'active-rentals': 'Active Rentals',
            'retrieval-payment': 'Retrieval Payment',
            'retrieval-ready': 'Retrieval Ready',
            'admin-login': 'Admin Login',
            'admin-verify-otp': 'Verification PIN',
            'admin-dashboard': 'Admin Panel',
            'admin-select-compartment': 'Select Compartment',
            'admin-confirm-unlock': 'Confirm Unlock',
            'admin-unlock-steps': 'Emergency Unlock',
            'admin-unlock-done': 'Locker Unlocked',
        };
        this.title.innerText = titles[screenId] || 'Coin Cubby';
    }
};
Header.init();
