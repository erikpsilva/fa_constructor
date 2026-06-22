$(document).ready(function () {
    Editor.init(PAGE_ID, PAGE_DATA);

    // Ajusta a altura dos iframes de Header/Footer (preview-only) ao conteúdo real deles.
    $('.previewChrome').on('load', function () {
        try {
            const height = this.contentWindow.document.body.scrollHeight;
            $(this).css('height', height + 'px');
        } catch (e) { /* same-origin esperado; ignora se não conseguir medir */ }
    });
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
        if      (mode === 'default')          html = this.panelStructure();
        else if (mode === 'add-section')      html = this.panelAddSection();
        else if (mode === 'section')          html = this.panelSection(selected);
        else if (mode === 'column')           html = this.panelColumn(selected);
        else if (mode === 'column-settings')  html = this.panelColumnSettings(selected);
        else if (mode === 'element')          html = this.panelElement(selected);
        else if (mode === 'grid')                  html = this.panelGrid(selected);
        else if (mode === 'grid-add-element')      html = this.panelColumn(selected.column, true);
        else if (mode === 'grid-element')          html = this.panelElement(selected);
        else if (mode === 'grid-column-settings')  html = this.panelGridColumnSettings(selected);
        $('#editorPanel').html(html);

        this._syncPreviewSelection();

        if ((mode === 'element' || mode === 'grid-element') && selected && selected.element.plugin_type === 'text') {
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
                    <button class="btn btn--success btn--full" id="btnSaveSectionName" data-id="${section.id}">Salvar nome</button>

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
                        <label>Imagem de fundo</label>
                        <input type="file" id="sectionBgImageFile" accept="image/*" style="display:none">
                        <button type="button" class="btn btn--secondary btn--full" id="btnSectionBgImagePick">
                            ${st.bg_image ? 'Trocar imagem' : 'Enviar imagem'}
                        </button>
                        ${st.bg_image ? `
                            <div class="bgImagePreview">
                                <img src="${st.bg_image}" alt="">
                                <button type="button" class="btn btn--danger btn--sm btn--full" id="btnSectionBgImageRemove">Remover imagem</button>
                            </div>` : ''}
                    </div>
                    <div class="panelField" ${st.bg_image ? '' : 'style="display:none"'} id="sectionBgImageOptions">
                        <label>Repetição</label>
                        <select class="input sectionStyleInput" id="sectionBgRepeat">
                            <option value="no-repeat" ${(st.bg_repeat||'no-repeat') === 'no-repeat' ? 'selected' : ''}>Não repetir</option>
                            <option value="repeat"    ${st.bg_repeat === 'repeat'    ? 'selected' : ''}>Repetir</option>
                            <option value="repeat-x"  ${st.bg_repeat === 'repeat-x'  ? 'selected' : ''}>Repetir horizontalmente</option>
                            <option value="repeat-y"  ${st.bg_repeat === 'repeat-y'  ? 'selected' : ''}>Repetir verticalmente</option>
                        </select>
                    </div>
                    <div class="panelField" ${st.bg_image ? '' : 'style="display:none"'} id="sectionBgPositionOptions">
                        <label>Posição</label>
                        <div class="twoColGrid">
                            <select class="input sectionStyleInput" id="sectionBgPosX">
                                <option value="left"   ${st.bg_position_x === 'left'   ? 'selected' : ''}>Esquerda</option>
                                <option value="center" ${(st.bg_position_x||'center') === 'center' ? 'selected' : ''}>Centro</option>
                                <option value="right"  ${st.bg_position_x === 'right'  ? 'selected' : ''}>Direita</option>
                            </select>
                            <select class="input sectionStyleInput" id="sectionBgPosY">
                                <option value="top"    ${st.bg_position_y === 'top'    ? 'selected' : ''}>Topo</option>
                                <option value="center" ${(st.bg_position_y||'center') === 'center' ? 'selected' : ''}>Centro</option>
                                <option value="bottom" ${st.bg_position_y === 'bottom' ? 'selected' : ''}>Baixo</option>
                            </select>
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
                    <button class="btn btn--success btn--full" id="btnSaveSectionStyles" data-id="${section.id}">Salvar alterações</button>

                    <div class="panelDivider"></div>
                    <button class="btn btn--danger btn--full" id="btnDeleteSection" data-id="${section.id}">Excluir seção</button>
                    <div class="panelDivider"></div>
                    <button class="btn btn--secondary btn--full btnBack">← Voltar</button>
                </div>
            </div>`;
    },

    panelColumn(column, isNested = false) {
        return `
            <div class="panelBody">
                <div class="panelSection">
                    <h4>Adicionar elemento</h4>
                    <p class="panelHint">Escolha o tipo de conteúdo para esta coluna:</p>
                    <div class="pluginList">${this._pluginButtons(column.id, !isNested)}</div>
                    <div class="panelDivider"></div>
                    <button class="btn btn--secondary btn--full btnBack">← Voltar</button>
                </div>
            </div>`;
    },

    _pluginButtons(columnId, includeGrid) {
        let html = `
            <button class="pluginBtn" data-plugin="text" data-column-id="${columnId}">
                <span class="pluginBtn__icon">T</span>
                <span class="pluginBtn__label">Texto</span>
            </button>
            <button class="pluginBtn" data-plugin="image" data-column-id="${columnId}">
                <span class="pluginBtn__icon">🖼</span>
                <span class="pluginBtn__label">Imagem</span>
            </button>
            <button class="pluginBtn" data-plugin="slider" data-column-id="${columnId}">
                <span class="pluginBtn__icon">🎞</span>
                <span class="pluginBtn__label">Slider</span>
            </button>
            <button class="pluginBtn" data-plugin="menu" data-column-id="${columnId}">
                <span class="pluginBtn__icon">☰</span>
                <span class="pluginBtn__label">Menu</span>
            </button>
            <button class="pluginBtn" data-plugin="button" data-column-id="${columnId}">
                <span class="pluginBtn__icon">▭</span>
                <span class="pluginBtn__label">Botão</span>
            </button>`;
        if (includeGrid) {
            html += `
            <button class="pluginBtn" data-plugin="grid" data-column-id="${columnId}">
                <span class="pluginBtn__icon">⊞</span>
                <span class="pluginBtn__label">Grid</span>
            </button>`;
        }
        return html;
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
                        <label>Imagem de fundo</label>
                        <input type="file" id="colBgImageFile" accept="image/*" style="display:none">
                        <button type="button" class="btn btn--secondary btn--full" id="btnColBgImagePick">
                            ${st.bg_image ? 'Trocar imagem' : 'Enviar imagem'}
                        </button>
                        ${st.bg_image ? `
                            <div class="bgImagePreview">
                                <img src="${st.bg_image}" alt="">
                                <button type="button" class="btn btn--danger btn--sm btn--full" id="btnColBgImageRemove">Remover imagem</button>
                            </div>` : ''}
                    </div>
                    <div class="panelField" ${st.bg_image ? '' : 'style="display:none"'} id="colBgImageOptions">
                        <label>Repetição</label>
                        <select class="input" id="colBgRepeat">
                            <option value="no-repeat" ${(st.bg_repeat||'no-repeat') === 'no-repeat' ? 'selected' : ''}>Não repetir</option>
                            <option value="repeat"    ${st.bg_repeat === 'repeat'    ? 'selected' : ''}>Repetir</option>
                            <option value="repeat-x"  ${st.bg_repeat === 'repeat-x'  ? 'selected' : ''}>Repetir horizontalmente</option>
                            <option value="repeat-y"  ${st.bg_repeat === 'repeat-y'  ? 'selected' : ''}>Repetir verticalmente</option>
                        </select>
                    </div>
                    <div class="panelField" ${st.bg_image ? '' : 'style="display:none"'} id="colBgPositionOptions">
                        <label>Posição</label>
                        <div class="twoColGrid">
                            <select class="input" id="colBgPosX">
                                <option value="left"   ${st.bg_position_x === 'left'   ? 'selected' : ''}>Esquerda</option>
                                <option value="center" ${(st.bg_position_x||'center') === 'center' ? 'selected' : ''}>Centro</option>
                                <option value="right"  ${st.bg_position_x === 'right'  ? 'selected' : ''}>Direita</option>
                            </select>
                            <select class="input" id="colBgPosY">
                                <option value="top"    ${st.bg_position_y === 'top'    ? 'selected' : ''}>Topo</option>
                                <option value="center" ${(st.bg_position_y||'center') === 'center' ? 'selected' : ''}>Centro</option>
                                <option value="bottom" ${st.bg_position_y === 'bottom' ? 'selected' : ''}>Baixo</option>
                            </select>
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
                    <button class="btn btn--success btn--full" id="btnSaveColumnStyles" data-id="${column.id}">Salvar alterações</button>

                    <div class="panelDivider"></div>
                    <button class="btn btn--secondary btn--full btnBack">← Voltar</button>
                </div>
            </div>`;
    },

    panelElement(data) {
        const { element } = data;
        if (element.plugin_type === 'text') {
            const c = element.content || {};
            const m = c.margin || {};
            return `
                <div class="panelBody">
                    <div class="panelSection">
                        <h4>Texto</h4>
                        <div class="panelField">
                            <label>Conteúdo</label>
                            <div id="quillEditor" class="quillEditor"></div>
                        </div>

                        <div class="panelDivider"></div>
                        <div class="panelField">
                            <label>Tamanho da fonte (px)</label>
                            <input type="number" class="input" id="textFontSizeInput" min="12" max="80" value="${c.font_size || ''}" placeholder="Ex: 16">
                        </div>

                        <div class="panelDivider"></div>
                        <div class="panelField">
                            <label>Cor do texto</label>
                            <div class="colorRow">
                                <input type="color" class="colorInput" id="textColorPicker" value="${c.text_color || '#000000'}">
                                <input type="text" class="input" id="textColorHex" value="${c.text_color || ''}" placeholder="#000000" maxlength="7">
                            </div>
                        </div>

                        <div class="panelDivider"></div>
                        <div class="panelField">
                            <label>Margem (px)</label>
                            <div class="spacingGrid">
                                <div class="spacingGrid__row">
                                    <div class="spacingGrid__field"><label>↑ Cima</label>
                                        <input type="number" class="input textMarginInput" id="textMarginTop" value="${m.top || 0}" min="0"></div>
                                    <div class="spacingGrid__field"><label>↓ Baixo</label>
                                        <input type="number" class="input textMarginInput" id="textMarginBottom" value="${m.bottom || 0}" min="0"></div>
                                </div>
                                <div class="spacingGrid__row">
                                    <div class="spacingGrid__field"><label>← Esq.</label>
                                        <input type="number" class="input textMarginInput" id="textMarginLeft" value="${m.left || 0}" min="0"></div>
                                    <div class="spacingGrid__field"><label>→ Dir.</label>
                                        <input type="number" class="input textMarginInput" id="textMarginRight" value="${m.right || 0}" min="0"></div>
                                </div>
                            </div>
                        </div>

                        <button class="btn btn--success btn--full" id="btnApplyTextStyle">Aplicar alterações</button>

                        <div class="panelDivider"></div>
                        <button class="btn btn--danger btn--full" id="btnDeleteElement" data-id="${element.id}">Remover elemento</button>
                        <div class="panelDivider"></div>
                        <button class="btn btn--secondary btn--full btnBack">← Voltar</button>
                    </div>
                </div>`;
        }

        if (element.plugin_type === 'image') {
            const c = element.content || {};
            return `
                <div class="panelBody">
                    <div class="panelSection">
                        <h4>Imagem</h4>
                        <div class="panelField">
                            <label>Imagem</label>
                            <input type="file" id="imageFile" accept="image/*" style="display:none">
                            <button type="button" class="btn btn--secondary btn--full" id="btnImagePick">
                                ${c.image_url ? 'Trocar imagem' : 'Enviar imagem'}
                            </button>
                            ${c.image_url ? `
                                <div class="bgImagePreview">
                                    <img src="${c.image_url}" alt="">
                                    <button type="button" class="btn btn--danger btn--sm btn--full" id="btnImageRemove">Remover imagem</button>
                                </div>` : ''}
                        </div>

                        <div class="panelDivider"></div>
                        <div class="panelField">
                            <label>Texto alternativo (alt)</label>
                            <input type="text" class="input" id="imageAlt" value="${this.escHtml(c.alt || '')}" placeholder="Descrição da imagem">
                        </div>

                        <div class="panelDivider"></div>
                        <div class="panelField">
                            <label>Link ao clicar (opcional)</label>
                            <input type="text" class="input" id="imageLink" value="${this.escHtml(c.link_url || '')}" placeholder="https://...">
                        </div>

                        <div class="panelDivider"></div>
                        <div class="panelField">
                            <label>Alinhamento</label>
                            <select class="input" id="imageAlign">
                                <option value="left"   ${c.align === 'left'   ? 'selected' : ''}>Esquerda</option>
                                <option value="center" ${(c.align||'center') === 'center' ? 'selected' : ''}>Centro</option>
                                <option value="right"  ${c.align === 'right'  ? 'selected' : ''}>Direita</option>
                            </select>
                        </div>

                        <div class="panelDivider"></div>
                        <div class="panelField">
                            <label>Largura</label>
                            <div class="dimensionRow">
                                <input type="number" class="input" id="imageWidthVal" value="${c.width_value || ''}" min="0" placeholder="100%">
                                <select class="input" id="imageWidthUnit">
                                    <option value="%"  ${(c.width_unit||'%') === '%'  ? 'selected' : ''}>%</option>
                                    <option value="px" ${c.width_unit === 'px' ? 'selected' : ''}>px</option>
                                </select>
                            </div>
                        </div>

                        <div class="panelDivider"></div>
                        <div class="panelField">
                            <label>Arredondamento das bordas (px)</label>
                            <input type="number" class="input" id="imageBorderRadius" min="0" value="${c.border_radius || 0}">
                        </div>

                        <button class="btn btn--success btn--full" id="btnApplyImageStyle">Salvar alterações</button>

                        <div class="panelDivider"></div>
                        <button class="btn btn--danger btn--full" id="btnDeleteElement" data-id="${element.id}">Remover elemento</button>
                        <div class="panelDivider"></div>
                        <button class="btn btn--secondary btn--full btnBack">← Voltar</button>
                    </div>
                </div>`;
        }

        if (element.plugin_type === 'slider') {
            const c        = element.content || {};
            const images   = c.images   || [];
            const settings = c.settings || {};

            const imagesHtml = images.map((img, idx) => `
                <div class="sliderImageItem" data-image-id="${img.id}">
                    <img class="sliderImageItem__thumb" src="${img.url}" alt="">
                    <div class="sliderImageItem__fields">
                        <input type="text" class="input sliderImgAlt" data-image-id="${img.id}" value="${this.escHtml(img.alt || '')}" placeholder="Texto alternativo (alt)">
                        <input type="text" class="input sliderImgLink" data-image-id="${img.id}" value="${this.escHtml(img.link_url || '')}" placeholder="Link ao clicar (opcional)">
                    </div>
                    <div class="sliderImageItem__actions">
                        <button class="btnSliderImgUp" data-image-id="${img.id}" ${idx === 0 ? 'disabled' : ''} title="Mover para cima">↑</button>
                        <button class="btnSliderImgDown" data-image-id="${img.id}" ${idx === images.length - 1 ? 'disabled' : ''} title="Mover para baixo">↓</button>
                        <button class="btnSliderImgRemove" data-image-id="${img.id}" title="Remover">✕</button>
                    </div>
                </div>`).join('');

            return `
                <div class="panelBody">
                    <div class="panelSection">
                        <h4>Slider de Imagens</h4>

                        <div class="panelField">
                            <label>Imagens</label>
                            <div class="sliderImageList">${imagesHtml || '<p class="panelHint">Nenhuma imagem ainda.</p>'}</div>
                            <input type="file" id="sliderImageFile" accept="image/*" style="display:none">
                            <button type="button" class="btn btn--secondary btn--full" id="btnSliderAddImage">+ Adicionar imagem</button>
                        </div>

                        <div class="panelDivider"></div>
                        <div class="panelField">
                            <label>Itens visíveis por vez</label>
                            <input type="number" class="input" id="sliderSlidesToShow" min="1" max="8" value="${settings.slides_to_show || 1}">
                        </div>
                        <div class="panelField">
                            <label>Itens que avançam por vez</label>
                            <input type="number" class="input" id="sliderSlidesToScroll" min="1" max="8" value="${settings.slides_to_scroll || 1}">
                        </div>

                        <div class="panelDivider"></div>
                        <div class="panelField panelField--toggle">
                            <label>Autoplay</label>
                            <input type="checkbox" id="sliderAutoplay" ${settings.autoplay ? 'checked' : ''}>
                        </div>
                        <div class="panelField" id="sliderAutoplaySpeedRow" ${settings.autoplay ? '' : 'style="display:none"'}>
                            <label>Velocidade do autoplay (ms)</label>
                            <input type="number" class="input" id="sliderAutoplaySpeed" min="500" step="100" value="${settings.autoplay_speed || 3000}">
                        </div>

                        <div class="panelDivider"></div>
                        <div class="panelField">
                            <label>Velocidade da transição (ms)</label>
                            <input type="number" class="input" id="sliderSpeed" min="100" step="50" value="${settings.speed || 500}">
                        </div>

                        <div class="panelDivider"></div>
                        <div class="panelField panelField--toggle">
                            <label>Efeito fade (em vez de deslizar)</label>
                            <input type="checkbox" id="sliderFade" ${settings.fade ? 'checked' : ''}>
                        </div>
                        <div class="panelField panelField--toggle">
                            <label>Loop infinito</label>
                            <input type="checkbox" id="sliderInfinite" ${settings.infinite !== false ? 'checked' : ''}>
                        </div>
                        <div class="panelDivider"></div>
                        <div class="panelField panelField--toggle">
                            <label>Setas — Desktop</label>
                            <input type="checkbox" id="sliderArrowsDesktop" ${settings.arrows_desktop !== false ? 'checked' : ''}>
                        </div>
                        <div class="panelField panelField--toggle">
                            <label>Setas — Mobile</label>
                            <input type="checkbox" id="sliderArrowsMobile" ${settings.arrows_mobile !== false ? 'checked' : ''}>
                        </div>
                        <div class="panelField panelField--toggle">
                            <label>Bolinhas — Desktop</label>
                            <input type="checkbox" id="sliderDotsDesktop" ${settings.dots_desktop !== false ? 'checked' : ''}>
                        </div>
                        <div class="panelField panelField--toggle">
                            <label>Bolinhas — Mobile</label>
                            <input type="checkbox" id="sliderDotsMobile" ${settings.dots_mobile !== false ? 'checked' : ''}>
                        </div>

                        <div class="panelDivider"></div>
                        <div class="panelField">
                            <label>Cor das setas e bolinhas</label>
                            <div class="colorRow">
                                <input type="color" class="colorInput" id="sliderAccentColor" value="${settings.accent_color || '#222222'}">
                                <input type="text" class="input" id="sliderAccentColorHex" value="${settings.accent_color || ''}" placeholder="#222222">
                            </div>
                        </div>

                        <div class="panelDivider"></div>
                        <div class="panelField">
                            <label>Cor de fundo</label>
                            <div class="colorRow">
                                <input type="checkbox" id="sliderUseBg" ${settings.bg_color ? 'checked' : ''} />
                                <input type="color" class="colorInput" id="sliderBgColor" value="${settings.bg_color || '#ffffff'}" ${settings.bg_color ? '' : 'disabled'} />
                                <label for="sliderUseBg" class="colorRowLabel">Ativar cor</label>
                            </div>
                        </div>

                        <div class="panelDivider"></div>
                        <div class="panelField">
                            <label>Arredondamento das bordas (px)</label>
                            <input type="number" class="input" id="sliderBorderRadius" min="0" value="${settings.border_radius || 0}">
                        </div>

                        <button class="btn btn--success btn--full" id="btnApplySliderStyle">Salvar alterações</button>

                        <div class="panelDivider"></div>
                        <button class="btn btn--danger btn--full" id="btnDeleteElement" data-id="${element.id}">Remover elemento</button>
                        <div class="panelDivider"></div>
                        <button class="btn btn--secondary btn--full btnBack">← Voltar</button>
                    </div>
                </div>`;
        }

        if (element.plugin_type === 'menu') {
            const c        = element.content || {};
            const items    = c.items    || [];
            const settings = c.settings || {};
            const pages    = (typeof ALL_PAGES !== 'undefined' && ALL_PAGES) || [];

            const itemsHtml = items.map((item, idx) => {
                const linkType = item.link_type || 'url';
                const pageOpts = pages.map(p =>
                    `<option value="${p.id}" ${parseInt(item.page_id) === p.id ? 'selected' : ''}>${this.escHtml(p.title)} (/${this.escHtml(p.slug)})</option>`
                ).join('');

                return `
                    <div class="menuItemRow" data-item-id="${item.id}">
                        <div class="menuItemRow__row">
                            <input type="text" class="input menuItemLabel" data-item-id="${item.id}" value="${this.escHtml(item.label || '')}" placeholder="Texto do item">
                            <select class="input menuItemLinkType" data-item-id="${item.id}">
                                <option value="page" ${linkType === 'page' ? 'selected' : ''}>Página</option>
                                <option value="url"  ${linkType === 'url'  ? 'selected' : ''}>URL</option>
                            </select>
                        </div>
                        <div class="menuItemRow__row">
                            <select class="input menuItemPageSelect" data-item-id="${item.id}" ${linkType === 'page' ? '' : 'style="display:none"'}>
                                <option value="">— Selecione a página —</option>
                                ${pageOpts}
                            </select>
                            <input type="text" class="input menuItemUrl" data-item-id="${item.id}" value="${this.escHtml(item.url || '')}" placeholder="https://... ou /pagina" ${linkType === 'page' ? 'style="display:none"' : ''}>
                        </div>
                        <div class="menuItemRow__row menuItemRow__actions">
                            <label class="menuItemRow__blankLabel">
                                <input type="checkbox" class="menuItemBlank" data-item-id="${item.id}" ${item.target_blank ? 'checked' : ''}> Nova aba
                            </label>
                            <div class="menuItemRow__buttons">
                                <button class="btnMenuItemUp" data-item-id="${item.id}" ${idx === 0 ? 'disabled' : ''} title="Mover para cima">↑</button>
                                <button class="btnMenuItemDown" data-item-id="${item.id}" ${idx === items.length - 1 ? 'disabled' : ''} title="Mover para baixo">↓</button>
                                <button class="btnMenuItemRemove" data-item-id="${item.id}" title="Remover">✕</button>
                            </div>
                        </div>
                    </div>`;
            }).join('');

            return `
                <div class="panelBody">
                    <div class="panelSection">
                        <h4>Menu</h4>

                        <div class="panelField">
                            <label>Itens do menu</label>
                            <div class="menuItemList">${itemsHtml || '<p class="panelHint">Nenhum item ainda.</p>'}</div>
                            <button type="button" class="btn btn--secondary btn--full" id="btnMenuAddItem">+ Adicionar item</button>
                        </div>

                        <div class="panelDivider"></div>
                        <div class="panelField">
                            <label>Alinhamento</label>
                            <select class="input" id="menuAlign">
                                <option value="left"   ${(settings.align||'left') === 'left'   ? 'selected' : ''}>Esquerda</option>
                                <option value="center" ${settings.align === 'center' ? 'selected' : ''}>Centro</option>
                                <option value="right"  ${settings.align === 'right'  ? 'selected' : ''}>Direita</option>
                            </select>
                        </div>
                        <div class="panelField">
                            <label>Espaçamento entre itens (px)</label>
                            <input type="number" class="input" id="menuGap" min="0" value="${settings.gap || 24}">
                        </div>
                        <div class="panelField">
                            <label>Tamanho da fonte (px)</label>
                            <input type="number" class="input" id="menuFontSize" min="10" value="${settings.font_size || 16}">
                        </div>

                        <div class="panelDivider"></div>
                        <div class="panelField">
                            <label>Cor do texto</label>
                            <div class="colorRow">
                                <input type="color" class="colorInput" id="menuTextColor" value="${settings.text_color || '#222222'}">
                                <input type="text" class="input" id="menuTextColorHex" value="${settings.text_color || ''}" placeholder="#222222">
                            </div>
                        </div>
                        <div class="panelField">
                            <label>Cor ao passar o mouse</label>
                            <div class="colorRow">
                                <input type="color" class="colorInput" id="menuHoverColor" value="${settings.hover_color || '#ae272c'}">
                                <input type="text" class="input" id="menuHoverColorHex" value="${settings.hover_color || ''}" placeholder="#ae272c">
                            </div>
                        </div>
                        <div class="panelField">
                            <label>Cor do ícone do menu (mobile)</label>
                            <div class="colorRow">
                                <input type="color" class="colorInput" id="menuBurgerColor" value="${settings.burger_color || '#222222'}">
                                <input type="text" class="input" id="menuBurgerColorHex" value="${settings.burger_color || ''}" placeholder="#222222">
                            </div>
                        </div>

                        <button class="btn btn--success btn--full" id="btnApplyMenuStyle">Salvar alterações</button>

                        <div class="panelDivider"></div>
                        <button class="btn btn--danger btn--full" id="btnDeleteElement" data-id="${element.id}">Remover elemento</button>
                        <div class="panelDivider"></div>
                        <button class="btn btn--secondary btn--full btnBack">← Voltar</button>
                    </div>
                </div>`;
        }

        if (element.plugin_type === 'button') {
            return this.panelButtonElement(element);
        }

        return `<div class="panelBody"><div class="panelSection"><p class="panelHint">Plugin não suportado.</p></div></div>`;
    },

    panelButtonElement(element) {
        const c        = element.content || {};
        const p        = c.padding        || {};
        const m        = c.margin         || {};
        const br       = c.border_radius  || {};
        const sh       = c.shadow         || {};
        const linkType = c.link_type || 'url';
        const pages    = (typeof ALL_PAGES !== 'undefined' && ALL_PAGES) || [];

        const pageOpts = pages.map(p2 =>
            `<option value="${p2.id}" ${parseInt(c.page_id) === p2.id ? 'selected' : ''}>${this.escHtml(p2.title)} (/${this.escHtml(p2.slug)})</option>`
        ).join('');

        const spacingInputs = (prefix, vals) => `
            <div class="spacingGrid">
                <div class="spacingGrid__row">
                    <div class="spacingGrid__field"><label>↑ Cima</label>
                        <input type="number" class="input" id="${prefix}Top"    value="${vals.top    || 0}" min="0"></div>
                    <div class="spacingGrid__field"><label>↓ Baixo</label>
                        <input type="number" class="input" id="${prefix}Bottom" value="${vals.bottom || 0}" min="0"></div>
                </div>
                <div class="spacingGrid__row">
                    <div class="spacingGrid__field"><label>← Esq.</label>
                        <input type="number" class="input" id="${prefix}Left"   value="${vals.left   || 0}" min="0"></div>
                    <div class="spacingGrid__field"><label>→ Dir.</label>
                        <input type="number" class="input" id="${prefix}Right"  value="${vals.right  || 0}" min="0"></div>
                </div>
            </div>`;

        return `
            <div class="panelBody">
                <div class="panelSection">
                    <h4>Botão</h4>

                    <div class="panelField">
                        <label>Texto do botão</label>
                        <input type="text" class="input" id="btnText" value="${this.escHtml(c.text || '')}" placeholder="Clique aqui">
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Link</label>
                        <select class="input" id="btnLinkType">
                            <option value="page" ${linkType === 'page' ? 'selected' : ''}>Página</option>
                            <option value="url"  ${linkType === 'url'  ? 'selected' : ''}>URL</option>
                        </select>
                    </div>
                    <div class="panelField">
                        <select class="input" id="btnPageSelect" ${linkType === 'page' ? '' : 'style="display:none"'}>
                            <option value="">— Selecione a página —</option>
                            ${pageOpts}
                        </select>
                        <input type="text" class="input" id="btnUrlInput" value="${this.escHtml(c.url || '')}" placeholder="https://... ou /pagina" ${linkType === 'page' ? 'style="display:none"' : ''}>
                    </div>
                    <div class="panelField panelField--toggle">
                        <label>Abrir em nova aba</label>
                        <input type="checkbox" id="btnTargetBlank" ${c.target_blank ? 'checked' : ''}>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Posição</label>
                        <select class="input" id="btnAlign">
                            <option value="left"   ${(c.align||'left') === 'left'   ? 'selected' : ''}>Esquerda</option>
                            <option value="center" ${c.align === 'center' ? 'selected' : ''}>Centro</option>
                            <option value="right"  ${c.align === 'right'  ? 'selected' : ''}>Direita</option>
                        </select>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Largura</label>
                        <div class="dimensionRow">
                            <input type="number" class="input" id="btnWidthVal" value="${c.width_value || ''}" min="0" placeholder="auto">
                            <select class="input" id="btnWidthUnit">
                                <option value="px" ${(c.width_unit||'px') === 'px' ? 'selected' : ''}>px</option>
                                <option value="%"  ${c.width_unit === '%'  ? 'selected' : ''}>%</option>
                            </select>
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Altura</label>
                        <div class="dimensionRow">
                            <input type="number" class="input" id="btnHeightVal" value="${c.height_value || ''}" min="0" placeholder="auto">
                            <select class="input" id="btnHeightUnit">
                                <option value="px" ${(c.height_unit||'px') === 'px' ? 'selected' : ''}>px</option>
                                <option value="%"  ${c.height_unit === '%'  ? 'selected' : ''}>%</option>
                            </select>
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Espaço interno — padding (px)</label>
                        ${spacingInputs('btnPad', p)}
                    </div>
                    <div class="panelField">
                        <label>Margem (px)</label>
                        ${spacingInputs('btnMar', m)}
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Cor do botão</label>
                        <div class="colorRow">
                            <input type="color" class="colorInput" id="btnBgColor" value="${c.bg_color || '#ae272c'}">
                            <input type="text" class="input" id="btnBgColorHex" value="${c.bg_color || ''}" placeholder="#ae272c">
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Cor do texto</label>
                        <div class="colorRow">
                            <input type="color" class="colorInput" id="btnTextColor" value="${c.text_color || '#ffffff'}">
                            <input type="text" class="input" id="btnTextColorHex" value="${c.text_color || ''}" placeholder="#ffffff">
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Cor do botão (hover)</label>
                        <div class="colorRow">
                            <input type="color" class="colorInput" id="btnHoverBgColor" value="${c.hover_bg_color || '#8a1f23'}">
                            <input type="text" class="input" id="btnHoverBgColorHex" value="${c.hover_bg_color || ''}" placeholder="#8a1f23">
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Cor do texto (hover)</label>
                        <div class="colorRow">
                            <input type="color" class="colorInput" id="btnHoverTextColor" value="${c.hover_text_color || '#ffffff'}">
                            <input type="text" class="input" id="btnHoverTextColorHex" value="${c.hover_text_color || ''}" placeholder="#ffffff">
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Borda (px)</label>
                        <div class="borderRow">
                            <input type="number" class="input borderWidth" id="btnBorderWidth" value="${c.border_width || 0}" min="0" max="50">
                            <span class="borderUnit">px</span>
                            <input type="color" class="colorInput" id="btnBorderColor" value="${c.border_color || '#000000'}" />
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Arredondamento dos cantos (px)</label>
                        <div class="spacingGrid">
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>↖ Sup. Esq.</label>
                                    <input type="number" class="input" id="btnRadiusTL" value="${br.tl || 0}" min="0"></div>
                                <div class="spacingGrid__field"><label>↗ Sup. Dir.</label>
                                    <input type="number" class="input" id="btnRadiusTR" value="${br.tr || 0}" min="0"></div>
                            </div>
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>↙ Inf. Esq.</label>
                                    <input type="number" class="input" id="btnRadiusBL" value="${br.bl || 0}" min="0"></div>
                                <div class="spacingGrid__field"><label>↘ Inf. Dir.</label>
                                    <input type="number" class="input" id="btnRadiusBR" value="${br.br || 0}" min="0"></div>
                            </div>
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Sombra</label>
                        <div class="colorRow">
                            <input type="checkbox" id="btnShadowEnabled" ${sh.enabled ? 'checked' : ''} />
                            <label for="btnShadowEnabled" class="colorRowLabel">Ativar sombra</label>
                        </div>
                    </div>
                    <div id="btnShadowControls" ${sh.enabled ? '' : 'style="display:none"'}>
                        <div class="panelField">
                            <label>Cor da sombra</label>
                            <div class="colorRow">
                                <input type="color" class="colorInput" id="btnShadowColor" value="${sh.color || '#000000'}">
                            </div>
                        </div>
                        <div class="twoColGrid">
                            <div class="panelField">
                                <label>Tamanho (px)</label>
                                <input type="number" class="input" id="btnShadowSize"  value="${sh.size     || 0}" min="0">
                            </div>
                            <div class="panelField">
                                <label>Distância (px)</label>
                                <input type="number" class="input" id="btnShadowDist"  value="${sh.distance || 0}" min="0">
                            </div>
                        </div>
                        <div class="twoColGrid">
                            <div class="panelField">
                                <label>Ângulo (°)</label>
                                <input type="number" class="input" id="btnShadowAngle" value="${sh.angle   !== undefined ? sh.angle   : 135}" min="0" max="360">
                            </div>
                            <div class="panelField">
                                <label>Opacidade (%)</label>
                                <input type="number" class="input" id="btnShadowOp"    value="${sh.opacity !== undefined ? sh.opacity : 30}"  min="0" max="100">
                            </div>
                        </div>
                    </div>

                    <button class="btn btn--success btn--full" id="btnApplyButtonStyle">Salvar alterações</button>

                    <div class="panelDivider"></div>
                    <button class="btn btn--danger btn--full" id="btnDeleteElement" data-id="${element.id}">Remover elemento</button>
                    <div class="panelDivider"></div>
                    <button class="btn btn--secondary btn--full btnBack">← Voltar</button>
                </div>
            </div>`;
    },

    panelGrid(data) {
        const { element } = data;
        const columns = element.content.columns || [];

        const colBtns = [1,2,3,4,5,6].map(n =>
            `<button class="colPicker__btn ${columns.length === n ? 'active' : ''}" data-cols="${n}">
                ${n}${n === 5 ? '<small>⊞</small>' : ''}
             </button>`
        ).join('');

        const colsHtml = columns.map(col => {
            const elems = (col.elements || []).map(e => `
                <div class="gridStructureElement" data-grid-col-id="${col.id}" data-grid-el-id="${e.id}">
                    <span class="structureElement__badge">${this.escHtml(e.plugin_type)}</span>
                    <span class="structureElement__label">${this._elementPreviewLabel(e)}</span>
                </div>`).join('');

            return `
                <div class="structureCol">
                    <div class="structureCol__header">
                        <span>${this._colLabel(col.col_size)}</span>
                        <button class="structureCol__gear btnGridColumnSettings" data-grid-col-id="${col.id}" title="Configurações da coluna">⚙</button>
                    </div>
                    ${elems ? `<div class="structureCol__elements">${elems}</div>` : ''}
                    <button class="structureCol__add btnGridAddElement" data-grid-col-id="${col.id}">+ Novo elemento</button>
                </div>`;
        }).join('');

        return `
            <div class="panelBody">
                <div class="panelSection">
                    <h4>Grid</h4>
                    <div class="panelField">
                        <label>Colunas</label>
                        <div class="colPicker">${colBtns}</div>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Conteúdo</label>
                        <div class="structureList">${colsHtml}</div>
                    </div>

                    <div class="panelDivider"></div>
                    <button class="btn btn--danger btn--full" id="btnDeleteElement" data-id="${element.id}">Remover grid</button>
                    <div class="panelDivider"></div>
                    <button class="btn btn--secondary btn--full btnBack">← Voltar</button>
                </div>
            </div>`;
    },

    panelGridColumnSettings(data) {
        const { column } = data;
        const st    = column.styles || {};
        const br    = st.border_radius || {};
        const p     = st.padding || {};
        const m     = st.margin  || {};
        const hasBg = !!st.bg_color;

        const spacingInputs = (prefix, vals) => `
            <div class="spacingGrid">
                <div class="spacingGrid__row">
                    <div class="spacingGrid__field"><label>↑ Cima</label>
                        <input type="number" class="input" id="${prefix}Top"    value="${vals.top    || 0}" min="0"></div>
                    <div class="spacingGrid__field"><label>↓ Baixo</label>
                        <input type="number" class="input" id="${prefix}Bottom" value="${vals.bottom || 0}" min="0"></div>
                </div>
                <div class="spacingGrid__row">
                    <div class="spacingGrid__field"><label>← Esq.</label>
                        <input type="number" class="input" id="${prefix}Left"   value="${vals.left   || 0}" min="0"></div>
                    <div class="spacingGrid__field"><label>→ Dir.</label>
                        <input type="number" class="input" id="${prefix}Right"  value="${vals.right  || 0}" min="0"></div>
                </div>
            </div>`;

        return `
            <div class="panelBody">
                <div class="panelSection">
                    <h4>Coluna do Grid</h4>

                    <div class="panelField">
                        <label>Cor de fundo</label>
                        <div class="colorRow">
                            <input type="checkbox" id="gridColUseBg" ${hasBg ? 'checked' : ''} />
                            <input type="color" id="gridColBgColor" class="colorInput" value="${st.bg_color || '#ffffff'}" ${hasBg ? '' : 'disabled'} />
                            <label for="gridColUseBg" class="colorRowLabel">Ativar cor</label>
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Imagem de fundo</label>
                        <input type="file" id="gridColBgImageFile" accept="image/*" style="display:none">
                        <button type="button" class="btn btn--secondary btn--full" id="btnGridColBgImagePick">
                            ${st.bg_image ? 'Trocar imagem' : 'Enviar imagem'}
                        </button>
                        ${st.bg_image ? `
                            <div class="bgImagePreview">
                                <img src="${st.bg_image}" alt="">
                                <button type="button" class="btn btn--danger btn--sm btn--full" id="btnGridColBgImageRemove">Remover imagem</button>
                            </div>` : ''}
                    </div>
                    <div class="panelField" ${st.bg_image ? '' : 'style="display:none"'} id="gridColBgImageOptions">
                        <label>Repetição</label>
                        <select class="input" id="gridColBgRepeat">
                            <option value="no-repeat" ${(st.bg_repeat||'no-repeat') === 'no-repeat' ? 'selected' : ''}>Não repetir</option>
                            <option value="repeat"    ${st.bg_repeat === 'repeat'    ? 'selected' : ''}>Repetir</option>
                            <option value="repeat-x"  ${st.bg_repeat === 'repeat-x'  ? 'selected' : ''}>Repetir horizontalmente</option>
                            <option value="repeat-y"  ${st.bg_repeat === 'repeat-y'  ? 'selected' : ''}>Repetir verticalmente</option>
                        </select>
                    </div>
                    <div class="panelField" ${st.bg_image ? '' : 'style="display:none"'} id="gridColBgPositionOptions">
                        <label>Posição</label>
                        <div class="twoColGrid">
                            <select class="input" id="gridColBgPosX">
                                <option value="left"   ${st.bg_position_x === 'left'   ? 'selected' : ''}>Esquerda</option>
                                <option value="center" ${(st.bg_position_x||'center') === 'center' ? 'selected' : ''}>Centro</option>
                                <option value="right"  ${st.bg_position_x === 'right'  ? 'selected' : ''}>Direita</option>
                            </select>
                            <select class="input" id="gridColBgPosY">
                                <option value="top"    ${st.bg_position_y === 'top'    ? 'selected' : ''}>Topo</option>
                                <option value="center" ${(st.bg_position_y||'center') === 'center' ? 'selected' : ''}>Centro</option>
                                <option value="bottom" ${st.bg_position_y === 'bottom' ? 'selected' : ''}>Baixo</option>
                            </select>
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Borda (px)</label>
                        <div class="borderRow">
                            <input type="number" class="input borderWidth" id="gridColBorderWidth" value="${st.border_width || 0}" min="0" max="50">
                            <span class="borderUnit">px</span>
                            <input type="color" class="colorInput" id="gridColBorderColor" value="${st.border_color || '#000000'}" />
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Arredondamento dos cantos (px)</label>
                        <div class="spacingGrid">
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>↖ Sup. Esq.</label>
                                    <input type="number" class="input" id="gridColRadiusTL" value="${br.tl || 0}" min="0"></div>
                                <div class="spacingGrid__field"><label>↗ Sup. Dir.</label>
                                    <input type="number" class="input" id="gridColRadiusTR" value="${br.tr || 0}" min="0"></div>
                            </div>
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>↙ Inf. Esq.</label>
                                    <input type="number" class="input" id="gridColRadiusBL" value="${br.bl || 0}" min="0"></div>
                                <div class="spacingGrid__field"><label>↘ Inf. Dir.</label>
                                    <input type="number" class="input" id="gridColRadiusBR" value="${br.br || 0}" min="0"></div>
                            </div>
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Espaço interno — padding (px)</label>
                        ${spacingInputs('gridColPad', p)}
                    </div>
                    <div class="panelField">
                        <label>Margem (px)</label>
                        ${spacingInputs('gridColMar', m)}
                    </div>

                    <button class="btn btn--success btn--full" id="btnSaveGridColumnStyles">Salvar alterações</button>

                    <div class="panelDivider"></div>
                    <button class="btn btn--secondary btn--full btnBack">← Voltar</button>
                </div>
            </div>`;
    },

    // ── Preview (center) — clean, no labels ───────────────────
    renderPreview() {
        // Destrói as instâncias Slick existentes antes de descartar o HTML antigo —
        // sem isso, timers de autoplay e listeners ficam "fantasmas" apontando pra nós já removidos.
        if ($.fn.slick) {
            $('#editorCanvas .plugin-slider.slick-initialized').slick('unslick');
        }

        const html = this.data.length
            ? this.data.map(s => this.renderSection(s)).join('')
            : `<div class="editorCanvas__empty">
                <p>Nenhuma seção ainda.</p>
                <p>Use o painel à esquerda para começar.</p>
               </div>`;
        $('#editorCanvas').html(html);

        // Inicializa o Slick em todos os sliders do preview (inclusive aninhados em Grid).
        if ($.fn.slick) {
            $('#editorCanvas .plugin-slider').each(function () {
                $(this).slick();
            });
        }
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
        const c       = element.content || {};
        const preview = element.plugin_type === 'grid'
            ? this.renderGridElement(element)
            : this._renderLeafPreviewHtml(element);
        const wrapperStyle = this._elementWrapperStyle(c);

        return `
            <div class="editorElement" data-element-id="${element.id}" data-plugin="${element.plugin_type}">
                <div class="previewElement" data-element-id="${element.id}"${wrapperStyle ? ` style="${wrapperStyle}"` : ''}>${preview}</div>
            </div>`;
    },

    _renderLeafPreviewHtml(element) {
        const c = element.content || {};

        if (element.plugin_type === 'text') {
            if (c.html !== undefined) {
                return c.html || '<em class="previewEmpty">Texto vazio</em>';
            }
            const weight = c.bold ? '600' : '400';
            const txt    = c.text
                ? c.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')
                : '<em class="previewEmpty">Texto vazio</em>';
            return `<p style="font-weight:${weight}">${txt}</p>`;
        }

        if (element.plugin_type === 'image') {
            return this._renderImagePreview(c);
        }

        if (element.plugin_type === 'slider') {
            return this._renderSliderPreview(c);
        }

        if (element.plugin_type === 'menu') {
            return this._renderMenuPreview(c);
        }

        if (element.plugin_type === 'button') {
            return this._renderButtonPreview(c);
        }

        return '';
    },

    // Mesma estrutura/estilo usados na página publicada, pra refletir de verdade
    // alinhamento, espaçamento, cores e tamanho de fonte configurados.
    _renderMenuPreview(c) {
        const items = c.items || [];
        if (!items.length) return '<em class="previewEmpty">Nenhum item no menu</em>';

        const itemsHtml = items
            .map(i => `<li class="plugin-menu__item"><a href="#">${this.escHtml(i.label || '(sem texto)')}</a></li>`)
            .join('');
        const styleAttr = this._buildMenuStyleAttr(c.settings || {});

        return `<nav class="plugin-menu"${styleAttr}>
            <button type="button" class="plugin-menu__burger"><span></span><span></span><span></span></button>
            <ul class="plugin-menu__list">${itemsHtml}</ul>
        </nav>`;
    },

    _buildMenuStyleAttr(s) {
        const align = ['left', 'center', 'right'].includes(s.align) ? s.align : 'left';
        const vars  = {
            '--menu-align':    align,
            '--menu-gap':      `${Math.max(0, parseInt(s.gap) || 24)}px`,
            '--menu-color':    s.text_color   || '#222222',
            '--menu-hover':    s.hover_color  || '#ae272c',
            '--menu-fontsize': `${Math.max(10, parseInt(s.font_size) || 16)}px`,
            '--menu-burger':   s.burger_color || '#222222',
        };
        let css = '';
        for (const key in vars) css += `${key}:${vars[key]};`;
        return ` style="${css}"`;
    },

    // Mesma estrutura/CSS vars do PHP (ButtonPlugin) — geometria (tamanho, padding,
    // margem, borda, sombra) vai inline; cor normal/hover vai como CSS var, já que
    // hover não pode ser feito com style inline (precisa de uma regra :hover própria).
    _renderButtonPreview(c) {
        const text = (c.text || '').trim();
        if (!text) return '<em class="previewEmpty">Botão sem texto</em>';

        const align     = ['left', 'center', 'right'].includes(c.align) ? c.align : 'left';
        const geometry  = this._buildButtonGeometryStyle(c);
        const colorVars = this._buildButtonColorVarsAttr(c);

        return `<div class="plugin-button plugin-button--${align}"${colorVars}>
            <a class="plugin-button__link" href="#"${geometry ? ` style="${geometry}"` : ''}>${this.escHtml(text)}</a>
        </div>`;
    },

    _buildButtonGeometryStyle(c) {
        let css = '';
        if (c.width_value)  css += `width:${c.width_value}${c.width_unit || 'px'};`;
        if (c.height_value) css += `height:${c.height_value}${c.height_unit || 'px'};`;

        const p = c.padding || {};
        if (p.top || p.right || p.bottom || p.left)
            css += `padding:${p.top||0}px ${p.right||0}px ${p.bottom||0}px ${p.left||0}px;`;

        const m = c.margin || {};
        if (m.top || m.right || m.bottom || m.left)
            css += `margin:${m.top||0}px ${m.right||0}px ${m.bottom||0}px ${m.left||0}px;`;

        if (c.border_width > 0)
            css += `border:${c.border_width}px solid ${c.border_color || '#000000'};`;

        const br = c.border_radius || {};
        if (br.tl || br.tr || br.br || br.bl)
            css += `border-radius:${br.tl||0}px ${br.tr||0}px ${br.br||0}px ${br.bl||0}px;`;

        const sh = c.shadow;
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

    _buildButtonColorVarsAttr(c) {
        const vars = {
            '--btn-bg':          c.bg_color         || '#ae272c',
            '--btn-color':       c.text_color       || '#ffffff',
            '--btn-hover-bg':    c.hover_bg_color   || '#8a1f23',
            '--btn-hover-color': c.hover_text_color || '#ffffff',
        };
        let css = '';
        for (const key in vars) css += `${key}:${vars[key]};`;
        return ` style="${css}"`;
    },

    // Mesma estrutura usada na página publicada — o Slick é inicializado de fato
    // no preview do editor também (ver renderPreview(), que destrói/reinicializa
    // as instâncias a cada re-render do canvas).
    _renderSliderPreview(c) {
        const images = c.images || [];
        if (!images.length) return '<em class="previewEmpty">Nenhuma imagem no slider</em>';
        const settingsJson = this.escHtml(this._buildSlickSettingsJson(c.settings || {}));
        const styleAttr     = this._buildSliderStyleAttr(c.settings || {});
        const slides = images.map(img => `<div class="plugin-slider__slide"><img src="${img.url}" alt=""></div>`).join('');
        return `<div class="plugin-slider"${styleAttr} data-slick="${settingsJson}">${slides}</div>`;
    },

    // Mesma cor configurável usada no PHP (SliderPlugin::buildStyleAttr) — não depende
    // de @primary, que é diferente entre o bundle admin e o bundle público.
    _buildSliderStyleAttr(s) {
        let color = (s.accent_color || '').trim();
        if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) color = '#222222';
        const [r, g, b] = this._hexToRgb(color);
        let css = `--slider-accent:${color};--slider-arrow-bg:rgba(${r},${g},${b},0.35);`;
        if (s.bg_color) css += `background-color:${s.bg_color};`;
        if (s.border_radius) css += `border-radius:${s.border_radius}px;overflow:hidden;`;
        return ` style="${css}"`;
    },

    _hexToRgb(hex) {
        let h = hex.replace('#', '');
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        const num = parseInt(h, 16);
        return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    },

    _normalizeColor(hexVal, fallbackVal) {
        let v = (hexVal || '').trim();
        if (v && !v.startsWith('#')) v = '#' + v;
        return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : fallbackVal;
    },

    _buildSlickSettingsJson(s) {
        const fade = !!s.fade;
        return JSON.stringify({
            slidesToShow:   fade ? 1 : Math.max(1, parseInt(s.slides_to_show)   || 1),
            slidesToScroll: fade ? 1 : Math.max(1, parseInt(s.slides_to_scroll) || 1),
            autoplay:       !!s.autoplay,
            autoplaySpeed:  Math.max(500, parseInt(s.autoplay_speed) || 3000),
            speed:          Math.max(100, parseInt(s.speed) || 500),
            infinite:       s.infinite !== false,
            arrows:         s.arrows_desktop !== false,
            dots:           s.dots_desktop   !== false,
            fade,
            responsive: [
                {
                    breakpoint: 767,
                    settings: {
                        arrows: s.arrows_mobile !== false,
                        dots:   s.dots_mobile   !== false,
                    }
                }
            ]
        });
    },

    // ── Grid (elemento que aninha colunas+elementos dentro de outro elemento) ──
    renderGridElement(element) {
        const columns = (element.content && element.content.columns) || [];
        if (!columns.length) {
            return '<em class="previewEmpty">Grid vazio</em>';
        }
        const cols = columns.map(col => this.renderGridColumn(col, element.id)).join('');
        return `<div class="editorGrid"><div class="row editorGridRow">${cols}</div></div>`;
    },

    renderGridColumn(col, gridId) {
        const elements    = (col.elements || []).map(e => this.renderGridLeafElement(e, gridId, col.id)).join('');
        const inlineStyle = this._buildInlineStyle(col.styles || {});
        return `
            <div class="col-${col.col_size} editorGridColumn ${elements ? '' : 'editorGridColumn--empty'}" data-grid-id="${gridId}" data-grid-col-id="${col.id}"${inlineStyle ? ` style="${inlineStyle}"` : ''}>
                ${elements}
            </div>`;
    },

    renderGridLeafElement(element, gridId, colId) {
        const preview = this._renderLeafPreviewHtml(element);
        return `
            <div class="editorGridElement" data-grid-id="${gridId}" data-grid-col-id="${colId}" data-grid-el-id="${element.id}" data-plugin="${element.plugin_type}">
                <div class="previewElement">${preview}</div>
            </div>`;
    },

    _elementWrapperStyle(content) {
        let css = '';
        if (content.font_size)  css += `font-size:${content.font_size}px;`;
        if (content.text_color) css += `color:${content.text_color};`;
        const m = content.margin || {};
        if (m.top || m.right || m.bottom || m.left)
            css += `margin:${m.top||0}px ${m.right||0}px ${m.bottom||0}px ${m.left||0}px;`;
        return css;
    },

    _renderImagePreview(c) {
        if (!c.image_url) return '<em class="previewEmpty">Nenhuma imagem selecionada</em>';
        const align = c.align || 'center';
        let css = '';
        if (c.width_value)   css += `width:${c.width_value}${c.width_unit || '%'};`;
        if (c.border_radius) css += `border-radius:${c.border_radius}px;`;
        const imgStyle = css ? ` style="${css}"` : '';
        return `<div class="pluginImagePreview pluginImagePreview--${align}"><img src="${c.image_url}" alt="${this.escHtml(c.alt || '')}"${imgStyle}></div>`;
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
                    ['link'],
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

    saveElementStyleFields() {
        if (!['element', 'grid-element'].includes(this.state.mode)) return;
        const { element } = this.state.selected;
        const c = element.content || {};

        let fontSize = parseInt($('#textFontSizeInput').val());
        if (!isNaN(fontSize)) {
            fontSize = Math.min(80, Math.max(12, fontSize));
            $('#textFontSizeInput').val(fontSize);
        } else {
            fontSize = '';
        }

        const margin = {
            top:    parseInt($('#textMarginTop').val())    || 0,
            right:  parseInt($('#textMarginRight').val())  || 0,
            bottom: parseInt($('#textMarginBottom').val()) || 0,
            left:   parseInt($('#textMarginLeft').val())   || 0,
        };

        let textColor = $('#textColorHex').val().trim();
        if (textColor && !textColor.startsWith('#')) textColor = '#' + textColor;
        const validHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(textColor);
        textColor = validHex ? textColor : '';
        $('#textColorHex').val(textColor);
        if (textColor) $('#textColorPicker').val(textColor);

        const content = { ...c, font_size: fontSize, text_color: textColor, margin };
        this._persistElementContent(content);
    },

    saveImageElementFields() {
        if (!['element', 'grid-element'].includes(this.state.mode)) return;
        const { element } = this.state.selected;
        const c = element.content || {};

        const content = {
            ...c,
            alt:           $('#imageAlt').val().trim(),
            link_url:      $('#imageLink').val().trim(),
            align:         $('#imageAlign').val() || 'center',
            width_value:   parseInt($('#imageWidthVal').val()) || '',
            width_unit:    $('#imageWidthUnit').val() || '%',
            border_radius: parseInt($('#imageBorderRadius').val()) || 0,
        };
        this._persistElementContent(content);
    },

    saveSliderElementFields() {
        if (!['element', 'grid-element'].includes(this.state.mode)) return;
        const { element } = this.state.selected;
        const c = element.content || {};

        const images = (c.images || []).map(img => ({
            ...img,
            alt:      $(`.sliderImgAlt[data-image-id="${img.id}"]`).val().trim(),
            link_url: $(`.sliderImgLink[data-image-id="${img.id}"]`).val().trim(),
        }));

        const settings = {
            slides_to_show:   Math.max(1, parseInt($('#sliderSlidesToShow').val())   || 1),
            slides_to_scroll: Math.max(1, parseInt($('#sliderSlidesToScroll').val()) || 1),
            autoplay:         $('#sliderAutoplay').is(':checked'),
            autoplay_speed:   Math.max(500, parseInt($('#sliderAutoplaySpeed').val()) || 3000),
            speed:            Math.max(100, parseInt($('#sliderSpeed').val()) || 500),
            fade:             $('#sliderFade').is(':checked'),
            infinite:         $('#sliderInfinite').is(':checked'),
            arrows_desktop:   $('#sliderArrowsDesktop').is(':checked'),
            arrows_mobile:    $('#sliderArrowsMobile').is(':checked'),
            dots_desktop:     $('#sliderDotsDesktop').is(':checked'),
            dots_mobile:      $('#sliderDotsMobile').is(':checked'),
            accent_color:     this._normalizeColor($('#sliderAccentColorHex').val(), $('#sliderAccentColor').val()),
            bg_color:         $('#sliderUseBg').is(':checked') ? $('#sliderBgColor').val() : '',
            border_radius:    parseInt($('#sliderBorderRadius').val()) || 0,
        };

        this._persistElementContent({ images, settings });
    },

    saveMenuElementFields() {
        if (!['element', 'grid-element'].includes(this.state.mode)) return;
        const { element } = this.state.selected;
        const c = element.content || {};

        const items = (c.items || []).map(item => {
            const row = $(`.menuItemRow[data-item-id="${item.id}"]`);
            return {
                ...item,
                label:        row.find('.menuItemLabel').val().trim(),
                link_type:    row.find('.menuItemLinkType').val() || 'url',
                page_id:      row.find('.menuItemPageSelect').val() || '',
                url:          row.find('.menuItemUrl').val().trim(),
                target_blank: row.find('.menuItemBlank').is(':checked'),
            };
        });

        const settings = {
            align:        $('#menuAlign').val() || 'left',
            gap:          Math.max(0, parseInt($('#menuGap').val()) || 0),
            font_size:    Math.max(10, parseInt($('#menuFontSize').val()) || 16),
            text_color:   this._normalizeColor($('#menuTextColorHex').val(),   $('#menuTextColor').val()),
            hover_color:  this._normalizeColor($('#menuHoverColorHex').val(),  $('#menuHoverColor').val()),
            burger_color: this._normalizeColor($('#menuBurgerColorHex').val(), $('#menuBurgerColor').val()),
        };

        this._persistElementContent({ items, settings });
    },

    saveButtonElementFields() {
        if (!['element', 'grid-element'].includes(this.state.mode)) return;

        const content = {
            text:              $('#btnText').val().trim(),
            link_type:         $('#btnLinkType').val() || 'url',
            page_id:           $('#btnPageSelect').val() || '',
            url:               $('#btnUrlInput').val().trim(),
            target_blank:      $('#btnTargetBlank').is(':checked'),
            align:             $('#btnAlign').val() || 'left',
            width_value:       parseInt($('#btnWidthVal').val())  || '',
            width_unit:        $('#btnWidthUnit').val()  || 'px',
            height_value:      parseInt($('#btnHeightVal').val()) || '',
            height_unit:       $('#btnHeightUnit').val() || 'px',
            padding: {
                top:    parseInt($('#btnPadTop').val())    || 0,
                right:  parseInt($('#btnPadRight').val())  || 0,
                bottom: parseInt($('#btnPadBottom').val()) || 0,
                left:   parseInt($('#btnPadLeft').val())   || 0,
            },
            margin: {
                top:    parseInt($('#btnMarTop').val())    || 0,
                right:  parseInt($('#btnMarRight').val())  || 0,
                bottom: parseInt($('#btnMarBottom').val()) || 0,
                left:   parseInt($('#btnMarLeft').val())   || 0,
            },
            bg_color:          this._normalizeColor($('#btnBgColorHex').val(),         $('#btnBgColor').val()),
            text_color:        this._normalizeColor($('#btnTextColorHex').val(),       $('#btnTextColor').val()),
            hover_bg_color:    this._normalizeColor($('#btnHoverBgColorHex').val(),    $('#btnHoverBgColor').val()),
            hover_text_color:  this._normalizeColor($('#btnHoverTextColorHex').val(),  $('#btnHoverTextColor').val()),
            border_width:      parseInt($('#btnBorderWidth').val()) || 0,
            border_color:      $('#btnBorderColor').val() || '#000000',
            border_radius: {
                tl: parseInt($('#btnRadiusTL').val()) || 0,
                tr: parseInt($('#btnRadiusTR').val()) || 0,
                br: parseInt($('#btnRadiusBR').val()) || 0,
                bl: parseInt($('#btnRadiusBL').val()) || 0,
            },
            shadow: {
                enabled:  $('#btnShadowEnabled').is(':checked'),
                color:    $('#btnShadowColor').val() || '#000000',
                size:     parseInt($('#btnShadowSize').val())  || 0,
                distance: parseInt($('#btnShadowDist').val())  || 0,
                angle:    parseInt($('#btnShadowAngle').val()) || 0,
                opacity:  parseInt($('#btnShadowOp').val())    || 0,
            },
        };

        this._persistElementContent(content);
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
            if (data) { E.state = { mode: E._modeForElement(data.element), selected: data, selectedCols: 1 }; E.renderPanel(); }
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
            if ($(e.target).closest('.slick-arrow, .slick-dots').length) return;
            e.stopPropagation();
            const id   = parseInt($(this).data('element-id'));
            const data = E.findElement(id);
            if (data) { E.state = { mode: E._modeForElement(data.element), selected: data, selectedCols: 1 }; E.renderPanel(); }
        });

        // Grid: open nested element for editing (canvas click)
        $(document).on('click', '.editorGridElement', function (e) {
            if ($(e.target).closest('.slick-arrow, .slick-dots').length) return;
            e.stopPropagation();
            const gridId   = parseInt($(this).data('grid-id'));
            const colId    = parseInt($(this).data('grid-col-id'));
            const elId     = parseInt($(this).data('grid-el-id'));
            const gridData = E.findElement(gridId);
            if (!gridData) return;
            const gridElement = gridData.element;
            const column      = (gridElement.content.columns || []).find(c => c.id === colId);
            const element     = column && (column.elements || []).find(el => el.id === elId);
            if (column && element) {
                E.state = { mode: 'grid-element', selected: { gridElement, column, element }, selectedCols: 1 };
                E.renderPanel();
            }
        });

        // Grid: click empty grid column to add element (canvas click)
        $(document).on('click', '.editorGridColumn', function (e) {
            if ($(e.target).closest('.editorGridElement').length) return;
            const gridId   = parseInt($(this).data('grid-id'));
            const colId    = parseInt($(this).data('grid-col-id'));
            const gridData = E.findElement(gridId);
            if (!gridData) return;
            const gridElement = gridData.element;
            const column      = (gridElement.content.columns || []).find(c => c.id === colId);
            if (column) {
                E.state = { mode: 'grid-add-element', selected: { gridElement, column }, selectedCols: 1 };
                E.renderPanel();
            }
        });

        // Grid: open nested element for editing (structure list click)
        $(document).on('click', '.gridStructureElement', function (e) {
            e.stopPropagation();
            if (E.state.mode !== 'grid') return;
            const { element: gridElement } = E.state.selected;
            const colId   = parseInt($(this).data('grid-col-id'));
            const elId    = parseInt($(this).data('grid-el-id'));
            const column  = (gridElement.content.columns || []).find(c => c.id === colId);
            const element = column && (column.elements || []).find(el => el.id === elId);
            if (column && element) {
                E.state = { mode: 'grid-element', selected: { gridElement, column, element }, selectedCols: 1 };
                E.renderPanel();
            }
        });

        // Grid: "+ Novo elemento" button for a specific grid column
        $(document).on('click', '.btnGridAddElement', function (e) {
            e.stopPropagation();
            if (E.state.mode !== 'grid') return;
            const { element: gridElement } = E.state.selected;
            const colId  = parseInt($(this).data('grid-col-id'));
            const column = (gridElement.content.columns || []).find(c => c.id === colId);
            if (column) {
                E.state = { mode: 'grid-add-element', selected: { gridElement, column }, selectedCols: 1 };
                E.renderPanel();
            }
        });

        // Grid: open column settings (border, radius, background)
        $(document).on('click', '.btnGridColumnSettings', function (e) {
            e.stopPropagation();
            if (E.state.mode !== 'grid') return;
            const { element: gridElement } = E.state.selected;
            const colId  = parseInt($(this).data('grid-col-id'));
            const column = (gridElement.content.columns || []).find(c => c.id === colId);
            if (column) {
                E.state = { mode: 'grid-column-settings', selected: { gridElement, column }, selectedCols: 1 };
                E.renderPanel();
            }
        });

        // Grid column: bg color toggle (visual only)
        $(document).on('change', '#gridColUseBg', function () {
            $('#gridColBgColor').prop('disabled', !this.checked);
        });

        // Grid column: background image (upload/remove atualiza local; persiste só no "Salvar alterações")
        $(document).on('click', '#btnGridColBgImagePick', () => $('#gridColBgImageFile').trigger('click'));

        $(document).on('change', '#gridColBgImageFile', function () {
            const file = this.files[0];
            if (!file || E.state.mode !== 'grid-column-settings') return;
            const { column } = E.state.selected;

            const formData = new FormData();
            formData.append('image', file);

            $.ajax({
                url: ADMIN_BASE_URL + '/services/editor/upload_image.php',
                method: 'POST',
                data: formData,
                processData: false,
                contentType: false
            }).done(res => {
                if (res.success) {
                    column.styles = column.styles || {};
                    column.styles.bg_image = res.url;
                    E.renderPanel();
                } else { alert(res.message); }
            }).fail(() => alert('Erro ao enviar imagem.'));
        });

        $(document).on('click', '#btnGridColBgImageRemove', function () {
            if (E.state.mode !== 'grid-column-settings') return;
            const { column } = E.state.selected;
            column.styles = column.styles || {};
            column.styles.bg_image = '';
            E.renderPanel();
        });

        // Grid column: explicit save button
        $(document).on('click', '#btnSaveGridColumnStyles', () => E.saveGridColumnStyles());

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
            } else if (E.state.mode === 'grid' && E.state.selected) {
                const { element } = E.state.selected;
                if (cols !== (element.content.columns || []).length) {
                    E.updateGridColumns(element, cols);
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
            const plugin = $(this).data('plugin');
            if (E.state.mode === 'grid-add-element') {
                E.addGridElement(plugin);
                return;
            }
            const columnId = parseInt($(this).data('column-id'));
            E.addElement(columnId, plugin);
        });

        // Delete element
        $(document).on('click', '#btnDeleteElement', function () {
            if (E.state.mode === 'grid-element') {
                if (confirm('Remover este elemento?')) E.deleteGridElement();
                return;
            }
            const id = parseInt($(this).data('id'));
            if (confirm('Remover este elemento?')) E.deleteElement(id);
        });

        // Section styles: toggle bg color enable (visual only, saved via "Salvar alterações")
        $(document).on('change', '#sectionUseBg', function () {
            $('#sectionBgColor').prop('disabled', !this.checked);
        });

        // Section styles: background image (upload/remove atualiza local; persiste só no "Salvar alterações")
        $(document).on('click', '#btnSectionBgImagePick', () => $('#sectionBgImageFile').trigger('click'));

        $(document).on('change', '#sectionBgImageFile', function () {
            const file = this.files[0];
            if (!file || E.state.mode !== 'section' || !E.state.selected) return;
            const sectionId = E.state.selected.id;

            const formData = new FormData();
            formData.append('image', file);

            $.ajax({
                url: ADMIN_BASE_URL + '/services/editor/upload_image.php',
                method: 'POST',
                data: formData,
                processData: false,
                contentType: false
            }).done(res => {
                if (res.success) {
                    const s = E.findSection(sectionId);
                    if (s) {
                        s.styles = s.styles || {};
                        s.styles.bg_image = res.url;
                        E.state = { mode: 'section', selected: s, selectedCols: 1 };
                        E.renderPanel();
                        E.renderPreview();
                    }
                } else { alert(res.message); }
            }).fail(() => alert('Erro ao enviar imagem.'));
        });

        $(document).on('click', '#btnSectionBgImageRemove', function () {
            if (E.state.mode !== 'section' || !E.state.selected) return;
            const sectionId = E.state.selected.id;
            const s = E.findSection(sectionId);
            if (s) {
                s.styles = s.styles || {};
                s.styles.bg_image = '';
                E.renderPanel();
                E.renderPreview();
            }
        });

        // Section styles: floating toggle (visual only)
        $(document).on('change', '#sectionFloating', function () {
            $('#zIndexRow').toggle(this.checked);
        });

        // Section: shadow toggle (visual only)
        $(document).on('change', '#sectionShadowEnabled', function () {
            $('#sectionShadowControls').toggle(this.checked);
        });

        // Section: explicit save button
        $(document).on('click', '#btnSaveSectionStyles', function () {
            E.saveSectionStyles(parseInt($(this).data('id')));
        });

        // Column: open settings
        $(document).on('click', '.btnColumnSettings', function (e) {
            e.stopPropagation();
            const id     = parseInt($(this).data('column-id'));
            const column = E.findColumn(id);
            if (column) { E.state = { mode: 'column-settings', selected: column, selectedCols: 1 }; E.renderPanel(); }
        });

        // Column: bg color toggle (visual only)
        $(document).on('change', '#colUseBg', function () {
            $('#colBgColor').prop('disabled', !this.checked);
        });

        // Column: background image (upload/remove atualiza local; persiste só no "Salvar alterações")
        $(document).on('click', '#btnColBgImagePick', () => $('#colBgImageFile').trigger('click'));

        $(document).on('change', '#colBgImageFile', function () {
            const file = this.files[0];
            if (!file || E.state.mode !== 'column-settings' || !E.state.selected) return;
            const columnId = E.state.selected.id;

            const formData = new FormData();
            formData.append('image', file);

            $.ajax({
                url: ADMIN_BASE_URL + '/services/editor/upload_image.php',
                method: 'POST',
                data: formData,
                processData: false,
                contentType: false
            }).done(res => {
                if (res.success) {
                    const col = E.findColumn(columnId);
                    if (col) {
                        col.styles = col.styles || {};
                        col.styles.bg_image = res.url;
                        E.state = { mode: 'column-settings', selected: col, selectedCols: 1 };
                        E.renderPanel();
                        E.renderPreview();
                    }
                } else { alert(res.message); }
            }).fail(() => alert('Erro ao enviar imagem.'));
        });

        $(document).on('click', '#btnColBgImageRemove', function () {
            if (E.state.mode !== 'column-settings' || !E.state.selected) return;
            const columnId = E.state.selected.id;
            const col = E.findColumn(columnId);
            if (col) {
                col.styles = col.styles || {};
                col.styles.bg_image = '';
                E.renderPanel();
                E.renderPreview();
            }
        });

        // Column: shadow toggle (visual only)
        $(document).on('change', '#colShadowEnabled', function () {
            $('#colShadowControls').toggle(this.checked);
        });

        // Column: explicit save button
        $(document).on('click', '#btnSaveColumnStyles', function () {
            E.saveColumnStyles(parseInt($(this).data('id')));
        });

        // Text element: color picker ↔ hex input sync
        $(document).on('input change', '#textColorPicker', function () {
            $('#textColorHex').val($(this).val());
        });

        // Text element: font size + color + margin
        $(document).on('click', '#btnApplyTextStyle', () => E.saveElementStyleFields());

        // Image element: upload/remove atualiza local; persiste só no "Salvar alterações"
        $(document).on('click', '#btnImagePick', () => $('#imageFile').trigger('click'));

        $(document).on('change', '#imageFile', function () {
            const file = this.files[0];
            if (!file || !['element', 'grid-element'].includes(E.state.mode)) return;
            const { element } = E.state.selected;

            const formData = new FormData();
            formData.append('image', file);

            $.ajax({
                url: ADMIN_BASE_URL + '/services/editor/upload_image.php',
                method: 'POST',
                data: formData,
                processData: false,
                contentType: false
            }).done(res => {
                if (res.success) {
                    element.content = { ...element.content, image_url: res.url };
                    E.renderPanel();
                    E.renderPreview();
                } else { alert(res.message); }
            }).fail(() => alert('Erro ao enviar imagem.'));
        });

        $(document).on('click', '#btnImageRemove', function () {
            if (!['element', 'grid-element'].includes(E.state.mode)) return;
            const { element } = E.state.selected;
            element.content = { ...element.content, image_url: '' };
            E.renderPanel();
            E.renderPreview();
        });

        $(document).on('click', '#btnApplyImageStyle', () => E.saveImageElementFields());

        // Slider element: add image (atualiza local; persiste só no "Salvar alterações")
        $(document).on('click', '#btnSliderAddImage', () => $('#sliderImageFile').trigger('click'));

        $(document).on('change', '#sliderImageFile', function () {
            const file = this.files[0];
            if (!file || !['element', 'grid-element'].includes(E.state.mode)) return;
            const { element } = E.state.selected;

            const formData = new FormData();
            formData.append('image', file);

            $.ajax({
                url: ADMIN_BASE_URL + '/services/editor/upload_image.php',
                method: 'POST',
                data: formData,
                processData: false,
                contentType: false
            }).done(res => {
                if (res.success) {
                    const content = element.content || {};
                    content.images = E._syncSliderImagesFromDom(content.images || []);
                    content.images.push({ id: E._genLocalId(), url: res.url, alt: '', link_url: '' });
                    element.content = content;
                    E.renderPanel();
                    E.renderPreview();
                } else { alert(res.message); }
            }).fail(() => alert('Erro ao enviar imagem.'));
        });

        $(document).on('click', '.btnSliderImgRemove', function () {
            if (!['element', 'grid-element'].includes(E.state.mode)) return;
            const { element } = E.state.selected;
            const imgId = parseInt($(this).data('image-id'));
            element.content.images = E._syncSliderImagesFromDom(element.content.images || []).filter(img => img.id !== imgId);
            E.renderPanel();
            E.renderPreview();
        });

        $(document).on('click', '.btnSliderImgUp, .btnSliderImgDown', function () {
            if (!['element', 'grid-element'].includes(E.state.mode)) return;
            const { element } = E.state.selected;
            const images = E._syncSliderImagesFromDom(element.content.images || []);
            const imgId  = parseInt($(this).data('image-id'));
            const idx    = images.findIndex(img => img.id === imgId);
            const dir    = $(this).hasClass('btnSliderImgUp') ? -1 : 1;
            const newIdx = idx + dir;
            if (idx === -1 || newIdx < 0 || newIdx >= images.length) return;
            [images[idx], images[newIdx]] = [images[newIdx], images[idx]];
            element.content.images = images;
            E.renderPanel();
            E.renderPreview();
        });

        // Slider element: autoplay toggle (visual only)
        $(document).on('change', '#sliderAutoplay', function () {
            $('#sliderAutoplaySpeedRow').toggle(this.checked);
        });

        $(document).on('click', '#btnApplySliderStyle', () => E.saveSliderElementFields());

        // Menu element: add/remove/reorder items (atualiza local; persiste só no "Salvar alterações")
        $(document).on('click', '#btnMenuAddItem', function () {
            if (!['element', 'grid-element'].includes(E.state.mode)) return;
            const { element } = E.state.selected;
            const content = element.content || {};
            content.items = E._syncMenuItemsFromDom(content.items || []);
            content.items.push({ id: E._genLocalId(), label: '', link_type: 'url', page_id: '', url: '', target_blank: false });
            element.content = content;
            E.renderPanel();
            E.renderPreview();
        });

        // Menu item: alterna entre selecionar página ou digitar URL (visual only)
        $(document).on('change', '.menuItemLinkType', function () {
            const row    = $(this).closest('.menuItemRow');
            const isPage = $(this).val() === 'page';
            row.find('.menuItemPageSelect').toggle(isPage);
            row.find('.menuItemUrl').toggle(!isPage);
        });

        $(document).on('click', '.btnMenuItemRemove', function () {
            if (!['element', 'grid-element'].includes(E.state.mode)) return;
            const { element } = E.state.selected;
            const itemId = parseInt($(this).data('item-id'));
            element.content.items = E._syncMenuItemsFromDom(element.content.items || []).filter(i => i.id !== itemId);
            E.renderPanel();
            E.renderPreview();
        });

        $(document).on('click', '.btnMenuItemUp, .btnMenuItemDown', function () {
            if (!['element', 'grid-element'].includes(E.state.mode)) return;
            const { element } = E.state.selected;
            const items  = E._syncMenuItemsFromDom(element.content.items || []);
            const itemId = parseInt($(this).data('item-id'));
            const idx    = items.findIndex(i => i.id === itemId);
            const dir    = $(this).hasClass('btnMenuItemUp') ? -1 : 1;
            const newIdx = idx + dir;
            if (idx === -1 || newIdx < 0 || newIdx >= items.length) return;
            [items[idx], items[newIdx]] = [items[newIdx], items[idx]];
            element.content.items = items;
            E.renderPanel();
            E.renderPreview();
        });

        // Menu: color pickers ↔ hex inputs sync
        $(document).on('input change', '#menuTextColor',   function () { $('#menuTextColorHex').val($(this).val()); });
        $(document).on('input change', '#menuHoverColor',  function () { $('#menuHoverColorHex').val($(this).val()); });
        $(document).on('input change', '#menuBurgerColor', function () { $('#menuBurgerColorHex').val($(this).val()); });

        // Slider: color picker ↔ hex input sync
        $(document).on('input change', '#sliderAccentColor', function () { $('#sliderAccentColorHex').val($(this).val()); });

        // Slider: bg color toggle (visual only)
        $(document).on('change', '#sliderUseBg', function () {
            $('#sliderBgColor').prop('disabled', !this.checked);
        });

        $(document).on('click', '#btnApplyMenuStyle', () => E.saveMenuElementFields());

        // Button: link type toggle (visual only)
        $(document).on('change', '#btnLinkType', function () {
            const isPage = $(this).val() === 'page';
            $('#btnPageSelect').toggle(isPage);
            $('#btnUrlInput').toggle(!isPage);
        });

        // Button: shadow toggle (visual only)
        $(document).on('change', '#btnShadowEnabled', function () {
            $('#btnShadowControls').toggle(this.checked);
        });

        // Button: color pickers ↔ hex inputs sync
        $(document).on('input change', '#btnBgColor',         function () { $('#btnBgColorHex').val($(this).val()); });
        $(document).on('input change', '#btnTextColor',        function () { $('#btnTextColorHex').val($(this).val()); });
        $(document).on('input change', '#btnHoverBgColor',     function () { $('#btnHoverBgColorHex').val($(this).val()); });
        $(document).on('input change', '#btnHoverTextColor',   function () { $('#btnHoverTextColorHex').val($(this).val()); });

        $(document).on('click', '#btnApplyButtonStyle', () => E.saveButtonElementFields());

        // Back
        $(document).on('click', '.btnBack', () => {
            if (['grid-element', 'grid-add-element', 'grid-column-settings'].includes(E.state.mode)) {
                const { gridElement } = E.state.selected;
                E.state = { mode: 'grid', selected: { element: gridElement, column: null }, selectedCols: 1 };
            } else {
                E.state = { mode: 'default', selected: null, selectedCols: 1 };
            }
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
        const useBg        = $('#sectionUseBg').is(':checked');
        const widthVal     = parseInt($('#sectionWidthVal').val())  || 0;
        const heightVal    = parseInt($('#sectionHeightVal').val()) || 0;
        const shadowOn     = $('#sectionShadowEnabled').is(':checked');
        const existingStyles = (this.findSection(id) || {}).styles || {};
        const styles = {
            bg_color:       useBg ? $('#sectionBgColor').val() : '',
            bg_image:       existingStyles.bg_image || '',
            bg_repeat:      $('#sectionBgRepeat').val() || 'no-repeat',
            bg_position_x:  $('#sectionBgPosX').val()   || 'center',
            bg_position_y:  $('#sectionBgPosY').val()   || 'center',
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
        const shadowOn       = $('#colShadowEnabled').is(':checked');
        const useBg          = $('#colUseBg').is(':checked');
        const existingStyles = (this.findColumn(id) || {}).styles || {};
        const styles = {
            bg_color:      useBg ? $('#colBgColor').val() : '',
            bg_image:      existingStyles.bg_image || '',
            bg_repeat:     $('#colBgRepeat').val() || 'no-repeat',
            bg_position_x: $('#colBgPosX').val()   || 'center',
            bg_position_y: $('#colBgPosY').val()   || 'center',
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
        if (styles.bg_image) {
            css += `background-image:url('${styles.bg_image}');`;
            css += `background-repeat:${styles.bg_repeat || 'no-repeat'};`;
            css += `background-position:${styles.bg_position_x || 'center'} ${styles.bg_position_y || 'center'};`;
        }
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
                    if (pluginType === 'grid') {
                        res.element.content = {
                            columns: [
                                { id: this._genLocalId(), col_size: 6, elements: [] },
                                { id: this._genLocalId(), col_size: 6, elements: [] },
                            ]
                        };
                        this.saveGridContent(res.element);
                    }
                    this.state = { mode: this._modeForElement(res.element), selected: { element: res.element, column: col }, selectedCols: 1 };
                    this.renderPanel();
                    this.renderPreview();
                }
            } else { alert(res.message); }
        });
    },

    saveElementContent() {
        if (!['element', 'grid-element'].includes(this.state.mode) || !this.quill) return;
        const { element } = this.state.selected;
        const html    = this.quill.root.innerHTML;
        const isEmpty = this.quill.getText().trim() === '';
        const content = { ...element.content, html: isEmpty ? '' : html };
        this._persistElementContent(content);
    },

    // Persiste o conteúdo do elemento selecionado, seja ele real (top-level)
    // ou aninhado dentro de um Grid (nesse caso, salva o Grid inteiro).
    _persistElementContent(content) {
        const { element } = this.state.selected;
        element.content = content;

        if (this.state.mode === 'grid-element') {
            this.saveGridContent(this.state.selected.gridElement);
            return;
        }

        $.post(ADMIN_BASE_URL + '/services/editor/save_element.php', {
            element_id: element.id, content: JSON.stringify(content)
        }).done(() => {
            this.renderPreview();
            this.showSaved();
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

    // ── Grid (elemento aninhado) ──────────────────────────────
    saveGridContent(gridElement) {
        $.post(ADMIN_BASE_URL + '/services/editor/save_element.php', {
            element_id: gridElement.id, content: JSON.stringify(gridElement.content)
        }).done(() => {
            this.renderPreview();
            this.showSaved();
        });
    },

    updateGridColumns(gridElement, newCount) {
        const cols    = gridElement.content.columns || [];
        const colSize = Math.floor(12 / newCount);

        if (newCount < cols.length) {
            const removed       = cols.splice(newCount);
            const movedElements = removed.flatMap(c => c.elements || []);
            cols[newCount - 1].elements = [...(cols[newCount - 1].elements || []), ...movedElements];
        } else {
            while (cols.length < newCount) {
                cols.push({ id: this._genLocalId(), col_size: colSize, elements: [] });
            }
        }
        cols.forEach(c => c.col_size = colSize);

        gridElement.content.columns = cols;
        this.saveGridContent(gridElement);
        this.renderPanel();
    },

    addGridElement(pluginType) {
        if (this.state.mode !== 'grid-add-element') return;
        const { gridElement, column } = this.state.selected;
        const element = { id: this._genLocalId(), plugin_type: pluginType, content: {} };
        column.elements = column.elements || [];
        column.elements.push(element);
        this.state = { mode: 'grid-element', selected: { gridElement, column, element }, selectedCols: 1 };
        this.saveGridContent(gridElement);
        this.renderPanel();
    },

    deleteGridElement() {
        if (this.state.mode !== 'grid-element') return;
        const { gridElement, column, element } = this.state.selected;
        column.elements = (column.elements || []).filter(e => e.id !== element.id);
        this.state = { mode: 'grid', selected: { element: gridElement, column: null }, selectedCols: 1 };
        this.saveGridContent(gridElement);
        this.renderPanel();
    },

    saveGridColumnStyles() {
        if (this.state.mode !== 'grid-column-settings') return;
        const { gridElement, column } = this.state.selected;

        const useBg = $('#gridColUseBg').is(':checked');
        const styles = {
            bg_color:      useBg ? $('#gridColBgColor').val() : '',
            bg_image:      (column.styles && column.styles.bg_image) || '',
            bg_repeat:     $('#gridColBgRepeat').val() || 'no-repeat',
            bg_position_x: $('#gridColBgPosX').val()   || 'center',
            bg_position_y: $('#gridColBgPosY').val()   || 'center',
            border_width:  parseInt($('#gridColBorderWidth').val()) || 0,
            border_color:  $('#gridColBorderColor').val() || '#000000',
            border_radius: {
                tl: parseInt($('#gridColRadiusTL').val()) || 0,
                tr: parseInt($('#gridColRadiusTR').val()) || 0,
                br: parseInt($('#gridColRadiusBR').val()) || 0,
                bl: parseInt($('#gridColRadiusBL').val()) || 0,
            },
            padding: {
                top:    parseInt($('#gridColPadTop').val())    || 0,
                right:  parseInt($('#gridColPadRight').val())  || 0,
                bottom: parseInt($('#gridColPadBottom').val()) || 0,
                left:   parseInt($('#gridColPadLeft').val())   || 0,
            },
            margin: {
                top:    parseInt($('#gridColMarTop').val())    || 0,
                right:  parseInt($('#gridColMarRight').val())  || 0,
                bottom: parseInt($('#gridColMarBottom').val()) || 0,
                left:   parseInt($('#gridColMarLeft').val())   || 0,
            },
        };
        column.styles = styles;
        this.saveGridContent(gridElement);
        this.renderPanel();
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
        if (['element', 'grid'].includes(this.state.mode) && this.state.selected && this.state.selected.element) {
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
        return ['element', 'grid'].includes(this.state.mode) && this.state.selected && this.state.selected.element && this.state.selected.element.id === id;
    },

    _modeForElement(element) {
        return element.plugin_type === 'grid' ? 'grid' : 'element';
    },

    _genLocalId() {
        return Date.now() * 1000 + Math.floor(Math.random() * 1000);
    },

    // Lê os valores atuais dos campos da tela de volta pro array antes de
    // adicionar/remover/reordenar — sem isso, o renderPanel() seguinte redesenha
    // a lista a partir do `content` "velho" e perde o que foi digitado e ainda não salvo.
    _syncMenuItemsFromDom(items) {
        return items.map(item => {
            const row = $(`.menuItemRow[data-item-id="${item.id}"]`);
            if (!row.length) return item;
            return {
                ...item,
                label:        row.find('.menuItemLabel').val(),
                link_type:    row.find('.menuItemLinkType').val() || 'url',
                page_id:      row.find('.menuItemPageSelect').val() || '',
                url:          row.find('.menuItemUrl').val(),
                target_blank: row.find('.menuItemBlank').is(':checked'),
            };
        });
    },

    _syncSliderImagesFromDom(images) {
        return images.map(img => {
            const row = $(`.sliderImageItem[data-image-id="${img.id}"]`);
            if (!row.length) return img;
            return {
                ...img,
                alt:      row.find('.sliderImgAlt').val(),
                link_url: row.find('.sliderImgLink').val(),
            };
        });
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
        if (element.plugin_type === 'image') {
            return c.image_url ? 'Imagem' : 'Imagem (vazia)';
        }
        if (element.plugin_type === 'grid') {
            const n = (c.columns || []).length;
            return `Grid (${n} ${n === 1 ? 'coluna' : 'colunas'})`;
        }
        if (element.plugin_type === 'slider') {
            const n = (c.images || []).length;
            return `Slider (${n} ${n === 1 ? 'imagem' : 'imagens'})`;
        }
        if (element.plugin_type === 'menu') {
            const n = (c.items || []).length;
            return `Menu (${n} ${n === 1 ? 'item' : 'itens'})`;
        }
        if (element.plugin_type === 'button') {
            const t = (c.text || '').trim();
            return t ? this.escHtml(t) : 'Botão (sem texto)';
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
