window.AccountScreen = {
    async init() {
        if (!AppState.user) return App.navigate('dashboard');

        try {
            const refreshedUser = await Api.getUser(AppState.user.user_code);
            if (refreshedUser?.user) {
                AppState.user = { ...AppState.user, ...refreshedUser.user };
            }
        } catch (e) {
            console.error('Error refreshing account info:', e);
        }

        this.render();
    },

    render() {
        const user = AppState.user || {};
        const balance = Number(user.wallet_balance || 0);
        const activeCount = Number(user.active_rental_count || 0);
        const maxRentals = Number(user.max_rentals || 0);

        document.getElementById('account-user-code').innerText = user.user_code || '';
        document.getElementById('account-balance').innerText = `₱${balance.toFixed(2)}`;
        document.getElementById('account-rental-count').innerText = activeCount;

        const dotsContainer = document.getElementById('account-rental-dots');
        let html = '';
        for (let i = 0; i < maxRentals; i++) {
            html += `<div class="rental-dot ${i < activeCount ? 'active' : ''}"></div>`;
        }
        dotsContainer.innerHTML = html;

        const returnBtn = document.getElementById('btn-account-logout');
        if (returnBtn) {
            returnBtn.innerHTML = '<span class="material-icons-round" style="font-size:18px; margin-right:6px;">logout</span> LOGOUT';
        }

        const btn = document.getElementById('btn-select-cubby');
        if (btn) {
            btn.disabled = activeCount >= maxRentals;
            btn.innerHTML = AppState.flow === 'retrieve'
                ? '<span class="material-icons-round" style="font-size: 18px; margin-right: 6px;">inventory_2</span> VIEW RENTALS'
                : '<span class="material-icons-round" style="font-size: 18px; margin-right: 6px;">inventory_2</span> SELECT CUBBY';
        }
    },

    continueFlow() {
        if (AppState.flow === 'retrieve') {
            App.navigate('active-rentals');
        } else {
            App.navigate('select-compartment');
        }
    }
};
