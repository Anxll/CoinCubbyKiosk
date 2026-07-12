window.CashPaymentScreen = {
    evtSource: null,
    _keyHandler: null,
    _timerInterval: null,
    _timeLeft: 60, // 1 minute in seconds
    _lastInserted: 0,
    _paymentComplete: false,

    async init() {
        const due = AppState.totalDue;
        AppState.cashInserted = 0;
        AppState.cashWalletCredit = 0;
        this._lastInserted = 0;
        this._paymentComplete = false;

        document.getElementById('cash-amount-due').innerText = `₱${due.toFixed(2)}`;
        document.getElementById('cash-inserted').innerText = `₱0.00`;
        document.getElementById('cash-remaining').innerText = `₱${due.toFixed(2)}`;
        document.getElementById('cash-progress').style.width = '0%';
        this._setContinueVisible(false);

        const hintEl = document.querySelector('.cash-hint');
        if (hintEl) {
            hintEl.innerText = "Insert coins or bills into the machine";
        }

        // Initialize and start the 1-minute countdown timer
        this._timeLeft = 60; 
        this.updateTimerDisplay();
        
        if (this._timerInterval) clearInterval(this._timerInterval);
        this._timerInterval = setInterval(() => {
            this._timeLeft--;
            this.updateTimerDisplay();
            if (this._timeLeft <= 0) {
                console.log("Cash payment session timed out.");
                this.cancel();
            }
        }, 1000);

        // Listen for function-key test input on keydown: F13/F8 = bill, F14/F9 = coin
        this._keyHandler = async (e) => {
            console.log("Key pressed on cash screen:", e.key, "Code:", e.code);
            const isBillKey = e.key === 'F13' || e.key === 'F8' || e.code === 'F13' || e.code === 'F8';
            const isCoinKey = e.key === 'F14' || e.key === 'F9' || e.code === 'F14' || e.code === 'F9';

            if (isBillKey) {
                e.preventDefault();
                console.log("Bill key detected: Inserting ₱10 bill...");
                try {
                    await Api.insertCash(10);
                } catch (err) {
                    console.error("API error inserting bill:", err);
                }
            } else if (isCoinKey) {
                e.preventDefault();
                console.log("Coin key detected: Inserting ₱5 coin...");
                try {
                    await Api.insertCash(5);
                } catch (err) {
                    console.error("API error inserting coin:", err);
                }
            }
        };
        document.addEventListener('keydown', this._keyHandler);

        try {
            await Api.startCash(due);
            this.startStream();
        } catch (e) {
            alert('Hardware Error: ' + e.message);
        }
    },

    updateTimerDisplay() {
        const min = Math.floor(this._timeLeft / 60);
        const sec = this._timeLeft % 60;
        const displayEl = document.getElementById('cash-countdown');
        if (displayEl) {
            displayEl.innerText = `${min}:${sec.toString().padStart(2, '0')}`;
        }
    },

    _setContinueVisible(visible) {
        const button = document.getElementById('btn-cash-continue');
        if (button) {
            button.classList.toggle('hidden', !visible);
            button.disabled = !visible;
        }
    },

    startStream() {
        const token = encodeURIComponent(Api.getKioskToken());
        this.evtSource = new EventSource(`/api/hardware/cash/status?token=${token}`);
        this.evtSource.onmessage = async (e) => {
            const data = JSON.parse(e.data);
            const inserted = Number(data.inserted || 0);
            const remaining = Number(data.remaining || 0);
            const overpayment = Number(data.overpayment || 0);
            const totalDue = Number(AppState.totalDue || data.target || 0);
            const changed = inserted !== this._lastInserted;

            AppState.cashInserted = inserted;
            AppState.cashWalletCredit = overpayment;
            this._lastInserted = inserted;

            document.getElementById('cash-inserted').innerText = `₱${inserted.toFixed(2)}`;
            document.getElementById('cash-remaining').innerText = `₱${remaining.toFixed(2)}`;

            const pct = totalDue > 0 ? Math.min(100, (inserted / totalDue) * 100) : 0;
            document.getElementById('cash-progress').style.width = `${pct}%`;

            if (changed && !this._paymentComplete) {
                this._timeLeft = 60;
                this.updateTimerDisplay();
            }

            // Update user instruction dynamically after cash is inserted
            const hintEl = document.querySelector('.cash-hint');
            if (hintEl) {
                if (inserted >= totalDue && totalDue > 0) {
                    const creditText = overpayment > 0 ? ` Wallet credit: ₱${overpayment.toFixed(2)}.` : '';
                    hintEl.innerHTML = `Payment complete. <strong class="text-orange">Press Continue</strong> to finish.${creditText}`;
                    this._paymentComplete = true;
                    this._setContinueVisible(true);
                    if (this._timerInterval) {
                        clearInterval(this._timerInterval);
                        this._timerInterval = null;
                    }
                } else if (inserted > 0) {
                    hintEl.innerHTML = `₱${inserted.toFixed(2)} inserted. <strong class="text-orange">Insert ₱${remaining.toFixed(2)} more</strong> to complete payment.`;
                    this._setContinueVisible(false);
                } else {
                    hintEl.innerText = "Insert coins or bills into the machine";
                    this._setContinueVisible(false);
                }
            }
        };

        this.evtSource.onerror = (e) => {
            console.error("Cash status stream disconnected or unauthorized:", e);
            const hintEl = document.querySelector('.cash-hint');
            if (hintEl) {
                hintEl.innerText = "Cash detector connection lost. Please ask for assistance.";
            }
        };
    },

    async continue() {
        if (!this._paymentComplete || AppState.cashInserted < AppState.totalDue) {
            return;
        }
        const button = document.getElementById('btn-cash-continue');
        if (button) {
            button.disabled = true;
            button.innerHTML = '<span class="material-icons-round">hourglass_empty</span> PROCESSING...';
        }
        await this.processSuccess();
    },

    async processSuccess() {
        try {
            AppState.paymentMethod = 'cash';
            this.cleanup();
            await Api.stopCash();
            if (AppState.flow === 'rent') {
                const res = await Api.createRental({
                    user_id: AppState.user.id,
                    compartment_id: AppState.selectedCompartment.id,
                    rental_type: 'fixed',
                    duration_hours: AppState.durationHours,
                    payment_method: 'cash',
                    cash_inserted: AppState.cashInserted
                });
                if (typeof res.new_wallet_balance === 'number') {
                    AppState.user.wallet_balance = res.new_wallet_balance;
                }
                AppState.cashWalletCredit = Number(res.wallet_credit || AppState.cashWalletCredit || 0);
                App.navigate('rental-confirmed', { paymentMethod: 'cash' });
            } else {
                const res = await Api.retrieveRental(
                    AppState.selectedRental.id,
                    'cash',
                    AppState.user.id,
                    AppState.cashInserted
                );
                if (typeof res.new_wallet_balance === 'number') {
                    AppState.user.wallet_balance = res.new_wallet_balance;
                }
                AppState.cashWalletCredit = Number(res.wallet_credit || AppState.cashWalletCredit || 0);
                App.navigate('retrieval-ready', { amountCharged: res.amount_charged, compartmentCode: res.compartment_code });
            }
        } catch (e) {
            alert(e.message);
            const button = document.getElementById('btn-cash-continue');
            if (button) {
                button.disabled = false;
                button.innerHTML = 'CONTINUE';
            }
        }
    },

    async cancel() {
        this.cleanup();
        await Api.stopCash();
        App.goBack();
    },

    cleanup() {
        if (this.evtSource) {
            this.evtSource.close();
            this.evtSource = null;
        }
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
    }
};
