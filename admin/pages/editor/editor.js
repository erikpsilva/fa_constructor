$(document).ready(function () {
    Editor.init(PAGE_ID, PAGE_DATA);
});

const Editor = {

    pageId:         null,
    data:           [],
    state:          { mode: 'default', selected: null, selectedCols: 1 },
    selectedLayout: 'container',
    quill:          null,

    // ── Init ─────────────────────────────────────────────────
    init(pageId, data) {
        this.pageId = pageId;
        this.data   = data;
        this.renderPanel();
        this.renderPreview();
        this.bindEvents();
    },

    // ── Left panel (all tools) ────────────────────────────────
    renderPanel() {
        this.quill = null;
        const { mode, selected } = this.state;
        let html = '';
        if      (mode === 'default')         html = this.panelStructure();
        else if (mode === 'add-section')     html = this.panelAddSection();
        else if (mode === 'section')         html = this.panelSection(selected);
        else if (mode === 'column')          html = this.panelColumn(selected);
        else if (mode === 'column-settings') html = this.panelColumnSettings(selected);
        else if (mode === 'element')         html = this.panelElement(selected);
        $('#editorPanel').html(html);

        this._syncPreviewSelection();

        if (mode === 'element' && selected && selected.element.plugin_type === 'text') {
            this.initQuill(selected.element);
        }
    },

    // Default: structure tree
    panelStructure() {
        if (!this.data.length) {
            return `
                <div class="panelBody">
                    <div class="panelSection">
                        <p class="panelHint">Nenhuma seção ainda.<br>Clique em + Nova Seção para começar.</p>
                    </div>
                </div>
                <div class="panelFooter">
                    <button class="btn btn--primary btn--full" id="btnShowAddSection">+ Nova Seção</button>
                </div>`;
        }

        const items = this.data.map(s => {
            const cols = s.columns.map(c => {
                const total = c.elements.length;
                const elems = c.elements.map((e, idx) => {
                    const isActive = this._isSelectedElement(e.id);
                    const canUp    = idx > 0;
                    const canDown  = idx < total - 1;
                    return `
                        <div class="structureElement ${isActive ? 'active' : ''}" data-element-id="${e.id}">
                            <span class="structureElement__badge">${this.escHtml(e.plugin_type)}</span>
                            <span class="structureElement__label">${this._elementPreviewLabel(e)}</span>
                            <div class="structureElement__order">
                                <button class="btnMoveUp" data-element-id="${e.id}" ${canUp ? '' : 'disabled'} title="Mover para cima">↑</button>
                                <button class="btnMoveDown" data-element-id="${e.id}" ${canDown ? '' : 'disabled'} title="Mover para baixo">↓</button>
                            </div>
                        </div>`;
                }).join('');

                return `
                    <div class="structureCol" data-column-id="${c.id}">
                        <div class="structureCol__header">
                            <span>${this._colLabel(c.col_size)}</span>
                            <button class="structureCol__gear btnColumnSettings" data-column-id="${c.id}" title="Configurações da coluna">⚙</button>
                        </div>
                        ${total ? `<div class="structureCol__elements">${elems}</div>` : ''}
                        <button class="structureCol__add btnAddElement" data-column-id="${c.id}">+ Novo elemento</button>
                    </div>`;
            }).join('');

            const isSecSel = this._isSelectedSection(s.id);
            return `
                <div class="structureSection">
                    <div class="structureSection__header ${isSecSel ? 'active' : ''}">
                        <span>${this.escHtml(s.name)}</span>
                        <button class="structureSection__gear btnSectionSettings" data-section-id="${s.id}">⚙</button>
                    </div>
                    <div class="structureSection__cols">${cols}</div>
                </div>`;
        }).join('');

        return `
            <div class="panelBody">
                <div class="structureList">${items}</div>
            </div>
            <div class="panelFooter">
                <button class="btn btn--primary btn--full" id="btnShowAddSection">+ Nova Seção</button>
            </div>`;
    },

    panelAddSection() {
        const colBtns = [1,2,3,4,5,6].map(n =>
            `<button class="colPicker__btn ${n === this.state.selectedCols ? 'active' : ''}" data-cols="${n}">
                ${n}${n === 5 ? '<small>⊞</small>' : ''}
             </button>`
        ).join('');
        const layoutBtns = this._layoutOptions().map(l =>
            `<button class="layoutBtn ${this.selectedLayout === l.value ? 'active' : ''}" data-layout="${l.value}">
                <strong>${l.label}</strong><span>${l.desc}</span>
             </button>`
        ).join('');
        return `
            <div class="panelBody">
                <div class="panelSection">
                    <h4>Nova Seção</h4>
                    <div class="panelField">
                        <label>Nome (só para controle)</label>
                        <input class="input" id="newSectionName" placeholder="Ex: Banner, Conteúdo..." />
                    </div>
                    <div class="panelField">
                        <label>Número de colunas</label>
                        <div class="colPicker">${colBtns}</div>
                    </div>
                    <div class="panelField">
                        <label>Layout</label>
                        <div class="layoutPicker">${layoutBtns}</div>
                    </div>
                    <div class="panelActions">
                        <button class="btn btn--secondary" id="btnCancelAddSection">Cancelar</button>
                        <button class="btn btn--primary" id="btnConfirmAddSection">Criar</button>
                    </div>
                </div>
            </div>`;
    },

    panelSection(section) {
        const ctype      = section.container_type || 'container';
        const st         = section.styles || {};
        const p          = st.padding       || {};
        const m          = st.margin        || {};
        const sh         = st.shadow        || {};
        const br         = st.border_radius || {};
        const hasBg      = !!st.bg_color;

        const layoutBtns = this._layoutOptions().map(l =>
            `<button class="layoutBtn ${ctype === l.value ? 'active' : ''}" data-layout="${l.value}" data-section-id="${section.id}">
                <strong>${l.label}</strong><span>${l.desc}</span>
             </button>`
        ).join('');

        const spacingInputs = (prefix, vals) => `
            <div class="spacingGrid">
                <div class="spacingGrid__row">
                    <div class="spacingGrid__field"><label>↑ Cima</label>
                        <input type="number" class="input spacingInput" id="${prefix}Top"   value="${vals.top    || 0}" min="0"></div>
                    <div class="spacingGrid__field"><label>↓ Baixo</label>
                        <input type="number" class="input spacingInput" id="${prefix}Bottom" value="${vals.bottom || 0}" min="0"></div>
                </div>
                <div class="spacingGrid__row">
                    <div class="spacingGrid__field"><label>← Esq.</label>
                        <input type="number" class="input spacingInput" id="${prefix}Left"  value="${vals.left   || 0}" min="0"></div>
                    <div class="spacingGrid__field"><label>→ Dir.</label>
                        <input type="number" class="input spacingInput" id="${prefix}Right" value="${vals.right  || 0}" min="0"></div>
                </div>
            </div>`;

        return `
            <div class="panelBody">
                <div class="panelSection">
                    <h4>Seção</h4>
                    <div class="panelField">
                        <label>Nome</label>
                        <input class="input" id="editSectionName" value="${this.escHtml(section.name)}" />
                    </div>
                    <button class="btn btn--primary btn--full" id="btnSaveSectionName" data-id="${section.id}">Salvar nome</button>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Layout</label>
                        <div class="layoutPicker">${layoutBtns}</div>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Colunas</label>
                        <div class="colPicker">
                            ${[1,2,3,4,5,6].map(n =>
                                `<button class="colPicker__btn ${section.columns.length === n ? 'active' : ''}" data-cols="${n}" data-section-id="${section.id}">
                                    ${n}${n === 5 ? '<small>⊞</small>' : ''}
                                 </button>`
                            ).join('')}
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Cor de fundo</label>
                        <div class="colorRow">
                            <input type="checkbox" id="sectionUseBg" class="sectionStyleInput" ${hasBg ? 'checked' : ''} />
                            <input type="color" id="sectionBgColor" class="colorInput sectionStyleInput"
                                   value="${st.bg_color || '#ffffff'}" ${hasBg ? '' : 'disabled'} />
                            <label for="sectionUseBg" class="colorRowLabel">Ativar cor</label>
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Espaço interno — padding (px)</label>
                        ${spacingInputs('sectionPad', p)}
                    </div>
                    <div class="panelField">
                        <label>Margem (px)</label>
                        ${spacingInputs('sectionMar', m)}
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Largura</label>
                        <div class="dimensionRow">
                            <input type="number" class="input spacingInput" id="sectionWidthVal"
                                   value="${st.width_value || ''}" min="0" placeholder="100%">
                            <select class="input sectionStyleInput" id="sectionWidthUnit">
                                <option value="px" ${(st.width_unit||'px') === 'px' ? 'selected' : ''}>px</option>
                                <option value="%" ${st.width_unit === '%' ? 'selected' : ''}>%</option>
                            </select>
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Altura</label>
                        <div class="dimensionRow">
                            <input type="number" class="input spacingInput" id="sectionHeightVal"
                                   value="${st.height_value || ''}" min="0" placeholder="auto">
                            <select class="input sectionStyleInput" id="sectionHeightUnit">
                                <option value="px" ${(st.height_unit||'px') === 'px' ? 'selected' : ''}>px</option>
                                <option value="vh" ${st.height_unit === 'vh' ? 'selected' : ''}>vh</option>
                                <option value="%" ${st.height_unit === '%' ? 'selected' : ''}>%</option>
                            </select>
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField panelField--toggle">
                        <label>Flutuante (position: absolute)</label>
                        <input type="checkbox" id="sectionFloating" class="sectionStyleInput" ${st.floating ? 'checked' : ''} />
                    </div>
                    <div id="zIndexRow" class="panelField" ${st.floating ? '' : 'style="display:none"'}>
                        <label>Camada (z-index)</label>
                        <input type="number" class="input sectionStyleInput" id="sectionZIndex" value="${st.z_index || 0}" min="0" />
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Borda (px)</label>
                        <div class="borderRow">
                            <input type="number" class="input borderWidth sectionStyleInput" id="sectionBorderWidth" value="${st.border_width || 0}" min="0" max="50">
                            <span class="borderUnit">px</span>
                            <input type="color" class="colorInput sectionStyleInput" id="sectionBorderColor" value="${st.border_color || '#000000'}" />
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Arredondamento dos cantos (px)</label>
                        <div class="spacingGrid">
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>↖ Sup. Esq.</label>
                                    <input type="number" class="input spacingInput" id="sectionRadiusTL" value="${br.tl || 0}" min="0"></div>
                                <div class="spacingGrid__field"><label>↗ Sup. Dir.</label>
                                    <input type="number" class="input spacingInput" id="sectionRadiusTR" value="${br.tr || 0}" min="0"></div>
                            </div>
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>↙ Inf. Esq.</label>
                                    <input type="number" class="input spacingInput" id="sectionRadiusBL" value="${br.bl || 0}" min="0"></div>
                                <div class="spacingGrid__field"><label>↘ Inf. Dir.</label>
                                    <input type="number" class="input spacingInput" id="sectionRadiusBR" value="${br.br || 0}" min="0"></div>
                            </div>
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Sombra</label>
                        <div class="colorRow">
                            <input type="checkbox" id="sectionShadowEnabled" class="sectionStyleInput" ${sh.enabled ? 'checked' : ''} />
                            <label for="sectionShadowEnabled" class="colorRowLabel">Ativar sombra</label>
                        </div>
                    </div>
                    <div id="sectionShadowControls" ${sh.enabled ? '' : 'style="display:none"'}>
                        <div class="panelField">
                            <label>Cor da sombra</label>
                            <div class="colorRow">
                                <input type="color" class="colorInput sectionStyleInput" id="sectionShadowColor" value="${sh.color || '#000000'}">
                            </div>
                        </div>
                        <div class="twoColGrid">
                            <div class="panelField">
                                <label>Tamanho (px)</label>
                                <input type="number" class="input spacingInput" id="sectionShadowSize"  value="${sh.size     || 0}" min="0">
                            </div>
                            <div class="panelField">
                                <label>Distância (px)</label>
                                <input type="number" class="input spacingInput" id="sectionShadowDist"  value="${sh.distance || 0}" min="0">
                            </div>
                        </div>
                        <div class="twoColGrid">
                            <div class="panelField">
                                <label>Ângulo (°)</label>
                                <input type="number" class="input spacingInput" id="sectionShadowAngle" value="${sh.angle   !== undefined ? sh.angle   : 135}" min="0" max="360">
                            </div>
                            <div class="panelField">
                                <label>Opacidade (%)</label>
                                <input type="number" class="input spacingInput" id="sectionShadowOp"    value="${sh.opacity !== undefined ? sh.opacity : 30}"  min="0" max="100">
                            </div>
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <button class="btn btn--danger btn--full" id="btnDeleteSection" data-id="${section.id}">Excluir seção</button>
                    <div class="panelDivider"></div>
                    <button class="btn btn--secondary btn--full btnBack">← Voltar</button>
                </div>
            </div>`;
    },

    panelColumn(column) {
        return `
            <div class="panelBody">
                <div class="panelSection">
                    <h4>Adicionar elemento</h4>
                    <p class="panelHint">Escolha o tipo de conteúdo para esta coluna:</p>
                    <div class="pluginList">
                        <button class="pluginBtn" data-plugin="text" data-column-id="${column.id}">
                            <span class="pluginBtn__icon">T</span>
                            <span class="pluginBtn__label">Texto</span>
                        </button>
                    </div>
                    <div class="panelDivider"></div>
                    <button class="btn btn--secondary btn--full btnBack">← Voltar</button>
                </div>
            </div>`;
    },

    panelColumnSettings(column) {
        const st    = column.styles        || {};
        const p     = st.padding           || {};
        const sh    = st.shadow            || {};
        const br    = st.border_radius     || {};
        const hasBg = !!st.bg_color;

        const spacingInputs = (prefix, vals) => `
            <div class="spacingGrid">
                <div class="spacingGrid__row">
                    <div class="spacingGrid__field"><label>↑ Cima</label>
                        <input type="number" class="input spacingInput" id="${prefix}Top"    value="${vals.top    || 0}" min="0"></div>
                    <div class="spacingGrid__field"><label>↓ Baixo</label>
                        <input type="number" class="input spacingInput" id="${prefix}Bottom" value="${vals.bottom || 0}" min="0"></div>
                </div>
                <div class="spacingGrid__row">
                    <div class="spacingGrid__field"><label>← Esq.</label>
                        <input type="number" class="input spacingInput" id="${prefix}Left"   value="${vals.left   || 0}" min="0"></div>
                    <div class="spacingGrid__field"><label>→ Dir.</label>
                        <input type="number" class="input spacingInput" id="${prefix}Right"  value="${vals.right  || 0}" min="0"></div>
                </div>
            </div>`;

        return `
            <div class="panelBody">
                <div class="panelSection">
                    <h4>Coluna</h4>

                    <div class="panelField">
                        <label>Padding (px)</label>
                        ${spacingInputs('colPad', p)}
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Cor de fundo</label>
                        <div class="colorRow">
                            <input type="checkbox" id="colUseBg" ${hasBg ? 'checked' : ''} />
                            <input type="color" id="colBgColor" class="colorInput" value="${st.bg_color || '#ffffff'}" ${hasBg ? '' : 'disabled'} />
                            <label for="colUseBg" class="colorRowLabel">Ativar cor</label>
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Borda (px)</label>
                        <div class="borderRow">
                            <input type="number" class="input borderWidth" id="colBorderWidth" value="${st.border_width || 0}" min="0" max="50">
                            <span class="borderUnit">px</span>
                            <input type="color" class="colorInput" id="colBorderColor" value="${st.border_color || '#000000'}" />
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Arredondamento dos cantos (px)</label>
                        <div class="spacingGrid">
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>↖ Sup. Esq.</label>
                                    <input type="number" class="input spacingInput" id="colRadiusTL" value="${br.tl || 0}" min="0"></div>
                                <div class="spacingGrid__field"><label>↗ Sup. Dir.</label>
                                    <input type="number" class="input spacingInput" id="colRadiusTR" value="${br.tr || 0}" min="0"></div>
                            </div>
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>↙ Inf. Esq.</label>
                                    <input type="number" class="input spacingInput" id="colRadiusBL" value="${br.bl || 0}" min="0"></div>
                                <div class="spacingGrid__field"><label>↘ Inf. Dir.</label>
                                    <input type="number" class="input spacingInput" id="colRadiusBR" value="${br.br || 0}" min="0"></div>
                            </div>
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Sombra</label>
                        <div class="colorRow">
                            <input type="checkbox" id="colShadowEnabled" ${sh.enabled ? 'checked' : ''} />
                            <label for="colShadowEnabled" class="colorRowLabel">Ativar sombra</label>
                        </div>
                    </div>
                    <div id="colShadowControls" ${sh.enabled ? '' : 'style="display:none"'}>
                        <div class="panelField">
                            <label>Cor da sombra</label>
                            <div class="colorRow">
                                <input type="color" class="colorInput" id="colShadowColor" value="${sh.color || '#000000'}">
                            </div>
                        </div>
                        <div class="twoColGrid">
                            <div class="panelField">
                                <label>Tamanho (px)</label>
                                <input type="number" class="input spacingInput" id="colShadowSize"  value="${sh.size     || 0}" min="0">
                            </div>
                            <div class="panelField">
                                <label>Distância (px)</label>
                                <input type="number" class="input spacingInput" id="colShadowDist"  value="${sh.distance || 0}" min="0">
                            </div>
                        </div>
                        <div class="twoColGrid">
                            <div class="panelField">
                                <label>Ângulo (°)</label>
                                <input type="number" class="input spacingInput" id="colShadowAngle" value="${sh.angle   !== undefined ? sh.angle   : 135}" min="0" max="360">
                            </div>
                            <div class="panelField">
                                <label>Opacidade (%)</label>
                                <input type="number" class="input spacingInput" id="colShadowOp"    value="${sh.opacity !== undefined ? sh.opacity : 30}"  min="0" max="100">
                            </div>
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <button class="btn btn--secondary btn--full btnBack">← Voltar</button>
                </div>
            </div>`;
    },

    panelElement(data) {
        const { element } = data;
        if (element.plugin_type === 'text') {
            return `
                <div class="panelBody">
                    <div class="panelSection">
                        <h4>Texto</h4>
                        <div class="panelField">
                            <label>Conteúdo</label>
                            <div id="quillEditor" class="quillEditor"></div>
                        </div>
                        <div class="panelDivider"></div>
                        <button class="btn btn--danger btn--full" id="btnDeleteElement" data-id="${element.id}">Remover elemento</button>
                        <div class="panelDivider"></div>
                        <button class="btn btn--secondary btn--full btnBack">← Voltar</button>
                    </div>
                </div>`;
        }
        return `<div class="panelBody"><div class="panelSection"><p class="panelHint">Plugin não suportado.</p></div></div>`;
    },

    // ── Preview (center) — clean, no labels ───────────────────
    renderPreview() {
        const html = this.data.length
            ? this.data.map(s => this.renderSection(s)).join('')
            : `<div class="editorCanvas__empty">
                <p>Nenhuma seção ainda.</p>
                <p>Use o painel à esquerda para começar.</p>
               </div>`;
        $('#editorCanvas').html(html);
    },

    renderSection(section) {
        const cols        = section.columns.map(c => this.renderColumn(c)).join('');
        const centered    = section.columns.length === 5 && section.columns.every(c => c.col_size === 2);
        const rowClass    = `row editorSection__row${centered ? ' justify-content-center' : ''}`;
        const type        = section.container_type || 'container';
        const inlineStyle = this._buildInlineStyle(section.styles || {});
        const inner       = (type === 'container' || type === 'full-inner')
            ? `<div class="container"><div class="${rowClass}">${cols}</div></div>`
            : `<div class="${rowClass}">${cols}</div>`;
        return `
            <div class="editorSection editorSection--${type}" data-section-id="${section.id}"${inlineStyle ? ` style="${inlineStyle}"` : ''}>
                ${inner}
            </div>`;
    },

    renderColumn(column) {
        const elements    = column.elements.map(e => this.renderElement(e)).join('');
        const inlineStyle = this._buildInlineStyle(column.styles || {});
        return `
            <div class="col-${column.col_size} editorColumn ${column.elements.length === 0 ? 'editorColumn--empty' : ''}" data-column-id="${column.id}"${inlineStyle ? ` style="${inlineStyle}"` : ''}>
                ${elements}
            </div>`;
    },

    renderElement(element) {
        const c = element.content || {};
        let preview = '';

        if (element.plugin_type === 'text') {
            if (c.html !== undefined) {
                preview = c.html || '<em class="previewEmpty">Texto vazio</em>';
            } else {
                const weight = c.bold ? '600' : '400';
                const txt    = c.text
                    ? c.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')
                    : '<em class="previewEmpty">Texto vazio</em>';
                preview = `<p style="font-weight:${weight}">${txt}</p>`;
            }
        }

        return `
            <div class="editorElement" data-element-id="${element.id}" data-plugin="${element.plugin_type}">
                <div class="previewElement" data-element-id="${element.id}">${preview}</div>
            </div>`;
    },

    // ── Quill ─────────────────────────────────────────────────
    initQuill(element) {
        const E = this;
        const c = element.content || {};

        this.quill = new Quill('#quillEditor', {
            theme: 'snow',
            placeholder: 'Escreva aqui...',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    ['clean']
                ]
            }
        });

        if (c.html) {
            this.quill.clipboard.dangerouslyPasteHTML(c.html);
        } else if (c.text) {
            this.quill.setText(c.text);
        }

        let saveTimer = null;
        this.quill.on('text-change', () => {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => E.saveElementContent(), 700);
        });
    },

    // ── Events ────────────────────────────────────────────────
    bindEvents() {
        const E = this;

        // Structure tree: section gear
        $(document).on('click', '.btnSectionSettings', function (e) {
            e.stopPropagation();
            const id      = parseInt($(this).data('section-id'));
            const section = E.findSection(id);
            if (section) { E.state = { mode: 'section', selected: section, selectedCols: 1 }; E.renderPanel(); }
        });

        // Structure tree: "+ Novo elemento" button
        $(document).on('click', '.btnAddElement', function (e) {
            e.stopPropagation();
            const id     = parseInt($(this).data('column-id'));
            const column = E.findColumn(id);
            if (column) { E.state = { mode: 'column', selected: column, selectedCols: 1 }; E.renderPanel(); }
        });

        // Structure tree: element click (open editor)
        $(document).on('click', '.structureElement', function (e) {
            if ($(e.target).closest('.structureElement__order').length) return;
            e.stopPropagation();
            const id   = parseInt($(this).data('element-id'));
            const data = E.findElement(id);
            if (data) { E.state = { mode: 'element', selected: data, selectedCols: 1 }; E.renderPanel(); }
        });

        // Structure tree: move up / down
        $(document).on('click', '.btnMoveUp', function (e) {
            e.stopPropagation();
            const id = parseInt($(this).data('element-id'));
            E.moveElement(id, -1);
        });

        $(document).on('click', '.btnMoveDown', function (e) {
            e.stopPropagation();
            const id = parseInt($(this).data('element-id'));
            E.moveElement(id, 1);
        });

        // Preview: column click (empty column → add element)
        $(document).on('click', '.editorColumn', function (e) {
            if ($(e.target).closest('.editorElement').length) return;
            const id     = parseInt($(this).data('column-id'));
            const column = E.findColumn(id);
            if (column) { E.state = { mode: 'column', selected: column, selectedCols: 1 }; E.renderPanel(); }
        });

        // Preview: element click → edit
        $(document).on('click', '.editorElement', function (e) {
            e.stopPropagation();
            const id   = parseInt($(this).data('element-id'));
            const data = E.findElement(id);
            if (data) { E.state = { mode: 'element', selected: data, selectedCols: 1 }; E.renderPanel(); }
        });

        // Add section
        $(document).on('click', '#btnShowAddSection', () => {
            E.selectedLayout = 'container';
            E.state = { mode: 'add-section', selected: null, selectedCols: 1 };
            E.renderPanel();
        });

        // Layout picker (add-section mode)
        $(document).on('click', '.layoutBtn', function () {
            const layout = $(this).data('layout');
            if (E.state.mode === 'add-section') {
                E.selectedLayout = layout;
                $('.layoutBtn').removeClass('active');
                $(this).addClass('active');
            } else if (E.state.mode === 'section') {
                const sectionId = parseInt($(this).data('section-id'));
                E.updateSectionLayout(sectionId, layout);
            }
        });

        // Col picker — add-section vs section edit
        $(document).on('click', '.colPicker__btn', function () {
            const cols = parseInt($(this).data('cols'));
            if (E.state.mode === 'add-section') {
                E.state.selectedCols = cols;
                $('.colPicker__btn').removeClass('active');
                $(this).addClass('active');
            } else if (E.state.mode === 'section' && E.state.selected) {
                const sectionId = parseInt($(this).data('section-id'));
                if (cols !== E.state.selected.columns.length) {
                    E.updateSectionColumns(sectionId, cols);
                }
            }
        });

        $(document).on('click', '#btnCancelAddSection', () => {
            E.state = { mode: 'default', selected: null, selectedCols: 1 };
            E.renderPanel();
        });

        $(document).on('click', '#btnConfirmAddSection', () => {
            const name = $('#newSectionName').val().trim();
            if (!name) { $('#newSectionName').focus(); return; }
            E.createSection(name, E.state.selectedCols, E.selectedLayout);
        });

        // Section settings
        $(document).on('click', '#btnSaveSectionName', function () {
            const id   = parseInt($(this).data('id'));
            const name = $('#editSectionName').val().trim();
            if (!name) return;
            E.updateSectionName(id, name);
        });

        $(document).on('click', '#btnDeleteSection', function () {
            const id = parseInt($(this).data('id'));
            if (confirm('Excluir esta seção e todo o seu conteúdo?')) E.deleteSection(id);
        });

        // Plugin picker
        $(document).on('click', '.pluginBtn', function () {
            const plugin   = $(this).data('plugin');
            const columnId = parseInt($(this).data('column-id'));
            E.addElement(columnId, plugin);
        });

        // Delete element
        $(document).on('click', '#btnDeleteElement', function () {
            const id = parseInt($(this).data('id'));
            if (confirm('Remover este elemento?')) E.deleteElement(id);
        });

        // Section styles: toggle bg color enable
        $(document).on('change', '#sectionUseBg', function () {
            $('#sectionBgColor').prop('disabled', !this.checked);
            if (E.state.mode === 'section' && E.state.selected) E.saveSectionStyles(E.state.selected.id);
        });

        // Section styles: color change
        $(document).on('change', '#sectionBgColor, #sectionWidthUnit, #sectionHeightUnit', function () {
            if (E.state.mode === 'section' && E.state.selected) E.saveSectionStyles(E.state.selected.id);
        });

        // Section/column: spacing inputs (save on blur)
        $(document).on('blur', '.spacingInput', function () {
            if      (E.state.mode === 'section'         && E.state.selected) E.saveSectionStyles(E.state.selected.id);
            else if (E.state.mode === 'column-settings' && E.state.selected) E.saveColumnStyles(E.state.selected.id);
        });

        // Section styles: floating toggle
        $(document).on('change', '#sectionFloating', function () {
            $('#zIndexRow').toggle(this.checked);
            if (E.state.mode === 'section' && E.state.selected) E.saveSectionStyles(E.state.selected.id);
        });

        // Section styles: z-index blur
        $(document).on('blur', '#sectionZIndex', function () {
            if (E.state.mode === 'section' && E.state.selected) E.saveSectionStyles(E.state.selected.id);
        });

        // Section: border change
        $(document).on('change', '#sectionBorderColor', function () {
            if (E.state.mode === 'section' && E.state.selected) E.saveSectionStyles(E.state.selected.id);
        });
        $(document).on('blur', '#sectionBorderWidth', function () {
            if (E.state.mode === 'section' && E.state.selected) E.saveSectionStyles(E.state.selected.id);
        });

        // Section: shadow toggle + color
        $(document).on('change', '#sectionShadowEnabled', function () {
            $('#sectionShadowControls').toggle(this.checked);
            if (E.state.mode === 'section' && E.state.selected) E.saveSectionStyles(E.state.selected.id);
        });
        $(document).on('change', '#sectionShadowColor', function () {
            if (E.state.mode === 'section' && E.state.selected) E.saveSectionStyles(E.state.selected.id);
        });

        // Column: open settings
        $(document).on('click', '.btnColumnSettings', function (e) {
            e.stopPropagation();
            const id     = parseInt($(this).data('column-id'));
            const column = E.findColumn(id);
            if (column) { E.state = { mode: 'column-settings', selected: column, selectedCols: 1 }; E.renderPanel(); }
        });

        // Column: bg color
        $(document).on('change', '#colUseBg', function () {
            $('#colBgColor').prop('disabled', !this.checked);
            if (E.state.mode === 'column-settings' && E.state.selected) E.saveColumnStyles(E.state.selected.id);
        });
        $(document).on('change', '#colBgColor', function () {
            if (E.state.mode === 'column-settings' && E.state.selected) E.saveColumnStyles(E.state.selected.id);
        });

        // Column: border change
        $(document).on('change', '#colBorderColor', function () {
            if (E.state.mode === 'column-settings' && E.state.selected) E.saveColumnStyles(E.state.selected.id);
        });
        $(document).on('blur', '#colBorderWidth', function () {
            if (E.state.mode === 'column-settings' && E.state.selected) E.saveColumnStyles(E.state.selected.id);
        });

        // Column: shadow toggle + color
        $(document).on('change', '#colShadowEnabled', function () {
            $('#colShadowControls').toggle(this.checked);
            if (E.state.mode === 'column-settings' && E.state.selected) E.saveColumnStyles(E.state.selected.id);
        });
        $(document).on('change', '#colShadowColor', function () {
            if (E.state.mode === 'column-settings' && E.state.selected) E.saveColumnStyles(E.state.selected.id);
        });

        // Back
        $(document).on('click', '.btnBack', () => {
            E.state = { mode: 'default', selected: null, selectedCols: 1 };
            E.renderPanel();
        });
    },

    // ── API ───────────────────────────────────────────────────
    createSection(name, colCount, containerType) {
        $.post(ADMIN_BASE_URL + '/services/editor/save_section.php', {
            page_id: this.pageId, name, col_count: colCount, container_type: containerType
        }).done(res => {
            if (res.success) {
                this.data.push(res.section);
                this.state = { mode: 'default', selected: null, selectedCols: 1 };
                this.selectedLayout = 'container';
                this.renderPanel();
                this.renderPreview();
            } else { alert(res.message); }
        }).fail(() => alert('Erro ao criar seção.'));
    },

    saveSectionStyles(id) {
        const useBg      = $('#sectionUseBg').is(':checked');
        const widthVal   = parseInt($('#sectionWidthVal').val())  || 0;
        const heightVal  = parseInt($('#sectionHeightVal').val()) || 0;
        const shadowOn   = $('#sectionShadowEnabled').is(':checked');
        const styles = {
            bg_color:     useBg ? $('#sectionBgColor').val() : '',
            width_value:  widthVal,
            width_unit:   $('#sectionWidthUnit').val() || 'px',
            height_value: heightVal,
            height_unit:  $('#sectionHeightUnit').val() || 'px',
            padding: {
                top:    parseInt($('#sectionPadTop').val())    || 0,
                right:  parseInt($('#sectionPadRight').val())  || 0,
                bottom: parseInt($('#sectionPadBottom').val()) || 0,
                left:   parseInt($('#sectionPadLeft').val())   || 0,
            },
            margin: {
                top:    parseInt($('#sectionMarTop').val())    || 0,
                right:  parseInt($('#sectionMarRight').val())  || 0,
                bottom: parseInt($('#sectionMarBottom').val()) || 0,
                left:   parseInt($('#sectionMarLeft').val())   || 0,
            },
            floating:     $('#sectionFloating').is(':checked'),
            z_index:      parseInt($('#sectionZIndex').val())      || 0,
            border_width: parseInt($('#sectionBorderWidth').val()) || 0,
            border_color: $('#sectionBorderColor').val() || '#000000',
            border_radius: {
                tl: parseInt($('#sectionRadiusTL').val()) || 0,
                tr: parseInt($('#sectionRadiusTR').val()) || 0,
                br: parseInt($('#sectionRadiusBR').val()) || 0,
                bl: parseInt($('#sectionRadiusBL').val()) || 0,
            },
            shadow: {
                enabled:  shadowOn,
                color:    $('#sectionShadowColor').val() || '#000000',
                size:     parseInt($('#sectionShadowSize').val())  || 0,
                distance: parseInt($('#sectionShadowDist').val())  || 0,
                angle:    parseInt($('#sectionShadowAngle').val()) || 0,
                opacity:  parseInt($('#sectionShadowOp').val())    || 0,
            },
        };
        const s = this.findSection(id);
        if (s) s.styles = styles;
        $(`.editorSection[data-section-id="${id}"]`).attr('style', this._buildInlineStyle(styles));
        $.post(ADMIN_BASE_URL + '/services/editor/save_section.php', {
            section_id: id, styles: JSON.stringify(styles)
        }).done(() => this.showSaved());
    },

    saveColumnStyles(id) {
        const shadowOn = $('#colShadowEnabled').is(':checked');
        const useBg    = $('#colUseBg').is(':checked');
        const styles = {
            bg_color:     useBg ? $('#colBgColor').val() : '',
            padding: {
                top:    parseInt($('#colPadTop').val())    || 0,
                right:  parseInt($('#colPadRight').val())  || 0,
                bottom: parseInt($('#colPadBottom').val()) || 0,
                left:   parseInt($('#colPadLeft').val())   || 0,
            },
            border_width: parseInt($('#colBorderWidth').val()) || 0,
            border_color: $('#colBorderColor').val() || '#000000',
            border_radius: {
                tl: parseInt($('#colRadiusTL').val()) || 0,
                tr: parseInt($('#colRadiusTR').val()) || 0,
                br: parseInt($('#colRadiusBR').val()) || 0,
                bl: parseInt($('#colRadiusBL').val()) || 0,
            },
            shadow: {
                enabled:  shadowOn,
                color:    $('#colShadowColor').val() || '#000000',
                size:     parseInt($('#colShadowSize').val())  || 0,
                distance: parseInt($('#colShadowDist').val())  || 0,
                angle:    parseInt($('#colShadowAngle').val()) || 0,
                opacity:  parseInt($('#colShadowOp').val())    || 0,
            },
        };
        const col = this.findColumn(id);
        if (col) {
            col.styles = styles;
            $(`.editorColumn[data-column-id="${id}"]`).attr('style', this._buildInlineStyle(styles));
        }
        $.post(ADMIN_BASE_URL + '/services/editor/save_column.php', {
            column_id: id, styles: JSON.stringify(styles)
        }).done(() => this.showSaved());
    },

    _buildInlineStyle(styles) {
        if (!styles) return '';
        let css = '';
        if (styles.bg_color)     css += `background-color:${styles.bg_color};`;
        if (styles.width_value)  css += `width:${styles.width_value}${styles.width_unit || 'px'};`;
        if (styles.height_value) css += `height:${styles.height_value}${styles.height_unit || 'px'};`;
        const p = styles.padding || {};
        if (p.top || p.right || p.bottom || p.left)
            css += `padding:${p.top||0}px ${p.right||0}px ${p.bottom||0}px ${p.left||0}px;`;
        const m = styles.margin || {};
        if (m.top)    css += `margin-top:${m.top}px;`;
        if (m.right)  css += `margin-right:${m.right}px;`;
        if (m.bottom) css += `margin-bottom:${m.bottom}px;`;
        if (m.left)   css += `margin-left:${m.left}px;`;
        if (styles.floating) css += `position:absolute;z-index:${styles.z_index||0};`;
        if (styles.border_width > 0)
            css += `border:${styles.border_width}px solid ${styles.border_color || '#000000'};`;
        const br = styles.border_radius || {};
        if (br.tl || br.tr || br.br || br.bl)
            css += `border-radius:${br.tl||0}px ${br.tr||0}px ${br.br||0}px ${br.bl||0}px;`;
        const sh = styles.shadow;
        if (sh && sh.enabled) {
            const rad   = (sh.angle || 0) * Math.PI / 180;
            const ox    = Math.round(Math.sin(rad) * (sh.distance || 0));
            const oy    = Math.round(Math.cos(rad) * (sh.distance || 0));
            const alpha = ((sh.opacity || 0) / 100).toFixed(2);
            const hex   = (sh.color || '#000000').replace('#', '');
            const r     = parseInt(hex.slice(0, 2), 16);
            const g     = parseInt(hex.slice(2, 4), 16);
            const b     = parseInt(hex.slice(4, 6), 16);
            css += `box-shadow:${ox}px ${oy}px ${sh.size || 0}px rgba(${r},${g},${b},${alpha});`;
        }
        return css;
    },

    updateSectionLayout(id, containerType) {
        const s = this.findSection(id);
        if (!s) return;
        s.container_type = containerType;
        $.post(ADMIN_BASE_URL + '/services/editor/save_section.php', {
            section_id: id, container_type: containerType
        });
        this.renderPreview();
        // Atualiza botões do painel sem sair da seção
        $('.layoutBtn').removeClass('active');
        $(`.layoutBtn[data-layout="${containerType}"]`).addClass('active');
    },

    updateSectionName(id, name) {
        $.post(ADMIN_BASE_URL + '/services/editor/save_section.php', {
            section_id: id, name
        }).done(res => {
            if (res.success) {
                const s = this.findSection(id);
                if (s) s.name = name;
                this.state = { mode: 'default', selected: null, selectedCols: 1 };
                this.renderPanel();
                this.renderPreview();
            } else { alert(res.message); }
        });
    },

    updateSectionColumns(sectionId, newColCount) {
        $.post(ADMIN_BASE_URL + '/services/editor/update_section_columns.php', {
            section_id: sectionId, col_count: newColCount
        }).done(res => {
            if (res.success) {
                const s = this.findSection(sectionId);
                if (s) {
                    s.columns = res.columns;
                    this.state = { mode: 'section', selected: s, selectedCols: 1 };
                }
                this.renderPanel();
                this.renderPreview();
                this.showSaved();
            } else { alert(res.message); }
        }).fail(() => alert('Erro ao atualizar colunas.'));
    },

    deleteSection(id) {
        $.post(ADMIN_BASE_URL + '/services/editor/delete_section.php', {
            section_id: id
        }).done(res => {
            if (res.success) {
                this.data = this.data.filter(s => s.id !== id);
                this.state = { mode: 'default', selected: null, selectedCols: 1 };
                this.renderPanel();
                this.renderPreview();
            } else { alert(res.message); }
        });
    },

    addElement(columnId, pluginType) {
        $.post(ADMIN_BASE_URL + '/services/editor/save_element.php', {
            column_id: columnId, plugin_type: pluginType, content: '{}'
        }).done(res => {
            if (res.success) {
                const col = this.findColumn(columnId);
                if (col) {
                    col.elements.push(res.element);
                    this.state = { mode: 'element', selected: { element: res.element, column: col }, selectedCols: 1 };
                    this.renderPanel();
                    this.renderPreview();
                }
            } else { alert(res.message); }
        });
    },

    saveElementContent() {
        if (this.state.mode !== 'element' || !this.quill) return;
        const { element } = this.state.selected;
        const html    = this.quill.root.innerHTML;
        const isEmpty = this.quill.getText().trim() === '';
        const content = { html: isEmpty ? '' : html };

        $.post(ADMIN_BASE_URL + '/services/editor/save_element.php', {
            element_id: element.id, content: JSON.stringify(content)
        }).done(res => {
            if (res.success) {
                element.content = content;
                const preview = isEmpty ? '<em class="previewEmpty">Texto vazio</em>' : html;
                $(`.previewElement[data-element-id="${element.id}"]`).html(preview);
                this.showSaved();
            }
        });
    },

    deleteElement(id) {
        $.post(ADMIN_BASE_URL + '/services/editor/delete_element.php', {
            element_id: id
        }).done(res => {
            if (res.success) {
                for (const s of this.data)
                    for (const c of s.columns)
                        c.elements = c.elements.filter(e => e.id !== id);
                this.state = { mode: 'default', selected: null, selectedCols: 1 };
                this.renderPanel();
                this.renderPreview();
            } else { alert(res.message); }
        });
    },

    // ── Element ordering ─────────────────────────────────────
    moveElement(elementId, direction) {
        for (const s of this.data) {
            for (const c of s.columns) {
                const idx = c.elements.findIndex(e => e.id === elementId);
                if (idx === -1) continue;
                const newIdx = idx + direction;
                if (newIdx < 0 || newIdx >= c.elements.length) return;
                [c.elements[idx], c.elements[newIdx]] = [c.elements[newIdx], c.elements[idx]];
                this.renderPanel();
                this.renderPreview();
                this.saveElementOrder(c.id, c.elements.map(e => e.id));
                return;
            }
        }
    },

    saveElementOrder(columnId, orderedIds) {
        $.post(ADMIN_BASE_URL + '/services/editor/reorder_elements.php', {
            column_id: columnId,
            order: JSON.stringify(orderedIds)
        });
    },

    // ── Helpers ───────────────────────────────────────────────
    findSection(id) { return this.data.find(s => s.id === id); },

    findColumn(id) {
        for (const s of this.data) {
            const c = s.columns.find(c => c.id === id);
            if (c) return c;
        }
        return null;
    },

    findElement(id) {
        for (const s of this.data)
            for (const c of s.columns) {
                const e = c.elements.find(e => e.id === id);
                if (e) return { element: e, column: c };
            }
        return null;
    },

    _syncPreviewSelection() {
        $('.editorElement').removeClass('active');
        if (this.state.mode === 'element' && this.state.selected && this.state.selected.element) {
            $(`.editorElement[data-element-id="${this.state.selected.element.id}"]`).addClass('active');
        }
    },

    _isSelectedSection(id) {
        return this.state.mode === 'section' && this.state.selected && this.state.selected.id === id;
    },

    _isSelectedColumn(id) {
        return this.state.mode === 'column' && this.state.selected && this.state.selected.id === id;
    },

    _isSelectedElement(id) {
        return this.state.mode === 'element' && this.state.selected && this.state.selected.element && this.state.selected.element.id === id;
    },

    _layoutOptions() {
        return [
            { value: 'container',  label: 'Conteúdo normal',                  desc: 'Cards de conteúdo centralizados na tela' },
            { value: 'full',       label: 'Largura total',                     desc: 'Cards de conteúdo ocupam toda a tela' },
            { value: 'full-inner', label: 'Largura total + conteúdo normal',   desc: 'Fundo total, mas o conteúdo centralizado normalmente' }
        ];
    },

    _colLabel(colSize) {
        const map = { 12: '1/1', 6: '1/2', 4: '1/3', 3: '1/4', 2: '1/6' };
        return map[colSize] || `col-${colSize}`;
    },

    _elementPreviewLabel(element) {
        const c = element.content || {};
        if (element.plugin_type === 'text') {
            if (c.html) {
                const tmp = $('<div>').html(c.html).text().trim();
                return tmp.length > 26 ? this.escHtml(tmp.substring(0, 26)) + '…' : this.escHtml(tmp || 'Texto vazio');
            }
            const t = (c.text || '').trim();
            return t.length > 26 ? this.escHtml(t.substring(0, 26)) + '…' : this.escHtml(t || 'Texto vazio');
        }
        return this.escHtml(element.plugin_type);
    },

    escHtml(str) {
        return String(str)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    },

    showSaved() {
        $('#saveIndicator').text('Salvo ✓').addClass('show');
        setTimeout(() => $('#saveIndicator').removeClass('show'), 2000);
    }
};
