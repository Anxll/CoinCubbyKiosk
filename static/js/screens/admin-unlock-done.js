window.AdminUnlockDoneScreen = {
    init() {
        document.getElementById('admin-done-compartment').innerText =
            AppState.adminUnlockCompartment || '—';
        document.getElementById('admin-done-user').innerText =
            AppState.adminUnlockUser || '—';
        const refund = parseFloat(AppState.adminUnlockRefund || 0);
        document.getElementById('admin-done-refund').innerHTML =
            `<strong>₱${refund.toFixed(2)}</strong>`;
    }
};
