window.DashboardScreen = {
    _adminClicks: 0,
    _adminTimer: null,

    init() {
        this._adminClicks = 0;
        if (this._adminTimer) clearTimeout(this._adminTimer);
        this._adminTimer = null;

        const logo = document.querySelector('#screen-dashboard .dashboard-logo');
        if (logo && !logo._adminListenerAttached) {
            logo._adminListenerAttached = true;
            logo.addEventListener('click', () => this._handleAdminTap());
        }
    },

    _handleAdminTap() {
        this._adminClicks++;

        // Reset the idle timer — must tap again within 400ms
        if (this._adminTimer) clearTimeout(this._adminTimer);

        if (this._adminClicks >= 12) {
            this._adminClicks = 0;
            App.navigate('admin-login');
        } else {
            this._adminTimer = setTimeout(() => {
                this._adminClicks = 0;
            }, 400);
        }
    }
};

