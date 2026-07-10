window.RentalConfirmedScreen = {
    async init() {
        document.getElementById('confirmed-compartment').innerText = AppState.selectedCompartment.code;
        
        if (AppState.rentalType === 'fixed') {
            document.getElementById('confirmed-rental-type').innerText = 'Fixed Duration';
            const expires = new Date(Date.now() + AppState.durationHours * 3600 * 1000);
            document.getElementById('confirmed-retrieval-time').innerText = expires.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } else {
            document.getElementById('confirmed-rental-type').innerText = 'Open Time';
            document.getElementById('confirmed-retrieval-time').innerText = 'N/A';
        }

        // Print receipt
        try {
            await Api.printReceipt({
                type: 'rental',
                compartment_code: AppState.selectedCompartment.code,
                rental_type: AppState.rentalType === 'fixed' ? 'Fixed Duration' : 'Open Time',
                duration: AppState.rentalType === 'fixed' ? `${AppState.durationHours} hours` : null,
                total: AppState.totalDue,
                payment_method: AppState.paymentMethod || 'None'
            });
        } catch (e) {
            console.error("Printer error:", e);
        }
    },

    async openCompartment() {
        const btn = document.getElementById('btn-open-compartment');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-icons-round">hourglass_empty</span> UNLOCKING...';
        
        try {
            await fetch(`/api/hardware/unlock/${AppState.selectedCompartment.code}`, { method: 'POST' });
            App.navigate('dashboard', {}, true);
        } catch (e) {
            alert(e.message);
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-round">meeting_room</span> OPEN COMPARTMENT';
        }
    }
};
