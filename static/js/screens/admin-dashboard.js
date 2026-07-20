window.AdminDashboardScreen = {
    init() {
        // nothing needed — navigation is handled by buttons
    },

    goToUnlock() {
        const showLoading = App?.showAdminLoading ?? App?.showLoading;
        const hideLoading = App?.hideAdminLoading ?? App?.hideLoading;
        if (showLoading) showLoading.call(App, 'Loading...');
        setTimeout(() => {
            App.navigate('admin-select-compartment');
            if (hideLoading) hideLoading.call(App);
        }, 400);
    },

    exitAdmin() {
        const showLoading = App?.showAdminLoading ?? App?.showLoading;
        const hideLoading = App?.hideAdminLoading ?? App?.hideLoading;
        if (showLoading) showLoading.call(App, 'Exiting...');
        setTimeout(() => {
            App.navigate('dashboard', {}, true);
            if (hideLoading) hideLoading.call(App);
        }, 400);
    }
};
