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

        const badge = document.getElementById('admin-steps-compartment-badge');
        if (badge) badge.innerText = `Compartment ${comp.code}`;
        const errEl = document.getElementById('admin-steps-error');
        if (errEl) errEl.innerText = '';

        // Always reset the confirm button so second unlock doesn't find it stuck disabled
        const btn = document.getElementById('btn-admin-complete-unlock');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-round">lock_open</span> CONFIRM & OPEN LOCKER';
        }

        this.completedSteps = new Set();
        this.renderSteps();
    },

    renderSteps() {
        const container = document.getElementById('admin-steps-list');
        if (!container) return;
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
                        <div class="admin-step-desc" style="font-size: 13px;">${step.desc}</div>
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
    },

    async completeUnlock() {
        const errEl = document.getElementById('admin-steps-error');
        if (errEl) errEl.innerText = '';
        
        if (this.completedSteps.size < this.steps.length) {
            if (errEl) errEl.innerText = 'Please check all steps before confirming unlock.';
            return;
        }

        const comp = AppState.adminSelectedCompartment;
        const btn = document.getElementById('btn-admin-complete-unlock');
        btn.disabled = true;
        btn.innerHTML = 'CONFIRMING...';

        const showLoading = App?.showAdminLoading ?? App?.showLoading;
        const hideLoading = App?.hideAdminLoading ?? App?.hideLoading;
        if (showLoading) showLoading.call(App, 'Emergency unlocking...');

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
            if (errEl) errEl.innerText = 'Failed to execute unlock: ' + (e.message || e);
        } finally {
            if (hideLoading) hideLoading.call(App);
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-round">lock_open</span> CONFIRM & OPEN LOCKER';
        }
    }
};
