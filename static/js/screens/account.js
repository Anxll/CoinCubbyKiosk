window.AccountScreen = {
    async init() {
        if (!AppState.user) return App.navigate('dashboard');

        // Always fetch fresh data from the server before rendering
        try {
            App.showLoading('Loading account...');
            const res = await Api.getUser(AppState.user.user_code);
            if (res && res.user) {
                // Update AppState with the latest info
                AppState.user = { ...AppState.user, ...res.user };
            }
        } catch (e) {
            console.warn('Could not refresh account data:', e.message);
        } finally {
            App.hideLoading();
        }

        document.getElementById('account-user-code').innerText = AppState.user.user_code;
        document.getElementById('account-balance').innerText = `₱${AppState.user.wallet_balance.toFixed(2)}`;

        const activeCount = AppState.user.active_rental_count;
        const maxRentals = AppState.user.max_rentals;

        document.getElementById('account-rental-count').innerText = activeCount;

        const dotsContainer = document.getElementById('account-rental-dots');
        let html = '';
        for (let i = 0; i < maxRentals; i++) {
            html += `<div class="rental-dot ${i < activeCount ? 'active' : ''}"></div>`;
        }
        dotsContainer.innerHTML = html;

        const btnSelectCubby = document.getElementById('btn-select-cubby');
        if (AppState.flow === 'retrieve') {
            btnSelectCubby.style.display = 'none';
        } else {
            btnSelectCubby.style.display = 'inline-flex';
            btnSelectCubby.disabled = activeCount >= maxRentals;
        }
    }
};
