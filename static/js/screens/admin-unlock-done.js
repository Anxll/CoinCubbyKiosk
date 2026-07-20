window.AdminUnlockDoneScreen = {
    init() {
        document.getElementById('admin-done-compartment').innerText =
            AppState.adminUnlockCompartment || '—';
        document.getElementById('admin-done-user').innerText =
            AppState.adminUnlockUser || '—';
        const refund = parseFloat(AppState.adminUnlockRefund || 0);
        document.getElementById('admin-done-refund').innerHTML =
            `<strong>₱${refund.toFixed(2)}</strong>`;
    },

    backToPanel() {
        const showLoading = App?.showAdminLoading ?? App?.showLoading;
        const hideLoading = App?.hideAdminLoading ?? App?.hideLoading;
        if (showLoading) showLoading.call(App, 'Loading...');
        setTimeout(() => {
            AppState.adminSelectedCompartment = null;
            App.navigate('admin-dashboard');
            if (hideLoading) hideLoading.call(App);
        }, 400);
    }
};
