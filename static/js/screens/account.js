window.AccountScreen = {
    init() {
        if (!AppState.user) return App.navigate('dashboard');
        
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
        
        document.getElementById('btn-select-cubby').disabled = activeCount >= maxRentals;
    }
};
