window.AdminDashboardScreen = {
    init() {
        // nothing needed — navigation is handled by buttons
    },

    goToUnlock() {
        App.showAdminLoading('Loading...');
        setTimeout(() => {
            App.navigate('admin-select-compartment');
            App.hideAdminLoading();
        }, 400);
    },

    exitAdmin() {
        App.showAdminLoading('Exiting...');
        setTimeout(() => {
            App.navigate('dashboard', {}, true);
            App.hideAdminLoading();
        }, 400);
    }
};
