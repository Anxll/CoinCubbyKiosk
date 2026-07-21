const Stepper = {
    container: document.getElementById('stepper-container'),
    
    rentSteps: ['Login', 'Select', 'Type', 'Details', 'Payment'],
    retrieveSteps: ['Login', 'Rentals', 'Payment'],
    adminSteps: ['Login', 'Select', 'Confirm', 'Unlock'],
    
    update(screenId, flow) {
        // Admin flow stepper
        if (screenId && screenId.startsWith('admin-')) {
            if (screenId === 'admin-dashboard' || screenId === 'admin-unlock-done' || screenId === 'admin-inventory') {
                this.container.classList.add('hidden');
                return;
            }
            this.container.classList.remove('hidden');

            let activeIdx = 0;
            if (screenId === 'admin-login') activeIdx = 0;
            if (screenId === 'admin-select-compartment') activeIdx = 1;
            if (screenId === 'admin-confirm-unlock') activeIdx = 2;
            if (screenId === 'admin-unlock-steps') activeIdx = 3;

            this._render(this.adminSteps, activeIdx, true);
            return;
        }

        // User flow stepper
        if (screenId === 'dashboard' || screenId === 'guide' || screenId === 'create-account' || screenId === 'rental-confirmed' || screenId === 'retrieval-ready' || screenId === 'account') {
            this.container.classList.add('hidden');
            return;
        }
        this.container.classList.remove('hidden');
        
        let steps = flow === 'rent' ? this.rentSteps : this.retrieveSteps;
        let activeIdx = 0;
        
        if (flow === 'rent') {
            if (screenId === 'login') activeIdx = 0;
            if (screenId === 'select-compartment') activeIdx = 1;
            if (screenId === 'rental-type') activeIdx = 2;
            if (screenId === 'fixed-duration' || screenId === 'open-time') activeIdx = 3;
            if (screenId === 'payment-method' || screenId === 'wallet-payment' || screenId === 'cash-payment') activeIdx = 4;
        } else {
            if (screenId === 'retrieve-login') activeIdx = 0;
            if (screenId === 'active-rentals') activeIdx = 1;
            if (screenId === 'retrieval-payment') activeIdx = 2;
        }

        this._render(steps, activeIdx, false);
    },

    _render(steps, activeIdx, isAdmin) {
        let html = '<div class="step-wrapper">';
        steps.forEach((step, idx) => {
            let status = 'upcoming';
            if (idx === activeIdx) status = 'active';
            else if (idx < activeIdx) status = 'completed';

            let icon = status === 'completed'
                ? '<span class="material-icons-round" style="font-size:16px;">check</span>'
                : (idx + 1);

            const adminCls = isAdmin ? 'admin-step-indicator' : '';
            const adminLineCls = isAdmin ? 'admin-step-line' : '';

            html += `
                <div class="step ${status}">
                    <div class="step-indicator ${status === 'active' && isAdmin ? 'admin-step-active-indicator' : ''}">${icon}</div>
                    <div class="step-label">${step}</div>
                </div>
            `;
            
            if (idx < steps.length - 1) {
                html += `<div class="step-line ${idx < activeIdx ? 'completed' : ''}"></div>`;
            }
        });
        html += '</div>';
        this.container.innerHTML = html;
    }
};
