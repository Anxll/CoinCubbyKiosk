window.AdminSelectCompartmentScreen = {
    modules: [1, 2],
    currentModuleIdx: 0,
    compartments: [],
    selectedCompartment: null,

    async init() {
        this.currentModuleIdx = 0;
        this.selectedCompartment = null;
        AppState.adminSelectedCompartment = null;
        document.getElementById('btn-admin-confirm-compartment').disabled = true;
        await this.loadCompartments();
    },

    async loadCompartments() {
        const showLoading = App?.showAdminLoading ?? App?.showLoading;
        const hideLoading = App?.hideAdminLoading ?? App?.hideLoading;
        if (showLoading) showLoading.call(App, 'Loading compartments...');

        try {
            const moduleName = this.modules[this.currentModuleIdx];

            document.getElementById('admin-module-name-title').innerText = `Module ${moduleName}`;
            document.getElementById('admin-module-page').innerText = `${this.currentModuleIdx + 1} / ${this.modules.length}`;

            const isFirst = this.currentModuleIdx === 0;
            const isLast = this.currentModuleIdx === this.modules.length - 1;
            
            // Only update arrow buttons (footer buttons removed)
            const arrowPrev = document.getElementById('admin-arrow-prev-module');
            const arrowNext = document.getElementById('admin-arrow-next-module');
            if (arrowPrev) arrowPrev.disabled = isFirst;
            if (arrowNext) arrowNext.disabled = isLast;

            // Change card background class
            const card = document.getElementById('admin-module-card');
            if (card) {
                card.className = 'comp-card-wrapper';
                card.classList.add(`module-bg-${this.currentModuleIdx + 1}`);
            }

            const res = await Api.getCompartments(moduleName);
            this.compartments = res.compartments;
            this.renderGrid();
        } catch (e) {
            console.error('Admin compartment load error:', e);
        } finally {
            const hideLoading = App?.hideAdminLoading ?? App?.hideLoading;
            if (hideLoading) hideLoading.call(App);
        }
    },

    renderGrid() {
        const grid = document.getElementById('admin-compartment-grid');
        let html = '';
        let occupiedCount = 0;

        const sizeOrder = { 'small': 1, 'medium': 2, 'large': 3 };
        const sorted = [...this.compartments].sort((a, b) =>
            (sizeOrder[a.size] || 9) - (sizeOrder[b.size] || 9)
        );

        sorted.forEach(c => {
            if (c.status === 'occupied') occupiedCount++;

            let cls = '', dotCls = '', icon = 'lock_open', clickable = true;

            if (c.status === 'available') {
                cls = 'comp-new-available admin-selectable-available';
                dotCls = 'dot-available';
                icon = 'lock_open';
            } else if (c.status === 'occupied') {
                cls = 'comp-new-occupied admin-selectable-occupied';
                dotCls = 'dot-occupied';
                icon = 'lock';
            } else if (c.status === 'maintenance') {
                cls = 'comp-new-maintenance admin-selectable-maintenance';
                dotCls = 'dot-maintenance';
                icon = 'build';
            }

            if (this.selectedCompartment && String(this.selectedCompartment.id) === String(c.id)) {
                cls += ' admin-comp-selected';
            }

            let sizePill = '';
            let gridCls = 'comp-half-width';
            if (c.size === 'small') {
                sizePill = '<span class="pill-text">Small</span> <span class="pill-circle">S</span>';
                gridCls = 'comp-half-width';
            } else if (c.size === 'medium') {
                sizePill = '<span class="pill-text">Medium</span> <span class="pill-circle">M</span>';
                gridCls = 'comp-full-width';
            } else if (c.size === 'large') {
                sizePill = '<span class="pill-text">Large</span> <span class="pill-circle">L</span>';
                gridCls = 'comp-full-width';
            }

            const onclickAttr = clickable
                ? `onclick="AdminSelectCompartmentScreen.select('${c.id}')"`
                : '';

            html += `
                <div class="comp-new-card ${cls} ${gridCls}" ${onclickAttr}>
                    <div class="comp-new-dot ${dotCls}"></div>
                    <div class="comp-new-center">
                        <span class="material-icons-round comp-new-icon">${icon}</span>
                        <span class="comp-new-code">${c.code}</span>
                    </div>
                    <div class="comp-new-pill">${sizePill}</div>
                </div>
            `;
        });

        grid.innerHTML = html;
        document.getElementById('admin-module-avail-count').innerText = `${occupiedCount} occupied`;
    },

    select(id) {
        const comp = this.compartments.find(c => String(c.id) === String(id));
        if (!comp) return;

        if (comp.status === 'occupied' || comp.status === 'maintenance') {
            let msg = '';
            let icon = 'warning';
            
            if (comp.status === 'occupied') {
                msg = `WARNING: Compartment ${comp.code} is currently OCCUPIED.\n\nAre you sure you want to force unlock it?`;
            } else if (comp.status === 'maintenance') {
                msg = `WARNING: Compartment ${comp.code} is under MAINTENANCE.\n\nAre you sure you want to force unlock it?`;
            }

            App.showConfirmDialog(
                msg,
                'Confirm Unlock Selection',
                icon,
                () => {
                    this.selectedCompartment = comp;
                    this.renderGrid();
                    document.getElementById('btn-admin-confirm-compartment').disabled = false;
                    this.confirm(); 
                }
            );
        } else {
            // Available compartments bypass the warning popup
            this.selectedCompartment = comp;
            this.renderGrid();
            document.getElementById('btn-admin-confirm-compartment').disabled = false;
        }
    },

    nextModule() {
        if (this.currentModuleIdx < this.modules.length - 1) {
            this.currentModuleIdx++;
            this.loadCompartments();
        }
    },

    prevModule() {
        if (this.currentModuleIdx > 0) {
            this.currentModuleIdx--;
            this.loadCompartments();
        }
    },

    confirm() {
        if (!this.selectedCompartment) return;
        const showLoading = App?.showAdminLoading ?? App?.showLoading;
        const hideLoading = App?.hideAdminLoading ?? App?.hideLoading;
        if (showLoading) showLoading.call(App, 'Loading...');
        setTimeout(() => {
            App.navigate('admin-confirm-unlock', { adminSelectedCompartment: this.selectedCompartment });
            if (hideLoading) hideLoading.call(App);
        }, 400);
    }
};
