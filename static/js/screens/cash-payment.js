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

        // Reset visibility of the middle card sections
        document.getElementById('cash-countdown-wrap').classList.remove('hidden');
        document.getElementById('cash-continue-wrap').classList.add('hidden');
        document.getElementById('change-choice-wrap').classList.add('hidden');
        document.getElementById('cash-processing-wrap').classList.add('hidden');
        document.getElementById('btn-cash-cancel').classList.remove('hidden');

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

        // Make the header back button run the same cleanup as cancel
        App.onBackOverride = () => this.cancel();
    },

    updateTimerDisplay() {
        const min = Math.floor(this._timeLeft / 60);
        const sec = this._timeLeft % 60;
        const displayEl = document.getElementById('cash-countdown');
        if (displayEl) {
            displayEl.innerText = `${min}:${sec.toString().padStart(2, '0')}`;
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
            if (inserted >= totalDue && totalDue > 0) {
                this._paymentComplete = true;
                
                // Stop timer
                if (this._timerInterval) {
                    clearInterval(this._timerInterval);
                    this._timerInterval = null;
                }

                // Hide cancel button and countdown wrapper
                document.getElementById('btn-cash-cancel').classList.add('hidden');
                document.getElementById('cash-countdown-wrap').classList.add('hidden');

                if (overpayment > 0) {
                    // Overpayment: show choices
                    document.getElementById('change-amount-label').innerText = `₱${overpayment.toFixed(2)}`;
                    document.getElementById('change-choice-wrap').classList.remove('hidden');
                    document.getElementById('cash-continue-wrap').classList.add('hidden');
                    if (hintEl) {
                        hintEl.innerHTML = `Payment complete. <strong class="text-orange">Select change option</strong> below.`;
                    }
                } else {
                    // Exact payment: show continue button
                    document.getElementById('cash-continue-wrap').classList.remove('hidden');
                    document.getElementById('change-choice-wrap').classList.add('hidden');
                    if (hintEl) {
                        hintEl.innerHTML = `Payment complete. <strong class="text-orange">Press Continue</strong> to finish.`;
                    }
                }
            } else if (inserted > 0) {
                if (hintEl) {
                    hintEl.innerHTML = `₱${inserted.toFixed(2)} inserted. <strong class="text-orange">Insert ₱${remaining.toFixed(2)} more</strong> to complete payment.`;
                }
                document.getElementById('cash-countdown-wrap').classList.remove('hidden');
                document.getElementById('cash-continue-wrap').classList.add('hidden');
                document.getElementById('change-choice-wrap').classList.add('hidden');
            } else {
                if (hintEl) {
                    hintEl.innerText = "Insert coins or bills into the machine";
                }
                document.getElementById('cash-countdown-wrap').classList.remove('hidden');
                document.getElementById('cash-continue-wrap').classList.add('hidden');
                document.getElementById('change-choice-wrap').classList.add('hidden');
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

    async chooseCoins() {
        const overpayment = AppState.cashWalletCredit || 0;
        
        // Hide options, show processing
        document.getElementById('change-choice-wrap').classList.add('hidden');
        const procWrap = document.getElementById('cash-processing-wrap');
        procWrap.classList.remove('hidden');
        document.getElementById('cash-processing-title').innerText = "Dispensing change...";
        document.getElementById('cash-processing-subtitle').innerText = `Dispensing ₱${(Math.floor(overpayment / 5) * 5).toFixed(2)} in ₱5 coins. Please wait...`;

        let walletCreditRemainder = 0;
        try {
            const res = await Api.request('/hardware/change/dispense', {
                method: 'POST',
                body: JSON.stringify({ amount: overpayment })
            });
            walletCreditRemainder = Number(res.wallet_credit || 0);
        } catch (err) {
            console.error("Change dispenser error, falling back to wallet credit:", err);
            walletCreditRemainder = overpayment;
            alert("Change dispenser issue. Remaining change has been credited to your wallet balance.");
        }

        await this.processSuccess(walletCreditRemainder);
    },

    async chooseWallet() {
        const overpayment = AppState.cashWalletCredit || 0;

        // Hide options, show processing
        document.getElementById('change-choice-wrap').classList.add('hidden');
        const procWrap = document.getElementById('cash-processing-wrap');
        procWrap.classList.remove('hidden');
        document.getElementById('cash-processing-title').innerText = "Crediting to wallet...";
        document.getElementById('change-choice-wrap').classList.add('hidden');
        document.getElementById('cash-processing-subtitle').innerText = "Adding change to your account balance.";

        await this.processSuccess(overpayment);
    },

    async continue() {
        if (!this._paymentComplete || AppState.cashInserted < AppState.totalDue) {
            return;
        }
        
        // Hide continue wrap, show processing
        document.getElementById('cash-continue-wrap').classList.add('hidden');
        const procWrap = document.getElementById('cash-processing-wrap');
        procWrap.classList.remove('hidden');
        document.getElementById('cash-processing-title').innerText = "Processing payment...";
        document.getElementById('cash-processing-subtitle').innerText = "Finishing transaction details.";

        await this.processSuccess(0);
    },

    async processSuccess(walletCreditRemainder = 0) {
        App.showLoading('Processing payment...');
        try {
            AppState.paymentMethod = 'cash';
            const finalCashInserted = AppState.totalDue + walletCreditRemainder;
            
            this.cleanup();
            await Api.stopCash();
            
            if (AppState.flow === 'rent') {
                const res = await Api.createRental({
                    user_id: AppState.user.id,
                    compartment_id: AppState.selectedCompartment.id,
                    rental_type: 'fixed',
                    duration_hours: AppState.durationHours,
                    payment_method: 'cash',
                    cash_inserted: finalCashInserted
                });
                if (typeof res.new_wallet_balance === 'number') {
                    AppState.user.wallet_balance = res.new_wallet_balance;
                }
                AppState.cashWalletCredit = Number(res.wallet_credit || 0);
                App.navigate('rental-confirmed', { paymentMethod: 'cash' });
            } else {
                const res = await Api.retrieveRental(
                    AppState.selectedRental.id,
                    'cash',
                    AppState.user.id,
                    finalCashInserted
                );
                if (typeof res.new_wallet_balance === 'number') {
                    AppState.user.wallet_balance = res.new_wallet_balance;
                }
                AppState.cashWalletCredit = Number(res.wallet_credit || 0);
                App.navigate('retrieval-ready', { amountCharged: res.amount_charged, compartmentCode: res.compartment_code });
            }
        } catch (e) {
            App.hideLoading();
            alert(e.message);
            // In case of error, show cancel button and restore previous state
            document.getElementById('btn-cash-cancel').classList.remove('hidden');
            document.getElementById('cash-processing-wrap').classList.add('hidden');
            if (AppState.cashWalletCredit > 0) {
                document.getElementById('change-choice-wrap').classList.remove('hidden');
            } else {
                document.getElementById('cash-continue-wrap').classList.remove('hidden');
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
        App.onBackOverride = null;
    }
};
