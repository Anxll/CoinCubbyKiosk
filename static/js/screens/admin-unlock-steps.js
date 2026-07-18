window.AdminUnlockStepsScreen = {
    steps: [
        {
            icon: 'search',
            title: 'Locate the Locker',
            desc: 'Go to the physical module unit and find the compartment shown above.',
        },
        {
            icon: 'warning_amber',
            title: 'Verify Unlock Reason',
            desc: 'Confirm the reason for unlock is valid (admin override, maintenance, emergency, etc.).',
        },
        {
            icon: 'meeting_room',
            title: 'Open the Compartment Door',
            desc: 'The electronic lock will release. Gently pull the compartment door open.',
        },
    ],
    completedSteps: new Set(),

    init() {
        const comp = AppState.adminSelectedCompartment;
        if (!comp) return App.navigate('admin-select-compartment');

        document.getElementById('admin-steps-compartment-badge').innerText = `Compartment ${comp.code}`;
        // Button is ALWAYS enabled immediately — no checklist gate required
        document.getElementById('btn-admin-complete-unlock').disabled = false;
        this.completedSteps = new Set();
        this.renderSteps();
    },

    renderSteps() {
        const container = document.getElementById('admin-steps-list');
        let html = '';

        this.steps.forEach((step, idx) => {
            const done = this.completedSteps.has(idx);
            const statusCls = done ? 'admin-step-done' : '';
            const checkHtml = done
                ? '<span class="material-icons-round admin-step-check-icon">check_circle</span>'
                : `<div class="admin-step-number">${idx + 1}</div>`;

            html += `
                <div class="admin-step-item ${statusCls}" id="admin-step-${idx}" onclick="AdminUnlockStepsScreen.toggleStep(${idx})">
                    <div class="admin-step-left">
                        ${checkHtml}
                        <div class="admin-step-icon-wrap">
                            <span class="material-icons-round">${step.icon}</span>
                        </div>
                    </div>
                    <div class="admin-step-content">
                        <div class="admin-step-title">${step.title}</div>
                        <div class="admin-step-desc">${step.desc}</div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    toggleStep(idx) {
        if (this.completedSteps.has(idx)) {
            this.completedSteps.delete(idx);
        } else {
            this.completedSteps.add(idx);
        }
        this.renderSteps();
        // Button always stays enabled regardless of checklist state
        document.getElementById('btn-admin-complete-unlock').disabled = false;
    },

    async completeUnlock() {
        const comp = AppState.adminSelectedCompartment;
        const btn = document.getElementById('btn-admin-complete-unlock');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-icons-round">hourglass_empty</span> PROCESSING...';

        try {
            // Call API to emergency-unlock and void/refund if occupied
            const res = await Api.adminEmergencyUnlock(comp.id);
            const refund = res.refunded_amount || 0;
            const userCode = res.user_code || '—';

            App.navigate('admin-unlock-done', {
                adminUnlockRefund: refund,
                adminUnlockUser: userCode,
                adminUnlockCompartment: comp.code
            });
        } catch (e) {
            console.error('Emergency unlock error:', e);
            alert('Failed to execute unlock: ' + (e.message || e));
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-round">lock_open</span> CONFIRM & OPEN LOCKER';
        }
    }
};
