window.RetrievalReadyScreen = {
    async init() {
        document.getElementById('retrieval-ready-code').innerText = AppState.compartmentCode;
        
        // Print receipt
        try {
            await Api.printReceipt({
                type: 'retrieval',
                compartment_code: AppState.compartmentCode,
                rental_type: AppState.selectedRental ? (AppState.selectedRental.rental_type === 'fixed' ? 'Fixed Duration' : 'Open Time') : 'Unknown',
                started_at: AppState.selectedRental ? new Date(AppState.selectedRental.started_at).toLocaleString() : 'Unknown',
                amount: AppState.amountCharged || 0
            });
        } catch (e) {
            console.error("Printer error:", e);
        }
    },

    async openCompartment() {
        const btn = document.querySelector('#screen-retrieval-ready .btn-open-compartment');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-icons-round">hourglass_empty</span> UNLOCKING...';
        
        try {
            await fetch(`/api/hardware/unlock/${AppState.compartmentCode}`, { method: 'POST' });
            App.navigate('dashboard', {}, true);
        } catch (e) {
            alert(e.message);
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-round">meeting_room</span> OPEN COMPARTMENT';
        }
    }
};
