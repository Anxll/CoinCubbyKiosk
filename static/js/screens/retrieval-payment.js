window.RetrievalPaymentScreen = {
    init() {
        if (!AppState.selectedRental) return App.navigate('dashboard');
        
        const r = AppState.selectedRental;
        
        document.getElementById('retrieval-compartment').innerText = r.compartment_code;
        document.getElementById('retrieval-rental-type').innerText = r.rental_type === 'fixed' ? 'Fixed Duration' : 'Open Time';
        
        const start = new Date(r.started_at);
        document.getElementById('retrieval-start-time').innerText = start.toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        
        if (r.rental_type === 'fixed') {
            const overdueMin = Math.round((r.overdue_hours || 0) * 60);
            if (overdueMin > 0) {
                document.getElementById('retrieval-duration').innerText = `${r.duration_hours}h + ${overdueMin} min overdue`;
            } else {
                document.getElementById('retrieval-duration').innerText = `${r.duration_hours}h`;
            }
        } else {
            const elapsedMin = Math.round((r.elapsed_hours || 0) * 60);
            if (elapsedMin < 60) {
                document.getElementById('retrieval-duration').innerText = `${elapsedMin} min`;
            } else {
                const hrs = Math.floor(elapsedMin / 60);
                const mins = elapsedMin % 60;
                document.getElementById('retrieval-duration').innerText = mins > 0 ? `${hrs}h ${mins}min` : `${hrs}h`;
            }
        }
        
        document.getElementById('retrieval-amount-due').innerHTML = `<strong>₱${r.outstanding.toFixed(2)}</strong>`;
    },
    
    openCompartment() {
        // Continue into payment method selection for retrieval flow
        App.navigate('payment-method');
    }
};
