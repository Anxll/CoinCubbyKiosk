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
    },

    updateClock() {
        const now = new Date();
        this.clock.innerText = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        this.date.innerText = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    },

    update(screenId) {
        if (screenId === 'dashboard') {
            this.el.classList.add('hidden');
            return;
        }
        
        this.el.classList.remove('hidden');
        this.backBtn.classList.toggle('hidden', screenId === 'login' || screenId === 'retrieve-login');
        
        if (AppState.user && screenId !== 'login' && screenId !== 'retrieve-login') {
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
        };
        this.title.innerText = titles[screenId] || 'Coin Cubby';
    }
};
Header.init();
