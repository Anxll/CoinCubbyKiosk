window.CompartmentScreen = {
    modules: [1, 2],
    currentModuleIdx: 0,
    compartments: [],

    async init() {
        this.currentModuleIdx = 0;
        AppState.selectedCompartment = null;
        document.getElementById('btn-confirm-compartment').disabled = true;
        await this.loadCompartments();
    },

    async loadCompartments() {
        App.showLoading('Loading compartments...');
        try {
            const moduleName = this.modules[this.currentModuleIdx];
            document.getElementById('module-circle-id').innerText = moduleName;
            document.getElementById('module-name-title').innerText = `Module ${moduleName}`;
            document.getElementById('module-page').innerText = `${this.currentModuleIdx + 1} / ${this.modules.length}`;
            
            document.getElementById('btn-prev-module').disabled = this.currentModuleIdx === 0;
            document.getElementById('btn-next-module').disabled = this.currentModuleIdx === this.modules.length - 1;

            const res = await Api.getCompartments(moduleName);
            this.compartments = res.compartments;
            this.renderGrid();
        } catch (e) {
            console.error(e);
        } finally {
            App.hideLoading();
        }
    },

    renderGrid() {
        const grid = document.getElementById('compartment-grid');
        let html = '';
        let availableCount = 0;
        
        // Sort compartments by size so Small is at the top
        const sizeOrder = { 'small': 1, 'medium': 2, 'large': 3 };
        const sortedCompartments = [...this.compartments].sort((a, b) => {
            return (sizeOrder[a.size] || 9) - (sizeOrder[b.size] || 9);
        });
        
        sortedCompartments.forEach(c => {
            if (c.status === 'available') availableCount++;
            let cls = '';
            let dotCls = '';
            let icon = 'lock_open';
            
            if (c.status === 'available') {
                cls = 'comp-new-available';
                dotCls = 'dot-available';
                icon = 'lock_open';
            } else if (c.status === 'occupied') {
                cls = 'comp-new-occupied';
                dotCls = 'dot-occupied';
                icon = 'lock';
            } else if (c.status === 'maintenance') {
                cls = 'comp-new-maintenance';
                dotCls = 'dot-maintenance';
                icon = 'credit_card'; // Matches the user's yellow reference
            }
            
            if (AppState.selectedCompartment && String(AppState.selectedCompartment.id) === String(c.id)) {
                cls += ' comp-new-selected';
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

            html += `
                <div class="comp-new-card ${cls} ${gridCls}" onclick="CompartmentScreen.select('${c.id}')">
                    <div class="comp-new-dot ${dotCls}"></div>
                    <div class="comp-new-center">
                        <span class="material-icons-round comp-new-icon">${icon}</span>
                        <span class="comp-new-code">${c.code}</span>
                    </div>
                    <div class="comp-new-pill">
                        ${sizePill}
                    </div>
                </div>
            `;
        });
        
        grid.innerHTML = html;
        document.getElementById('module-avail-count').innerText = `${availableCount} available`;
    },

    select(id) {
        // id comes as string from onclick, compartment ids are numbers
        const comp = this.compartments.find(c => String(c.id) === String(id));
        if (!comp || comp.status !== 'available') return;
        
        AppState.selectedCompartment = comp;
        this.renderGrid();
        document.getElementById('btn-confirm-compartment').disabled = false;
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
        if (AppState.selectedCompartment) {
            App.navigate('rental-type');
        }
    }
};

window.SelectCompartmentScreen = window.CompartmentScreen;
