window.LockerWarningScreen = {
    _timer: null,
    _reminderTimer: null,
    _seconds: 5,
    _reminderSeconds: 15, // Show reminder after 15 seconds of inactivity

    init() {
        // Reset button state
        const btn = document.getElementById('btn-locker-warning-done');
        const label = document.getElementById('locker-warning-btn-label');
        const badge = document.getElementById('locker-warning-countdown');
        const title = document.getElementById('locker-warning-title');
        
        const compCode = AppState.compartmentCode || 
                         (AppState.selectedRental ? AppState.selectedRental.compartment_code : '') || 
                         (AppState.selectedCompartment ? AppState.selectedCompartment.code : 'your compartment');
                         
        if (title) title.innerText = `⚠️ Compartment ${compCode} is Open!`;
        const subtitle = document.getElementById('locker-warning-subtitle');
        if (subtitle) {
            subtitle.innerHTML = `Please place or take your items, then <strong>make sure to close the door securely on your rented compartment.</strong> 😊`;
        }

        if (btn) btn.disabled = true;
        if (label) label.innerText = 'Door is Closed — DONE';
        if (badge) badge.innerText = this._seconds;

        // Clear any existing timers
        if (this._timer) clearInterval(this._timer);
        if (this._reminderTimer) clearTimeout(this._reminderTimer);

        // Start countdown
        let remaining = this._seconds;

        this._timer = setInterval(() => {
            remaining--;
            if (badge) badge.innerText = remaining;

            if (remaining <= 0) {
                clearInterval(this._timer);
                this._timer = null;
                if (btn) btn.disabled = false;
                if (badge) badge.style.display = 'none';
                
                // Start reminder timer after button becomes available
                this.startReminderTimer();
            }
        }, 1000);

        if (typeof Header !== 'undefined' && Header && typeof Header.update === 'function') {
            Header.update('locker-warning');
        }
    },

    startReminderTimer() {
        // Set up reminder popup after specified seconds
        this._reminderTimer = setTimeout(() => {
            this.showReminderPopup();
        }, this._reminderSeconds * 1000);
    },

    showReminderPopup() {
        const compCode = AppState.compartmentCode || 
                         (AppState.selectedRental ? AppState.selectedRental.compartment_code : '') || 
                         (AppState.selectedCompartment ? AppState.selectedCompartment.code : 'your compartment');
                         
        if (App.showDialog) {
            App.showDialog(
                `Make sure to close the door securely on rented compartment ${compCode} before finishing. Click 'Door is Closed - DONE' when ready.`,
                `Reminder: Close Compartment ${compCode}`,
                'error',
                'GOT IT'
            );
        } else {
            alert(`Reminder: Make sure to close the door securely on rented compartment ${compCode}!`);
        }
        
        // Reset the reminder timer for another reminder
        this.startReminderTimer();
    },

    done() {
        // Clear all timers when user completes the action
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
        if (this._reminderTimer) {
            clearTimeout(this._reminderTimer);
            this._reminderTimer = null;
        }

        // Show the correct post-action dialog based on which flow triggered this screen
        if (AppState._lockerWarningFlow === 'admin') {
            // Admin flow: show the unlock summary screen
            App.navigate('admin-unlock-done');
        } else if (AppState._lockerWarningFlow === 'retrieval') {
            App.showPostRetrievalDialog();
        } else {
            App.showPostRentalDialog();
        }
    }
};
