window.FixedDurationScreen = {
    pricing: null,
    hours: 0,
    days: 0,
    
    async init() {
        if (!AppState.selectedCompartment) return App.navigate('dashboard');
        
        document.getElementById('duration-compartment').innerText = `Compartment: ${AppState.selectedCompartment.code}`;
        document.getElementById('btn-confirm-duration').disabled = true;
        
        // Reset values
        this.hours = 0;
        this.days = 0;
        AppState.durationHours = null;
        
        App.showLoading('Loading pricing...');
        try {
            const pricing = await Api.getPricing(AppState.selectedCompartment.id);
            this.pricing = pricing;
            AppState.rentalPricing = pricing;
            this.render();
        } catch (e) {
            console.error(e);
            App.showDialog('Failed to load pricing information', 'Error', 'error');
        } finally {
            App.hideLoading();
        }
    },

    render() {
        document.getElementById('duration-hours-display').innerText = this.hours;
        document.getElementById('duration-days-display').innerText = this.days;
        
        const totalHours = (this.days * 24) + this.hours;
        const price = this.calculatePrice(totalHours);
        
        // Calculate individual costs using rate_per_hour from database
        const hourlyRate = this.pricing ? (this.pricing.rate_per_hour || 10) : 10;
        const dailyRate = hourlyRate * 24;
        
        const daysCost = this.days * dailyRate;
        const hoursCost = this.hours * hourlyRate;
        
        // Update main price display
        document.getElementById('duration-price-display').innerText = `₱${price}`;
        
        // Update breakdown
        document.getElementById('duration-breakdown-days').innerText = `${this.days} day${this.days !== 1 ? 's' : ''}`;
        document.getElementById('duration-rate-per-day').innerText = `₱${dailyRate}`;
        document.getElementById('duration-days-cost').innerText = `₱${daysCost}`;
        
        document.getElementById('duration-breakdown-hours').innerText = `${this.hours} hour${this.hours !== 1 ? 's' : ''}`;
        document.getElementById('duration-rate-per-hour').innerText = `₱${hourlyRate}`;
        document.getElementById('duration-hours-cost').innerText = `₱${hoursCost}`;
        
        document.getElementById('duration-total-display').innerText = `₱${price}`;
        
        // Enable confirm button if total hours > 0
        document.getElementById('btn-confirm-duration').disabled = totalHours === 0;
        
        // Store total hours in AppState
        AppState.durationHours = totalHours;
    },

    calculatePrice(totalHours) {
        if (!this.pricing || totalHours === 0) return 0;
        
        // Use rate_per_hour from pricing API (from database)
        const hourlyRate = this.pricing.rate_per_hour || 10;
        return totalHours * hourlyRate;
    },

    incrementHours() {
        if (this.hours < 23) {
            this.hours++;
        } else {
            // When hours reach 24, roll over to next day only if under 3 days limit
            if (this.days < 3) {
                this.hours = 0;
                this.days++;
            }
            // If already at 3 days, don't increment
        }
        this.render();
    },

    decrementHours() {
        if (this.hours > 0) {
            this.hours--;
        } else if (this.days > 0) {
            this.hours = 23;
            this.days--;
        }
        this.render();
    },

    incrementDays() {
        if (this.days < 3) { // Max 3 days
            this.days++;
            this.render();
        }
    },

    decrementDays() {
        if (this.days > 0) {
            this.days--;
            this.render();
        }
    },

    confirm() {
        const totalHours = (this.days * 24) + this.hours;
        if (totalHours > 0) {
            AppState.durationHours = totalHours;
            App.navigate('payment-method', { rentalType: 'fixed' });
        }
    }
};
