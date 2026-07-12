window.RetrievalPaymentScreen = {
    init() {
        if (!AppState.selectedRental) return App.navigate('dashboard');
        
        const r = AppState.selectedRental;
        
        document.getElementById('retrieval-compartment').innerText = r.compartment_code;
        document.getElementById('retrieval-rental-type').innerText = r.rental_type === 'fixed' ? 'Fixed Duration' : 'Open Time';
        
        const start = new Date(r.started_at);
        document.getElementById('retrieval-start-time').innerText = start.toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        
        if (r.rental_type === 'fixed') {
            document.getElementById('retrieval-duration').innerText = `${r.duration_hours}h + ${r.overdue_hours}h Overdue`;
        } else {
            document.getElementById('retrieval-duration').innerText = `${r.elapsed_hours} hour(s)`;
        }
        
        document.getElementById('retrieval-amount-due').innerHTML = `<strong>₱${r.outstanding.toFixed(2)}</strong>`;
    },
    
    openCompartment() {
        // Continue into payment method selection for retrieval flow
        App.navigate('payment-method');
    }
};
