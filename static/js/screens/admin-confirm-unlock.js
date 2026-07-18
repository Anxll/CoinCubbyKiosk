window.AdminConfirmUnlockScreen = {
    rental: null,

    async init() {
        const comp = AppState.adminSelectedCompartment;
        if (!comp) return App.navigate('admin-select-compartment');

        document.getElementById('admin-confirm-compartment').innerText = comp.code || '—';

        // Try to fetch rental info for the occupied compartment
        try {
            const res = await Api.getCompartmentRental(comp.id);
            this.rental = res.rental;

            if (this.rental) {
                document.getElementById('admin-confirm-user').innerText =
                    this.rental.user_code || this.rental.user_id || '—';
                document.getElementById('admin-confirm-type').innerText =
                    this.rental.rental_type === 'fixed' ? 'Fixed Duration' : 'Open Time';
                document.getElementById('admin-confirm-start').innerText =
                    new Date(this.rental.start_time).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    });
                const refund = parseFloat(this.rental.amount_paid || 0);
                document.getElementById('admin-confirm-refund').innerHTML =
                    `<strong>₱${refund.toFixed(2)}</strong>`;
            } else {
                document.getElementById('admin-confirm-user').innerText = 'No Active User';
                document.getElementById('admin-confirm-type').innerText = '—';
                document.getElementById('admin-confirm-start').innerText = '—';
                document.getElementById('admin-confirm-refund').innerHTML = '<strong>₱0.00</strong>';
            }

        } catch (e) {
            // Fallback — no rental info available from API yet
            document.getElementById('admin-confirm-user').innerText = 'N/A';
            document.getElementById('admin-confirm-type').innerText = 'N/A';
            document.getElementById('admin-confirm-start').innerText = 'N/A';
            document.getElementById('admin-confirm-refund').innerHTML = '<strong>₱0.00</strong>';
            this.rental = null;
        }
    },

    proceed() {
        App.navigate('admin-unlock-steps');
    }
};
