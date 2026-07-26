window.PaymentMethodScreen = {
    inventoryWarningShown: false,
    
    async init() {
        if (AppState.flow === 'rent' && !AppState.selectedCompartment) return App.navigate('dashboard');
        if (AppState.flow === 'retrieve' && !AppState.selectedRental) return App.navigate('dashboard');

        // Reset per-session so the warning always shows when needed
        this.inventoryWarningShown = false;
        AppState.insufficientInventory = false;

        const isRetrieveFlow = AppState.flow === 'retrieve';
        const compartmentCode = isRetrieveFlow ? AppState.selectedRental.compartment_code : AppState.selectedCompartment.code;

        document.getElementById('payment-compartment').innerText = compartmentCode;

        const durationRow = document.getElementById('payment-duration-row');
        const durationLabel = durationRow.querySelector('.summary-label');
        const durationValue = document.getElementById('payment-duration');
        const feeValue = document.getElementById('payment-rental-fee');
        const totalValue = document.getElementById('payment-total');

        durationRow.style.display = 'flex';

        if (isRetrieveFlow) {
            const rental = AppState.selectedRental;
            const total = Number(rental.outstanding || 0);

            document.getElementById('payment-rental-type').innerText = rental.rental_type === 'fixed' ? 'Retrieval - Fixed Duration' : 'Retrieval - Open Time';
            durationLabel.innerText = rental.rental_type === 'fixed' ? 'Duration' : 'Time Used';
            durationValue.innerText = rental.rental_type === 'fixed'
                ? `${rental.duration_hours || 0}h${rental.overdue_hours ? ` + ${rental.overdue_hours}h overdue` : ''}`
                : `${rental.elapsed_hours || 0} hour(s)`;
            feeValue.innerText = `₱${total.toFixed(2)}`;
            totalValue.innerHTML = `<strong>₱${total.toFixed(2)}</strong>`;

            AppState.totalDue = total;
        } else {
            if (AppState.rentalType === 'fixed') {
                const tier = AppState.rentalPricing.fixed_duration_tiers.find(t => t.hours === AppState.durationHours);
                const total = tier.price;

                document.getElementById('payment-rental-type').innerText = 'Fixed Duration';
                durationLabel.innerText = 'Duration';
                durationValue.innerText = tier.label;
                feeValue.innerText = `₱${tier.price}`;
                totalValue.innerHTML = `<strong>₱${total}</strong>`;

                AppState.totalDue = total;
            }
        }
        
        // Check inventory for change availability
        await this.checkInventoryStatus();
    },
    
    async checkInventoryStatus() {
        if (this.inventoryWarningShown) return; // Don't check again if already shown
        
        try {
            const response = await Api.request('/inventory/status');
            const availableBalance = Number(response.change_amount || 0);
            
            // Calculate the minimum threshold based on payment amount
            // We need at least ₱20 to dispense change (minimum dispense amount)
            // For safety, warn if inventory is below ₱20 or less than what could be needed for common overpayment scenarios
            const MINIMUM_DISPENSE = 20; // Minimum amount the dispenser can give
            const amountDue = AppState.totalDue || 0;
            
            // Check if inventory is insufficient
            // Show warning if: 
            // 1. Less than minimum dispense amount (₱20), OR
            // 2. Less than the total due (can't give full change if someone overpays)
            if (availableBalance < MINIMUM_DISPENSE || availableBalance < amountDue) {
                this.inventoryWarningShown = true;
                AppState.insufficientInventory = true;
                
                let warningMessage = `Current coin inventory: ₱${availableBalance.toFixed(2)}. `;
                
                if (availableBalance < MINIMUM_DISPENSE) {
                    warningMessage += `Minimum dispense amount is ₱${MINIMUM_DISPENSE}. `;
                }
                
                warningMessage += `If you overpay with cash, your change will be added to your wallet instead.`;
                
                if (App.showDialog) {
                    App.showDialog(
                        warningMessage,
                        "Insufficient Coins for Change",
                        "warning",
                        "UNDERSTOOD"
                    );
                } else {
                    alert(warningMessage);
                }
            } else {
                AppState.insufficientInventory = false;
            }
        } catch (err) {
            console.error("Could not check inventory status:", err);
            // If we can't check, assume there might be issues
            AppState.insufficientInventory = true;
        }
    }
};
