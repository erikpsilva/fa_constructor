$(document).ready(function () {
    Editor.init(PAGE_ID, PAGE_DATA);

    $(window).on('resize.editorMenuResponsive', function () {
        $('.plugin-menu').each(function () {
            const breakpoint = Math.min(2000, Math.max(320, parseInt($(this).data('menu-breakpoint')) || 767));
            $(this).toggleClass('plugin-menu--mobile', window.innerWidth <= breakpoint);
        });
    });

    // Ajusta a altura dos iframes de Header/Footer (preview-only) ao conteúdo real deles.
    $('.previewChrome').on('load', function () {
        try {
            const height = this.contentWindow.document.body.scrollHeight;
            $(this).css('height', height + 'px');
        } catch (e) { /* same-origin esperado; ignora se não conseguir medir */ }
    });

    // ── Salvar página como modelo ─────────────────────────────
    // O modal só existe quando a página editada é do tipo 'page' (não em Header/Footer/Modelo).
    $('#btnSalvarComoModelo').on('click', function () {
        $('#modeloNome').val('').closest('.formGroup__item').removeClass('error');
        $('#modalSalvarModelo').addClass('modal--open');
        $('body').addClass('modal-open');
        $('#modeloNome').focus();
    });

    $('#fecharModalSalvarModelo, #cancelarSalvarModelo').on('click', fecharModalModelo);

    $('#modalSalvarModelo').on('click', function (e) {
        if ($(e.target).hasClass('modal')) fecharModalModelo();
    });

    $('#modeloNome').on('keydown', function (e) {
        if (e.key === 'Enter') $('#confirmarSalvarModelo').click();
    });

    $('#confirmarSalvarModelo').on('click', function () {
        const nome = $('#modeloNome').val().trim();

        if (!nome) {
            $('#modeloNome').closest('.formGroup__item').addClass('error');
            return;
        }

        const btn = $(this);
        btn.prop('disabled', true).text('Salvando...');

        $.post(ADMIN_BASE_URL + '/services/save_page_as_template.php', {
            page_id: PAGE_ID,
            name:    nome
        })
        .done(function (res) {
            if (res.success) {
                fecharModalModelo();
                Editor.showSaved();
            } else {
                alert(res.message || 'Erro ao salvar o modelo.');
            }
        })
        .fail(function (xhr) {
            const res = xhr.responseJSON;
            alert(res && res.message ? res.message : 'Erro ao conectar com o servidor.');
        })
        .always(function () {
            btn.prop('disabled', false).text('Salvar modelo');
        });
    });

    function fecharModalModelo() {
        $('#modalSalvarModelo').removeClass('modal--open');
        $('body').removeClass('modal-open');
    }
});

const Editor = {

    pageId:         null,
    data:           [],
    state:          { mode: 'default', selected: null, selectedCols: 1 },
    selectedLayout: 'container',
    quill:          null,
    calcQuills:     {},

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
        this.calcQuills = {};
        const { mode, selected } = this.state;
        let html = '';
        if      (mode === 'default')          html = this.panelStructure();
        else if (mode === 'add-section')      html = this.panelAddSection();
        else if (mode === 'section')          html = this.panelSection(selected);
        else if (mode === 'column')           html = this.panelColumn(selected);
        else if (mode === 'column-settings')  html = this.panelColumnSettings(selected);
        else if (mode === 'element')          html = this.panelElement(selected);
        else if (mode === 'grid')                  html = this.panelGrid(selected);
        else if (mode === 'grid-add-element')      html = this.panelColumn(selected.column);
        else if (mode === 'grid-element')          html = this.panelElement(selected);
        else if (mode === 'grid-column-settings')  html = this.panelGridColumnSettings(selected);
        else if (mode === 'panels')                html = (selected.element || {}).plugin_type === 'flutuante'
                                                        ? this.panelFlutuanteElement(selected.element)
                                                        : this.panelPanels(selected);
        else if (mode === 'panels-add-element')    html = this.panelPanelsAddElement(selected);
        else if (mode === 'panels-element')        html = this.panelElement(selected);
        $('#editorPanel').html(html);

        this._syncPreviewSelection();

        if (['element', 'grid-element', 'panels-element'].includes(mode) && selected && selected.element.plugin_type === 'text') {
            this.initQuill(selected.element);
        }
        if (['element', 'grid-element', 'panels-element'].includes(mode) && selected && selected.element.plugin_type === 'calculadora') {
            this.initCalculadoraEditors(selected.element);
        }

        // A grade de ícones é preenchida por JS (são ~2600 ícones; montar tudo dentro
        // do template do painel deixaria a string gigante). Vale para qualquer painel
        // que tenha um seletor de ícone — hoje o plugin Ícone e o ícone do Botão.
        if ($('#iconGrid').length) {
            this.renderIconGrid($('.iconStyleTab.active').data('style') || 'solid', '');
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

    panelColumn(column) {
        return `
            <div class="panelBody">
                <div class="panelSection">
                    <h4>Adicionar elemento</h4>
                    <p class="panelHint">Escolha o tipo de conteúdo para esta coluna:</p>
                    <div class="pluginList">${this._pluginButtons(column.id)}</div>
                    <div class="panelDivider"></div>
                    <button class="btn btn--secondary btn--full btnBack">← Voltar</button>
                </div>
            </div>`;
    },

    _pluginButtons(columnId) {
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
            </button>
            <button class="pluginBtn" data-plugin="card" data-column-id="${columnId}">
                <span class="pluginBtn__icon">▤</span>
                <span class="pluginBtn__label">Card</span>
            </button>
            <button class="pluginBtn" data-plugin="icon" data-column-id="${columnId}">
                <span class="pluginBtn__icon">★</span>
                <span class="pluginBtn__label">Ícone</span>
            </button>
            <button class="pluginBtn" data-plugin="cardicon" data-column-id="${columnId}">
                <span class="pluginBtn__icon">◪</span>
                <span class="pluginBtn__label">Card com ícones</span>
            </button>
            <button class="pluginBtn" data-plugin="testimonials" data-column-id="${columnId}">
                <span class="pluginBtn__icon">❝</span>
                <span class="pluginBtn__label">Depoimentos</span>
            </button>
            <button class="pluginBtn" data-plugin="calculadora" data-column-id="${columnId}">
                <span class="pluginBtn__icon">🖩</span>
                <span class="pluginBtn__label">Calculadora</span>
            </button>`;
        // Containers (Grid/Abas/Sanfona) também podem ser criados dentro de outro
        // container — a navegação aguenta profundidade arbitrária porque a persistência
        // sempre grava o elemento raiz (ver _rootFor) e o voltar usa a pilha _stack.
        {
            html += `
            <button class="pluginBtn" data-plugin="grid" data-column-id="${columnId}">
                <span class="pluginBtn__icon">⊞</span>
                <span class="pluginBtn__label">Grid</span>
            </button>
            <button class="pluginBtn" data-plugin="tabs" data-column-id="${columnId}">
                <span class="pluginBtn__icon">⊟</span>
                <span class="pluginBtn__label">Abas</span>
            </button>
            <button class="pluginBtn" data-plugin="accordion" data-column-id="${columnId}">
                <span class="pluginBtn__icon">≡</span>
                <span class="pluginBtn__label">Sanfona</span>
            </button>
            <button class="pluginBtn" data-plugin="flutuante" data-column-id="${columnId}">
                <span class="pluginBtn__icon">✥</span>
                <span class="pluginBtn__label">Bloco flutuante</span>
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
                        <div class="panelField">
                            <label>Tamanho mínimo no celular (px)</label>
                            <input type="number" class="input" id="textFontSizeMin" min="8" max="80" value="${c.font_size_min || ''}" placeholder="automático">
                            <p class="panelNote">Deixe vazio: o texto encolhe sozinho até 65% do tamanho.</p>
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

                        <div class="panelDivider"></div>
                        <div class="panelField">
                            <label>Margem (px)</label>
                            <div class="spacingGrid">
                                <div class="spacingGrid__row">
                                    <div class="spacingGrid__field"><label>↑ Cima</label>
                                        <input type="number" class="input" id="imageMarginTop" value="${(c.margin || {}).top || 0}" min="0"></div>
                                    <div class="spacingGrid__field"><label>↓ Baixo</label>
                                        <input type="number" class="input" id="imageMarginBottom" value="${(c.margin || {}).bottom || 0}" min="0"></div>
                                </div>
                                <div class="spacingGrid__row">
                                    <div class="spacingGrid__field"><label>← Esq.</label>
                                        <input type="number" class="input" id="imageMarginLeft" value="${(c.margin || {}).left || 0}" min="0"></div>
                                    <div class="spacingGrid__field"><label>→ Dir.</label>
                                        <input type="number" class="input" id="imageMarginRight" value="${(c.margin || {}).right || 0}" min="0"></div>
                                </div>
                            </div>
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
                        ${this._menuSubmenuHtml(item, pages)}
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
                        <h4>Menu responsivo</h4>
                        <div class="panelField">
                            <label>Virar hambúrguer até (px)</label>
                            <input type="number" class="input" id="menuMobileBreakpoint" min="320" max="2000" value="${parseInt(settings.mobile_breakpoint) || 767}">
                            <p class="panelNote">Exemplo: 991 transforma o menu em hambúrguer em telas de até 991px.</p>
                        </div>
                        <div class="panelField">
                            <label>Posição do hambúrguer</label>
                            <select class="input" id="menuMobileAlign">
                                <option value="left" ${settings.mobile_align === 'left' ? 'selected' : ''}>Esquerda</option>
                                <option value="center" ${settings.mobile_align === 'center' ? 'selected' : ''}>Centro</option>
                                <option value="right" ${(settings.mobile_align || 'right') === 'right' ? 'selected' : ''}>Direita</option>
                            </select>
                        </div>
                        <div class="panelField">
                            <label>Estilo ao abrir</label>
                            <select class="input" id="menuMobileStyle">
                                <option value="dropdown" ${(settings.mobile_style || 'dropdown') === 'dropdown' ? 'selected' : ''}>Lista abaixo do botão</option>
                                <option value="fullscreen" ${settings.mobile_style === 'fullscreen' ? 'selected' : ''}>Tela inteira</option>
                            </select>
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

                        <div class="panelDivider"></div>
                        <h4>Submenu / Mega menu</h4>
                        <p class="panelNote">Vale para todos os submenus deste menu.</p>

                        <div class="twoColGrid">
                            <div class="panelField">
                                <label>Tamanho da fonte (px)</label>
                                <input type="number" class="input" id="menuSubFontSize" min="10" value="${settings.sub_font_size || 15}">
                            </div>
                            <div class="panelField">
                                <label>Espaço interno (px)</label>
                                <input type="number" class="input" id="menuSubPadding" min="0" value="${settings.sub_padding !== undefined ? settings.sub_padding : 16}">
                            </div>
                        </div>
                        <div class="panelField">
                            <label>Cor de fundo</label>
                            <div class="colorRow">
                                <input type="color" class="colorInput" id="menuSubBg" value="${settings.sub_bg || '#ffffff'}">
                                <input type="text" class="input" id="menuSubBgHex" value="${settings.sub_bg || ''}" placeholder="#ffffff">
                            </div>
                        </div>
                        <div class="panelField">
                            <label>Cor do texto</label>
                            <div class="colorRow">
                                <input type="color" class="colorInput" id="menuSubColor" value="${settings.sub_color || '#222222'}">
                                <input type="text" class="input" id="menuSubColorHex" value="${settings.sub_color || ''}" placeholder="#222222">
                            </div>
                        </div>
                        <div class="panelField">
                            <label>Cor do texto (hover)</label>
                            <div class="colorRow">
                                <input type="color" class="colorInput" id="menuSubHover" value="${settings.sub_hover || '#ae272c'}">
                                <input type="text" class="input" id="menuSubHoverHex" value="${settings.sub_hover || ''}" placeholder="#ae272c">
                            </div>
                        </div>
                        <div class="panelField">
                            <label>Fundo do item (hover)</label>
                            <div class="colorRow">
                                <input type="checkbox" id="menuSubUseHoverBg" ${settings.sub_hover_bg ? 'checked' : ''} />
                                <input type="color" class="colorInput" id="menuSubHoverBg" value="${settings.sub_hover_bg || '#f2f2f2'}" ${settings.sub_hover_bg ? '' : 'disabled'}>
                            </div>
                        </div>
                        <div class="panelField">
                            <label>Arredondamento (px)</label>
                            <input type="number" class="input" id="menuSubRadius" min="0" value="${settings.sub_radius !== undefined ? settings.sub_radius : 6}">
                        </div>
                        <div class="panelField">
                            <label>Borda (px)</label>
                            <div class="borderRow">
                                <input type="number" class="input borderWidth" id="menuSubBorderWidth" value="${settings.sub_border_width || 0}" min="0" max="20">
                                <span class="borderUnit">px</span>
                                <input type="color" class="colorInput" id="menuSubBorderColor" value="${settings.sub_border_color || '#e0e0e0'}" />
                            </div>
                        </div>
                        <div class="panelField panelField--toggle">
                            <label>Sombra</label>
                            <input type="checkbox" id="menuSubShadow" ${settings.sub_shadow !== false ? 'checked' : ''}>
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

        if (element.plugin_type === 'card') {
            return this.panelCardElement(element);
        }

        if (element.plugin_type === 'icon') {
            return this.panelIconElement(element);
        }

        if (element.plugin_type === 'cardicon') {
            return this.panelCardIconElement(element);
        }

        if (element.plugin_type === 'testimonials') {
            return this.panelTestimonialsElement(element);
        }

        if (element.plugin_type === 'calculadora') {
            return this.panelCalculadoraElement(element);
        }

        return `<div class="panelBody"><div class="panelSection"><p class="panelHint">Plugin não suportado.</p></div></div>`;
    },

    panelButtonElement(element) {
        return `
            <div class="panelBody">
                <div class="panelSection">
                    <h4>Botão</h4>
                    ${this._buttonFieldsHtml('btn', element.content || {})}

                    <button class="btn btn--success btn--full" id="btnApplyButtonStyle">Salvar alterações</button>

                    <div class="panelDivider"></div>
                    <button class="btn btn--danger btn--full" id="btnDeleteElement" data-id="${element.id}">Remover elemento</button>
                    <div class="panelDivider"></div>
                    <button class="btn btn--secondary btn--full btnBack">← Voltar</button>
                </div>
            </div>`;
    },

    // Campos do botão, compartilhados pelo elemento Botão (prefixo 'btn') e pelo botão
    // interno do Card (prefixo 'cardBtn'). Os ids saem com o prefixo, e os comportamentos
    // (troca de tipo de link, toggle de sombra) usam classe + data-prefix — assim os dois
    // painéis se comportam igual sem duplicar markup nem handler.
    _buttonFieldsHtml(prefix, c) {
        const p        = c.padding       || {};
        const m        = c.margin        || {};
        const br       = c.border_radius || {};
        const sh       = c.shadow        || {};
        const linkType = c.link_type || 'url';
        const pages    = (typeof ALL_PAGES !== 'undefined' && ALL_PAGES) || [];

        const pageOpts = pages.map(p2 =>
            `<option value="${p2.id}" ${parseInt(c.page_id) === p2.id ? 'selected' : ''}>${this.escHtml(p2.title)} (/${this.escHtml(p2.slug)})</option>`
        ).join('');

        const spacingInputs = (sub, vals) => `
            <div class="spacingGrid">
                <div class="spacingGrid__row">
                    <div class="spacingGrid__field"><label>↑ Cima</label>
                        <input type="number" class="input" id="${prefix}${sub}Top"    value="${vals.top    || 0}" min="0"></div>
                    <div class="spacingGrid__field"><label>↓ Baixo</label>
                        <input type="number" class="input" id="${prefix}${sub}Bottom" value="${vals.bottom || 0}" min="0"></div>
                </div>
                <div class="spacingGrid__row">
                    <div class="spacingGrid__field"><label>← Esq.</label>
                        <input type="number" class="input" id="${prefix}${sub}Left"   value="${vals.left   || 0}" min="0"></div>
                    <div class="spacingGrid__field"><label>→ Dir.</label>
                        <input type="number" class="input" id="${prefix}${sub}Right"  value="${vals.right  || 0}" min="0"></div>
                </div>
            </div>`;

        return `
            <div class="panelField">
                <label>Texto do botão</label>
                <input type="text" class="input" id="${prefix}Text" value="${this.escHtml(c.text || '')}" placeholder="Clique aqui">
            </div>
            <div class="panelField">
                <label>Tamanho da fonte (px)</label>
                <input type="number" class="input" id="${prefix}FontSize" value="${c.font_size || ''}" min="8" max="80" placeholder="padrão do site">
            </div>
            <div class="panelField">
                <label>Tamanho mínimo no celular (px)</label>
                <input type="number" class="input" id="${prefix}FontSizeMin" value="${c.font_size_min || ''}" min="8" max="80" placeholder="automático">
            </div>
            <div class="panelField panelField--toggle">
                <label>Negrito</label>
                <input type="checkbox" id="${prefix}Bold" ${c.bold ? 'checked' : ''}>
            </div>

            <div class="panelDivider"></div>
            <div class="panelField">
                <label>Link</label>
                <select class="input jsBtnLinkType" id="${prefix}LinkType" data-prefix="${prefix}">
                    <option value="page" ${linkType === 'page' ? 'selected' : ''}>Página</option>
                    <option value="url"  ${linkType === 'url'  ? 'selected' : ''}>URL</option>
                </select>
            </div>
            <div class="panelField">
                <select class="input" id="${prefix}PageSelect" ${linkType === 'page' ? '' : 'style="display:none"'}>
                    <option value="">— Selecione a página —</option>
                    ${pageOpts}
                </select>
                <input type="text" class="input" id="${prefix}UrlInput" value="${this.escHtml(c.url || '')}" placeholder="https://... ou /pagina" ${linkType === 'page' ? 'style="display:none"' : ''}>
            </div>
            <div class="panelField panelField--toggle">
                <label>Abrir em nova aba</label>
                <input type="checkbox" id="${prefix}TargetBlank" ${c.target_blank ? 'checked' : ''}>
            </div>

            <div class="panelDivider"></div>
            <div class="panelField">
                <label>Posição</label>
                <select class="input" id="${prefix}Align">
                    <option value="left"   ${(c.align||'left') === 'left'   ? 'selected' : ''}>Esquerda</option>
                    <option value="center" ${c.align === 'center' ? 'selected' : ''}>Centro</option>
                    <option value="right"  ${c.align === 'right'  ? 'selected' : ''}>Direita</option>
                </select>
            </div>

            <div class="panelDivider"></div>
            <div class="panelField panelField--toggle">
                <label>Usar ícone</label>
                <input type="checkbox" class="jsBtnUseIcon" id="${prefix}UseIcon" data-prefix="${prefix}" ${c.icon ? 'checked' : ''}>
            </div>
            <div id="${prefix}IconControls" ${c.icon ? '' : 'style="display:none"'}>
                ${this._iconPickerHtml(prefix + 'Icon', c.icon)}
                <div class="twoColGrid">
                    <div class="panelField">
                        <label>Posição</label>
                        <select class="input" id="${prefix}IconPosition">
                            <option value="left"  ${(c.icon_position || 'left') === 'left'  ? 'selected' : ''}>Antes do texto</option>
                            <option value="right" ${c.icon_position === 'right' ? 'selected' : ''}>Depois do texto</option>
                        </select>
                    </div>
                    <div class="panelField">
                        <label>Espaço (px)</label>
                        <input type="number" class="input" id="${prefix}IconGap" value="${c.icon_gap !== undefined ? c.icon_gap : 8}" min="0" max="60">
                    </div>
                </div>
                <div class="panelField">
                    <label>Tamanho do ícone (px)</label>
                    <input type="number" class="input" id="${prefix}IconSize" value="${c.icon_size || ''}" min="8" max="120" placeholder="igual ao texto">
                </div>
            </div>

            <div class="panelDivider"></div>
            <div class="panelField">
                <label>Largura</label>
                <div class="dimensionRow">
                    <input type="number" class="input" id="${prefix}WidthVal" value="${c.width_value || ''}" min="0" placeholder="auto">
                    <select class="input" id="${prefix}WidthUnit">
                        <option value="px" ${(c.width_unit||'px') === 'px' ? 'selected' : ''}>px</option>
                        <option value="%"  ${c.width_unit === '%'  ? 'selected' : ''}>%</option>
                    </select>
                </div>
            </div>
            <div class="panelField">
                <label>Altura</label>
                <div class="dimensionRow">
                    <input type="number" class="input" id="${prefix}HeightVal" value="${c.height_value || ''}" min="0" placeholder="auto">
                    <select class="input" id="${prefix}HeightUnit">
                        <option value="px" ${(c.height_unit||'px') === 'px' ? 'selected' : ''}>px</option>
                        <option value="%"  ${c.height_unit === '%'  ? 'selected' : ''}>%</option>
                    </select>
                </div>
            </div>

            <div class="panelDivider"></div>
            <div class="panelField">
                <label>Espaço interno — padding (px)</label>
                ${spacingInputs('Pad', p)}
            </div>
            <div class="panelField">
                <label>Margem (px)</label>
                ${spacingInputs('Mar', m)}
            </div>

            <div class="panelDivider"></div>
            <div class="panelField">
                <label>Cor do botão</label>
                <div class="colorRow">
                    <input type="color" class="colorInput" id="${prefix}BgColor" value="${c.bg_color || '#ae272c'}">
                    <input type="text" class="input" id="${prefix}BgColorHex" value="${c.bg_color || ''}" placeholder="#ae272c">
                </div>
            </div>
            <div class="panelField">
                <label>Cor do texto</label>
                <div class="colorRow">
                    <input type="color" class="colorInput" id="${prefix}TextColor" value="${c.text_color || '#ffffff'}">
                    <input type="text" class="input" id="${prefix}TextColorHex" value="${c.text_color || ''}" placeholder="#ffffff">
                </div>
            </div>
            <div class="panelField">
                <label>Cor do botão (hover)</label>
                <div class="colorRow">
                    <input type="color" class="colorInput" id="${prefix}HoverBgColor" value="${c.hover_bg_color || '#8a1f23'}">
                    <input type="text" class="input" id="${prefix}HoverBgColorHex" value="${c.hover_bg_color || ''}" placeholder="#8a1f23">
                </div>
            </div>
            <div class="panelField">
                <label>Cor do texto (hover)</label>
                <div class="colorRow">
                    <input type="color" class="colorInput" id="${prefix}HoverTextColor" value="${c.hover_text_color || '#ffffff'}">
                    <input type="text" class="input" id="${prefix}HoverTextColorHex" value="${c.hover_text_color || ''}" placeholder="#ffffff">
                </div>
            </div>

            <div class="panelDivider"></div>
            <div class="panelField">
                <label>Borda (px)</label>
                <div class="borderRow">
                    <input type="number" class="input borderWidth" id="${prefix}BorderWidth" value="${c.border_width || 0}" min="0" max="50">
                    <span class="borderUnit">px</span>
                    <input type="color" class="colorInput" id="${prefix}BorderColor" value="${c.border_color || '#000000'}" />
                </div>
            </div>

            <div class="panelDivider"></div>
            <div class="panelField">
                <label>Arredondamento dos cantos (px)</label>
                <div class="spacingGrid">
                    <div class="spacingGrid__row">
                        <div class="spacingGrid__field"><label>↖ Sup. Esq.</label>
                            <input type="number" class="input" id="${prefix}RadiusTL" value="${br.tl || 0}" min="0"></div>
                        <div class="spacingGrid__field"><label>↗ Sup. Dir.</label>
                            <input type="number" class="input" id="${prefix}RadiusTR" value="${br.tr || 0}" min="0"></div>
                    </div>
                    <div class="spacingGrid__row">
                        <div class="spacingGrid__field"><label>↙ Inf. Esq.</label>
                            <input type="number" class="input" id="${prefix}RadiusBL" value="${br.bl || 0}" min="0"></div>
                        <div class="spacingGrid__field"><label>↘ Inf. Dir.</label>
                            <input type="number" class="input" id="${prefix}RadiusBR" value="${br.br || 0}" min="0"></div>
                    </div>
                </div>
            </div>

            <div class="panelDivider"></div>
            <div class="panelField">
                <label>Sombra</label>
                <div class="colorRow">
                    <input type="checkbox" class="jsBtnShadowToggle" id="${prefix}ShadowEnabled" data-prefix="${prefix}" ${sh.enabled ? 'checked' : ''} />
                    <label for="${prefix}ShadowEnabled" class="colorRowLabel">Ativar sombra</label>
                </div>
            </div>
            <div id="${prefix}ShadowControls" ${sh.enabled ? '' : 'style="display:none"'}>
                <div class="panelField">
                    <label>Cor da sombra</label>
                    <div class="colorRow">
                        <input type="color" class="colorInput" id="${prefix}ShadowColor" value="${sh.color || '#000000'}">
                    </div>
                </div>
                <div class="twoColGrid">
                    <div class="panelField">
                        <label>Tamanho (px)</label>
                        <input type="number" class="input" id="${prefix}ShadowSize"  value="${sh.size     || 0}" min="0">
                    </div>
                    <div class="panelField">
                        <label>Distância (px)</label>
                        <input type="number" class="input" id="${prefix}ShadowDist"  value="${sh.distance || 0}" min="0">
                    </div>
                </div>
                <div class="twoColGrid">
                    <div class="panelField">
                        <label>Ângulo (°)</label>
                        <input type="number" class="input" id="${prefix}ShadowAngle" value="${sh.angle   !== undefined ? sh.angle   : 135}" min="0" max="360">
                    </div>
                    <div class="panelField">
                        <label>Opacidade (%)</label>
                        <input type="number" class="input" id="${prefix}ShadowOp"    value="${sh.opacity !== undefined ? sh.opacity : 30}"  min="0" max="100">
                    </div>
                </div>
            </div>`;
    },

    // Lê os campos gerados por _buttonFieldsHtml() e devolve o content do botão.
    _collectButtonFields(prefix) {
        const id = (sufixo) => `#${prefix}${sufixo}`;
        return {
            text:              $(id('Text')).val().trim(),
            link_type:         $(id('LinkType')).val() || 'url',
            page_id:           $(id('PageSelect')).val() || '',
            url:               $(id('UrlInput')).val().trim(),
            target_blank:      $(id('TargetBlank')).is(':checked'),
            align:             $(id('Align')).val() || 'left',
            font_size:         parseInt($(id('FontSize')).val())  || '',
            font_size_min:     parseInt($(id('FontSizeMin')).val()) || '',
            bold:              $(id('Bold')).is(':checked'),
            // Desmarcar "Usar ícone" limpa a classe — é assim que o render sabe que
            // não há ícone (o PHP e o preview checam a classe, não um booleano).
            icon:              $(id('UseIcon')).is(':checked') ? $(id('Icon')).val().trim() : '',
            icon_position:     $(id('IconPosition')).val() || 'left',
            icon_gap:          parseInt($(id('IconGap')).val())  || 0,
            icon_size:         parseInt($(id('IconSize')).val()) || '',
            width_value:       parseInt($(id('WidthVal')).val())  || '',
            width_unit:        $(id('WidthUnit')).val()  || 'px',
            height_value:      parseInt($(id('HeightVal')).val()) || '',
            height_unit:       $(id('HeightUnit')).val() || 'px',
            padding: {
                top:    parseInt($(id('PadTop')).val())    || 0,
                right:  parseInt($(id('PadRight')).val())  || 0,
                bottom: parseInt($(id('PadBottom')).val()) || 0,
                left:   parseInt($(id('PadLeft')).val())   || 0,
            },
            margin: {
                top:    parseInt($(id('MarTop')).val())    || 0,
                right:  parseInt($(id('MarRight')).val())  || 0,
                bottom: parseInt($(id('MarBottom')).val()) || 0,
                left:   parseInt($(id('MarLeft')).val())   || 0,
            },
            bg_color:          this._normalizeColor($(id('BgColorHex')).val(),        $(id('BgColor')).val()),
            text_color:        this._normalizeColor($(id('TextColorHex')).val(),      $(id('TextColor')).val()),
            hover_bg_color:    this._normalizeColor($(id('HoverBgColorHex')).val(),   $(id('HoverBgColor')).val()),
            hover_text_color:  this._normalizeColor($(id('HoverTextColorHex')).val(), $(id('HoverTextColor')).val()),
            border_width:      parseInt($(id('BorderWidth')).val()) || 0,
            border_color:      $(id('BorderColor')).val() || '#000000',
            border_radius: {
                tl: parseInt($(id('RadiusTL')).val()) || 0,
                tr: parseInt($(id('RadiusTR')).val()) || 0,
                br: parseInt($(id('RadiusBR')).val()) || 0,
                bl: parseInt($(id('RadiusBL')).val()) || 0,
            },
            shadow: {
                enabled:  $(id('ShadowEnabled')).is(':checked'),
                color:    $(id('ShadowColor')).val() || '#000000',
                size:     parseInt($(id('ShadowSize')).val())  || 0,
                distance: parseInt($(id('ShadowDist')).val())  || 0,
                angle:    parseInt($(id('ShadowAngle')).val()) || 0,
                opacity:  parseInt($(id('ShadowOp')).val())    || 0,
            },
        };
    },

    // Card = imagem + texto + botão numa caixa. Cada bloco tem um checkbox "Usar ..."
    // que liga/desliga a parte sem perder o que já foi configurado nela.
    panelCardElement(element) {
        const c      = element.content || {};
        const image  = c.image  || {};
        const text   = c.text   || {};
        const button = c.button || {};
        const card   = c.card   || {};
        const cardSt = card.styles || {};
        const cp     = card.padding || {};
        const br     = cardSt.border_radius || {};
        const sh     = cardSt.shadow || {};

        const linkType = button.link_type || 'url';
        const pages    = (typeof ALL_PAGES !== 'undefined' && ALL_PAGES) || [];
        const pageOpts = pages.map(p =>
            `<option value="${p.id}" ${parseInt(button.page_id) === p.id ? 'selected' : ''}>${this.escHtml(p.title)} (/${this.escHtml(p.slug)})</option>`
        ).join('');

        const alignOptions = (selected) => ['left', 'center', 'right'].map(v => {
            const label = { left: 'Esquerda', center: 'Centro', right: 'Direita' }[v];
            return `<option value="${v}" ${(selected || 'left') === v ? 'selected' : ''}>${label}</option>`;
        }).join('');

        return `
            <div class="panelBody">
                <div class="panelSection">
                    <h4>Card</h4>

                    <!-- ── Imagem ── -->
                    <div class="panelField panelField--toggle">
                        <label>Usar imagem</label>
                        <input type="checkbox" id="cardShowImage" ${image.show !== false ? 'checked' : ''}>
                    </div>
                    <div id="cardImageControls" ${image.show !== false ? '' : 'style="display:none"'}>
                        <div class="panelField">
                            <input type="file" id="cardImageFile" accept="image/*" style="display:none">
                            <button type="button" class="btn btn--secondary btn--full" id="btnCardImagePick">
                                ${image.url ? 'Trocar imagem' : 'Enviar imagem'}
                            </button>
                            ${image.url ? `
                                <div class="bgImagePreview">
                                    <img src="${image.url}" alt="">
                                    <button type="button" class="btn btn--danger btn--sm btn--full" id="btnCardImageRemove">Remover imagem</button>
                                </div>` : ''}
                        </div>
                        <div class="panelField">
                            <label>Texto alternativo</label>
                            <input type="text" class="input" id="cardImageAlt" value="${this.escHtml(image.alt || '')}" placeholder="Descrição da imagem">
                        </div>
                        <div class="panelField">
                            <label>Altura da imagem (px)</label>
                            <input type="number" class="input" id="cardImageHeight" value="${image.height || ''}" min="0" placeholder="auto">
                        </div>
                    </div>

                    <div class="panelDivider"></div>

                    <!-- ── Texto ── -->
                    <div class="panelField panelField--toggle">
                        <label>Usar texto</label>
                        <input type="checkbox" id="cardShowText" ${text.show !== false ? 'checked' : ''}>
                    </div>
                    <div id="cardTextControls" ${text.show !== false ? '' : 'style="display:none"'}>
                        <div class="panelField">
                            <label>Texto</label>
                            <textarea class="input cardTextArea" id="cardText" rows="3" placeholder="Título do card">${this.escHtml(text.content || '')}</textarea>
                        </div>
                        <div class="twoColGrid">
                            <div class="panelField">
                                <label>Tamanho (px)</label>
                                <input type="number" class="input" id="cardTextSize" value="${text.font_size || 20}" min="10" max="80">
                            </div>
                            <div class="panelField">
                                <label>Alinhamento</label>
                                <select class="input" id="cardTextAlign">${alignOptions(text.align)}</select>
                            </div>
                        </div>
                        <div class="panelField">
                            <label>Cor do texto</label>
                            <div class="colorRow">
                                <input type="color" class="colorInput" id="cardTextColor" value="${text.color || '#222222'}">
                                <input type="text" class="input" id="cardTextColorHex" value="${text.color || ''}" placeholder="#222222">
                            </div>
                        </div>
                        <div class="panelField panelField--toggle">
                            <label>Negrito</label>
                            <input type="checkbox" id="cardTextBold" ${text.bold ? 'checked' : ''}>
                        </div>
                    </div>

                    <div class="panelDivider"></div>

                    <!-- ── Botão ── -->
                    <div class="panelField panelField--toggle">
                        <label>Usar botão</label>
                        <input type="checkbox" id="cardShowButton" ${button.show !== false ? 'checked' : ''}>
                    </div>
                    <div id="cardButtonControls" ${button.show !== false ? '' : 'style="display:none"'}>
                        ${this._buttonFieldsHtml('cardBtn', button)}
                    </div>

                    <div class="panelDivider"></div>

                    <!-- ── Aparência do card ── -->
                    <h4>Aparência do card</h4>
                    <div class="panelField">
                        <label>Cor de fundo</label>
                        <div class="colorRow">
                            <input type="checkbox" id="cardUseBg" ${cardSt.bg_color ? 'checked' : ''} />
                            <input type="color" class="colorInput" id="cardBgColor" value="${cardSt.bg_color || '#ffffff'}" ${cardSt.bg_color ? '' : 'disabled'}>
                        </div>
                    </div>

                    <div class="panelField">
                        <label>Espaço interno do conteúdo (px)</label>
                        <div class="spacingGrid">
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>↑ Cima</label>
                                    <input type="number" class="input" id="cardPadTop" value="${cp.top !== undefined ? cp.top : 24}" min="0"></div>
                                <div class="spacingGrid__field"><label>↓ Baixo</label>
                                    <input type="number" class="input" id="cardPadBottom" value="${cp.bottom !== undefined ? cp.bottom : 24}" min="0"></div>
                            </div>
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>← Esq.</label>
                                    <input type="number" class="input" id="cardPadLeft" value="${cp.left !== undefined ? cp.left : 24}" min="0"></div>
                                <div class="spacingGrid__field"><label>→ Dir.</label>
                                    <input type="number" class="input" id="cardPadRight" value="${cp.right !== undefined ? cp.right : 24}" min="0"></div>
                            </div>
                        </div>
                    </div>

                    <div class="panelField">
                        <label>Borda (px)</label>
                        <div class="borderRow">
                            <input type="number" class="input borderWidth" id="cardBorderWidth" value="${cardSt.border_width || 0}" min="0" max="50">
                            <span class="borderUnit">px</span>
                            <input type="color" class="colorInput" id="cardBorderColor" value="${cardSt.border_color || '#e0e0e0'}" />
                        </div>
                    </div>

                    <div class="panelField">
                        <label>Arredondamento dos cantos (px)</label>
                        <div class="spacingGrid">
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>↖ Sup. Esq.</label>
                                    <input type="number" class="input" id="cardRadiusTL" value="${br.tl || 0}" min="0"></div>
                                <div class="spacingGrid__field"><label>↗ Sup. Dir.</label>
                                    <input type="number" class="input" id="cardRadiusTR" value="${br.tr || 0}" min="0"></div>
                            </div>
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>↙ Inf. Esq.</label>
                                    <input type="number" class="input" id="cardRadiusBL" value="${br.bl || 0}" min="0"></div>
                                <div class="spacingGrid__field"><label>↘ Inf. Dir.</label>
                                    <input type="number" class="input" id="cardRadiusBR" value="${br.br || 0}" min="0"></div>
                            </div>
                        </div>
                    </div>

                    <div class="panelField">
                        <label>Sombra</label>
                        <div class="colorRow">
                            <input type="checkbox" id="cardShadowEnabled" ${sh.enabled ? 'checked' : ''} />
                            <label for="cardShadowEnabled" class="colorRowLabel">Ativar sombra</label>
                        </div>
                    </div>
                    <div id="cardShadowControls" ${sh.enabled ? '' : 'style="display:none"'}>
                        <div class="panelField">
                            <label>Cor da sombra</label>
                            <div class="colorRow">
                                <input type="color" class="colorInput" id="cardShadowColor" value="${sh.color || '#000000'}">
                            </div>
                        </div>
                        <div class="twoColGrid">
                            <div class="panelField">
                                <label>Tamanho (px)</label>
                                <input type="number" class="input" id="cardShadowSize" value="${sh.size !== undefined ? sh.size : 18}" min="0">
                            </div>
                            <div class="panelField">
                                <label>Distância (px)</label>
                                <input type="number" class="input" id="cardShadowDist" value="${sh.distance !== undefined ? sh.distance : 4}" min="0">
                            </div>
                        </div>
                        <div class="twoColGrid">
                            <div class="panelField">
                                <label>Ângulo (°)</label>
                                <input type="number" class="input" id="cardShadowAngle" value="${sh.angle !== undefined ? sh.angle : 0}" min="0" max="360">
                            </div>
                            <div class="panelField">
                                <label>Opacidade (%)</label>
                                <input type="number" class="input" id="cardShadowOp" value="${sh.opacity !== undefined ? sh.opacity : 12}" min="0" max="100">
                            </div>
                        </div>
                    </div>

                    <button class="btn btn--success btn--full" id="btnApplyCardStyle">Salvar alterações</button>

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
        const responsive = element.content.responsive || {};

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

        // ── Opções avançadas: largura individual de cada coluna ──
        // O grid do projeto é Bootstrap 4 puro (12 colunas), então a largura de cada
        // coluna é só o col-N. Somar mais de 12 não é erro: o Bootstrap quebra para a
        // linha seguinte, o que é um layout válido — por isso a soma é mostrada como
        // aviso, não como bloqueio.
        const total = columns.reduce((soma, c) => soma + (parseInt(c.col_size) || 0), 0);

        const presetBtns = this._gridPresets().map(p =>
            `<button type="button" class="gridPreset ${this._mesmoPreset(columns, p.sizes) ? 'active' : ''}" data-sizes="${p.sizes.join('-')}" title="${p.label}">
                ${p.sizes.map(s => `<span style="flex:${s}"></span>`).join('')}
             </button>`
        ).join('');

        const larguraSelects = columns.map((col, i) => `
            <div class="gridWidthRow">
                <label>Coluna ${i + 1}</label>
                <select class="input gridWidthSelect" data-col-id="${col.id}">
                    ${[1,2,3,4,5,6,7,8,9,10,11,12].map(n =>
                        `<option value="${n}" ${parseInt(col.col_size) === n ? 'selected' : ''}>${n}/12</option>`
                    ).join('')}
                </select>
            </div>`).join('');

        const larguraResponsivaSelects = columns.map((col, i) => `
            <div class="gridWidthRow gridResponsiveWidthRow ${col.hide_responsive ? 'is-hidden' : ''}">
                <label>Coluna ${i + 1}</label>
                <select class="input gridResponsiveWidthSelect" data-col-id="${col.id}" ${col.hide_responsive ? 'disabled' : ''}>
                    ${[1,2,3,4,5,6,7,8,9,10,11,12].map(n =>
                        `<option value="${n}" ${parseInt(col.responsive_size || 12) === n ? 'selected' : ''}>${n}/12</option>`
                    ).join('')}
                </select>
                <label class="gridResponsiveHide">
                    <input type="checkbox" class="gridResponsiveHideInput" data-col-id="${col.id}" ${col.hide_responsive ? 'checked' : ''}>
                    Ocultar
                </label>
            </div>`).join('');

        return `
            <div class="panelBody">
                <div class="panelSection">
                    <h4>Grid</h4>
                    <div class="panelField">
                        <label>Quantidade de colunas</label>
                        <div class="colPicker">${colBtns}</div>
                        <p class="panelNote">Divide o espaço em partes iguais.</p>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Larguras (avançado)</label>
                        <p class="panelNote">Modelos prontos:</p>
                        <div class="gridPresets">${presetBtns}</div>

                        <div class="gridWidths">${larguraSelects}</div>
                        <div class="gridWidths__total ${total === 12 ? 'is-ok' : 'is-warn'}" id="gridWidthTotal">
                            ${this._textoTotalGrid(total)}
                        </div>
                        <button class="btn btn--success btn--full" id="btnApplyGridWidths">Aplicar larguras</button>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField panelField--toggle">
                        <label>Quebra responsiva personalizada</label>
                        <input type="checkbox" id="gridResponsiveEnabled" ${responsive.enabled ? 'checked' : ''}>
                    </div>
                    <div id="gridResponsiveControls" ${responsive.enabled ? '' : 'style="display:none"'}>
                        <div class="panelField">
                            <label>Aplicar estas larguras até (px)</label>
                            <input type="number" class="input" id="gridResponsiveBreakpoint"
                                   value="${parseInt(responsive.breakpoint) || 991}" min="320" max="2000">
                            <p class="panelNote">Acima desta medida, o Grid usa as larguras de desktop.</p>
                        </div>
                        <div class="panelField">
                            <label>Largura de cada coluna</label>
                            <div class="gridWidths">${larguraResponsivaSelects}</div>
                            <p class="panelNote">Exemplo: 6/12 + 6/12 + 12/12 forma duas colunas e depois uma coluna inteira.</p>
                        </div>
                        <button class="btn btn--success btn--full" id="btnApplyGridResponsive">Aplicar responsivo</button>
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

    // Modelos de largura mais usados. A ordem dentro do array é a ordem das colunas.
    _gridPresets() {
        return [
            { sizes: [6, 6],           label: 'Metade / Metade' },
            { sizes: [4, 4, 4],        label: 'Três iguais' },
            { sizes: [3, 6, 3],        label: 'Lateral / Centro maior / Lateral' },
            { sizes: [2, 8, 2],        label: 'Centro bem largo' },
            { sizes: [4, 8],           label: 'Estreita / Larga' },
            { sizes: [8, 4],           label: 'Larga / Estreita' },
            { sizes: [3, 9],           label: 'Menu lateral / Conteúdo' },
            { sizes: [9, 3],           label: 'Conteúdo / Menu lateral' },
            { sizes: [3, 3, 3, 3],     label: 'Quatro iguais' },
            { sizes: [2, 2, 2, 2, 2, 2], label: 'Seis iguais' },
        ];
    },

    _mesmoPreset(columns, sizes) {
        return columns.length === sizes.length
            && columns.every((c, i) => parseInt(c.col_size) === sizes[i]);
    },

    _textoTotalGrid(total) {
        if (total === 12) return 'Total: 12/12 — ocupa a linha inteira.';
        if (total < 12)   return `Total: ${total}/12 — sobra espaço vazio à direita.`;
        return `Total: ${total}/12 — passa de 12, as colunas quebram para a linha de baixo.`;
    },

    // Lê os selects de largura e aplica nas colunas. Vale para o preview ao vivo
    // (sem gravar) e para o botão "Aplicar larguras" (gravando).
    _aplicarLargurasGrid(gravar) {
        if (this.state.mode !== 'grid') return;
        const { element } = this.state.selected;
        const columns = element.content.columns || [];

        $('.gridWidthSelect').each(function () {
            const colId = parseInt($(this).data('col-id'));
            const col   = columns.find(c => c.id === colId);
            if (col) col.col_size = Math.min(12, Math.max(1, parseInt($(this).val()) || 1));
        });

        $('.gridResponsiveWidthSelect').each(function () {
            const colId = parseInt($(this).data('col-id'));
            const col   = columns.find(c => c.id === colId);
            if (col) col.responsive_size = Math.min(12, Math.max(1, parseInt($(this).val()) || 12));
        });

        $('.gridResponsiveHideInput').each(function () {
            const colId = parseInt($(this).data('col-id'));
            const col   = columns.find(c => c.id === colId);
            if (col) col.hide_responsive = $(this).is(':checked');
        });

        element.content = {
            ...element.content,
            columns,
            responsive: {
                enabled: $('#gridResponsiveEnabled').is(':checked'),
                breakpoint: Math.min(2000, Math.max(320, parseInt($('#gridResponsiveBreakpoint').val()) || 991)),
            },
        };

        if (gravar) {
            this.saveGridContent(element);
            this.renderPanel();
        } else {
            this.renderPreview();
        }
    },

    // Aplica um modelo pronto: ajusta a quantidade de colunas e as larguras de uma vez.
    aplicarPresetGrid(sizes) {
        if (this.state.mode !== 'grid') return;
        const { element } = this.state.selected;
        this.updateGridColumns(element, sizes.length, sizes);
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
            <div class="col-12 col-md-${column.col_size} editorColumn ${column.elements.length === 0 ? 'editorColumn--empty' : ''}" data-column-id="${column.id}"${inlineStyle ? ` style="${inlineStyle}"` : ''}>
                ${elements}
            </div>`;
    },

    renderElement(element) {
        const c       = element.content || {};
        const preview = element.plugin_type === 'grid'
            ? this.renderGridElement(element)
            : element.plugin_type === 'flutuante'
                ? this._renderFlutuantePreview(element)
                : (['tabs', 'accordion'].includes(element.plugin_type)
                    ? this.renderPanelsElement(element)
                    : this._renderLeafPreviewHtml(element));
        const wrapperStyle = this._elementWrapperStyle(c, element.plugin_type);

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

        if (element.plugin_type === 'card') {
            return this._renderCardPreview(c);
        }

        if (element.plugin_type === 'icon') {
            return this._renderIconPreview(c);
        }

        if (element.plugin_type === 'cardicon') {
            return this._renderCardIconPreview(c);
        }

        if (element.plugin_type === 'testimonials') {
            return this._renderTestimonialsPreview(c);
        }

        if (element.plugin_type === 'calculadora') {
            return this._renderCalculadoraPreview(c);
        }

        return '';
    },

    // Espelha CardPlugin::render() do PHP. Reaproveita _renderButtonPreview() para o
    // botão (mesmo shape de content) e _buildInlineStyle() para a caixa (mesmo shape
    // de styles de Seção/Coluna) — só a imagem e o texto são específicos daqui.
    _renderCardPreview(c) {
        const image  = c.image  || {};
        const text   = c.text   || {};
        const button = c.button || {};
        const card   = c.card   || {};

        const showImage  = image.show  !== false && (image.url || '').trim() !== '';
        const showText   = text.show   !== false && (text.content || '').trim() !== '';
        const showButton = button.show !== false && (button.text || '').trim() !== '';

        if (!showImage && !showText && !showButton) {
            return '<em class="previewEmpty">Card vazio — configure imagem, texto ou botão</em>';
        }

        const rootStyle = this._buildInlineStyle(card.styles || {});
        let html = `<div class="plugin-card"${rootStyle ? ` style="${rootStyle}"` : ''}>`;

        if (showImage) {
            const imgStyle = image.height ? ` style="height:${parseInt(image.height)}px;object-fit:cover;"` : '';
            html += `<div class="plugin-card__media">
                <img class="plugin-card__image" src="${image.url}" alt="${this.escHtml(image.alt || '')}"${imgStyle}>
            </div>`;
        }

        if (showText || showButton) {
            const p = card.padding || {};
            const bodyStyle = (p.top || p.right || p.bottom || p.left)
                ? ` style="padding:${p.top||0}px ${p.right||0}px ${p.bottom||0}px ${p.left||0}px;"`
                : '';
            html += `<div class="plugin-card__body"${bodyStyle}>`;

            if (showText) {
                html += `<div class="plugin-card__text" style="${this._buildCardTextStyle(text)}">${this.escHtml(text.content).replace(/\n/g, '<br>')}</div>`;
            }
            if (showButton) {
                html += this._renderButtonPreview(button);
            }

            html += '</div>';
        }

        return html + '</div>';
    },

    _buildCardTextStyle(text) {
        let css = '';
        if (text.font_size) css += `font-size:${this._fluidFont(text.font_size, text.font_size_min)};`;
        if (text.color)     css += `color:${text.color};`;
        css += `text-align:${['left','center','right'].includes(text.align) ? text.align : 'left'};`;
        if (text.bold)      css += 'font-weight:700;';
        return css;
    },

    // Mesma estrutura/estilo usados na página publicada, pra refletir de verdade
    // alinhamento, espaçamento, cores e tamanho de fonte configurados.
    _renderMenuPreview(c) {
        const items = c.items || [];
        if (!items.length) return '<em class="previewEmpty">Nenhum item no menu</em>';

        // Espelha MenuPlugin::renderItem() do PHP, inclusive as classes que definem
        // onde o submenu ancora (--dropdown no item, --mega no <nav>).
        const itemsHtml = items.map(i => {
            const tipo   = i.submenu || 'none';
            const filhos = tipo === 'none' ? [] : (i.children || []).filter(f => (f.label || '').trim() !== '');
            const temSub = filhos.length > 0;

            let li = `<li class="plugin-menu__item${temSub ? ' plugin-menu__item--has-sub plugin-menu__item--' + (tipo === 'mega' ? 'mega' : 'dropdown') : ''}">
                <div class="plugin-menu__itemTop">
                    <a class="plugin-menu__link" href="#">${this.escHtml(i.label || '(sem texto)')}</a>
                    ${temSub ? '<button type="button" class="plugin-menu__caret"></button>' : ''}
                </div>`;

            if (temSub) {
                const cols = Math.max(1, Math.min(4, parseInt(i.mega_columns) || 3));
                li += `<div class="plugin-menu__sub plugin-menu__sub--${tipo === 'mega' ? 'mega' : 'dropdown'}"${tipo === 'mega' ? ` style="--menu-mega-cols:${cols};"` : ''}>
                    <ul class="plugin-menu__sublist">
                        ${filhos.map(f => `<li class="plugin-menu__subitem"><a class="plugin-menu__sublink" href="#">${this.escHtml(f.label)}</a></li>`).join('')}
                    </ul>
                </div>`;
            }

            return li + '</li>';
        }).join('');

        const settings = c.settings || {};
        const styleAttr = this._buildMenuStyleAttr(settings);
        const breakpoint = Math.min(2000, Math.max(320, parseInt(settings.mobile_breakpoint) || 767));
        const mobileClass = window.innerWidth <= breakpoint ? ' plugin-menu--mobile' : '';
        const mobileStyle = settings.mobile_style === 'fullscreen' ? 'fullscreen' : 'dropdown';
        const burgerAlign = ['left', 'center', 'right'].includes(settings.mobile_align) ? settings.mobile_align : 'right';

        return `<nav class="plugin-menu plugin-menu--mobile-${mobileStyle} plugin-menu--burger-${burgerAlign}${mobileClass}" data-menu-breakpoint="${breakpoint}"${styleAttr}>
            <button type="button" class="plugin-menu__burger"><span></span><span></span><span></span></button>
            <ul class="plugin-menu__list">${itemsHtml}</ul>
        </nav>`;
    },

    _buildMenuStyleAttr(s) {
        const align = ['left', 'center', 'right'].includes(s.align) ? s.align : 'left';
        const mobileAlign = { left: 'flex-start', center: 'center', right: 'flex-end' }[s.mobile_align] || 'flex-end';
        const vars  = {
            '--menu-align':    align,
            '--menu-gap':      `${Math.max(0, parseInt(s.gap) || 24)}px`,
            '--menu-color':    s.text_color   || '#222222',
            '--menu-hover':    s.hover_color  || '#ae272c',
            '--menu-fontsize': this._fluidFont(Math.max(10, parseInt(s.font_size) || 16)),
            '--menu-burger':   s.burger_color || '#222222',
            '--menu-mobile-align': mobileAlign,
            '--submenu-bg':       s.sub_bg      || '#ffffff',
            '--submenu-color':    s.sub_color   || '#222222',
            '--submenu-hover':    s.sub_hover   || '#ae272c',
            '--submenu-hover-bg': s.sub_hover_bg || 'transparent',
            '--submenu-fontsize': this._fluidFont(Math.max(10, parseInt(s.sub_font_size) || 15)),
            '--submenu-radius':   `${Math.max(0, s.sub_radius !== undefined ? parseInt(s.sub_radius) || 0 : 6)}px`,
            '--submenu-padding':  `${Math.max(0, s.sub_padding !== undefined ? parseInt(s.sub_padding) || 0 : 16)}px`,
            '--submenu-border':   (parseInt(s.sub_border_width) || 0) > 0
                ? `${parseInt(s.sub_border_width)}px solid ${s.sub_border_color || '#e0e0e0'}`
                : 'none',
            '--submenu-shadow':   s.sub_shadow !== false ? '0 8px 24px rgba(0,0,0,0.14)' : 'none',
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

        // Espelha ButtonPlugin::render(): o ícone entra dentro do <a>, antes ou depois
        // do texto conforme icon_position.
        const icone = (c.icon || '').trim();
        let conteudo = this.escHtml(text);
        if (icone) {
            const tam = parseInt(c.icon_size) || 0;
            const i   = `<i class="${this.escHtml(icone)}"${tam > 0 ? ` style="font-size:${tam}px;"` : ''}></i>`;
            conteudo  = c.icon_position === 'right' ? conteudo + i : i + conteudo;
        }

        return `<div class="plugin-button plugin-button--${align}"${colorVars}>
            <a class="plugin-button__link" href="#"${geometry ? ` style="${geometry}"` : ''}>${conteudo}</a>
        </div>`;
    },

    _buildButtonGeometryStyle(c) {
        let css = '';
        if (c.font_size)    css += `font-size:${this._fluidFont(c.font_size, c.font_size_min)};`;
        if (c.bold)         css += 'font-weight:700;';
        if ((c.icon || '').trim()) css += `gap:${Math.max(0, parseInt(c.icon_gap) || 0)}px;`;
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

    // Espelha fluidFontSize() de core/Helpers.php: tamanho que encolhe sozinho em
    // telas menores. Sem mínimo configurado, usa 65% do tamanho (piso de 12px).
    _fluidFont(px, minPx) {
        const max = Math.max(1, parseInt(px) || 0);
        const min = parseInt(minPx) || Math.max(12, Math.round(max * 0.65));
        if (min >= max) return `${max}px`;

        const telaMin = 360, telaMax = 1280;
        const inclinacao  = (max - min) / (telaMax - telaMin);
        const interseccao = min - inclinacao * telaMin;

        return `clamp(${min}px, ${Math.round(interseccao * 100) / 100}px + ${Math.round(inclinacao * 1000000) / 10000}vw, ${max}px)`;
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
        const responsive = element.content.responsive || {};
        const token = `editorGridResponsive${String(element.id).replace(/[^a-zA-Z0-9]/g, 'x')}`;
        let responsiveCss = '';

        if (responsive.enabled) {
            const breakpoint = Math.min(2000, Math.max(320, parseInt(responsive.breakpoint) || 991));
            const rules = columns.map((col, i) => {
                if (col.hide_responsive) {
                    return `.${token}>.editorGridRow>.editorGridColumn:nth-child(${i + 1}){display:none!important;}`;
                }
                const size = Math.min(12, Math.max(1, parseInt(col.responsive_size) || 12));
                const pct = (size / 12 * 100).toFixed(6);
                return `.${token}>.editorGridRow>.editorGridColumn:nth-child(${i + 1}){flex:0 0 ${pct}%;max-width:${pct}%;}`;
            }).join('');
            responsiveCss = `<style>@media(max-width:${breakpoint}px){${rules}}</style>`;
        }

        return `${responsiveCss}<div class="editorGrid ${token}"><div class="row editorGridRow">${cols}</div></div>`;
    },

    renderGridColumn(col, gridId) {
        const elements    = (col.elements || []).map(e => this.renderGridLeafElement(e, gridId, col.id)).join('');
        const inlineStyle = this._buildInlineStyle(col.styles || {});
        return `
            <div class="col-12 col-md-${col.col_size} editorGridColumn ${elements ? '' : 'editorGridColumn--empty'}" data-grid-id="${gridId}" data-grid-col-id="${col.id}"${inlineStyle ? ` style="${inlineStyle}"` : ''}>
                ${elements}
            </div>`;
    },

    renderGridLeafElement(element, gridId, colId) {
        const preview = this._renderNestedPreviewHtml(element);
        return `
            <div class="editorGridElement" data-grid-id="${gridId}" data-grid-col-id="${colId}" data-grid-el-id="${element.id}" data-plugin="${element.plugin_type}">
                <div class="previewElement">${preview}</div>
            </div>`;
    },

    // Estilos aplicados no wrapper do preview. Vale SÓ para o elemento de texto, que
    // guarda font_size/text_color/margin na raiz do content e não tem wrapper próprio
    // no PHP. Os demais plugins montam o próprio estilo (a Imagem, por exemplo, aplica
    // a margem no `.plugin-image`) — sem esse corte, a margem sairia dobrada no editor.
    _elementWrapperStyle(content, pluginType) {
        if (pluginType !== 'text') return '';

        let css = '';
        if (content.font_size)  css += `font-size:${this._fluidFont(content.font_size, content.font_size_min)};`;
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

        // Margem no wrapper, igual ao ImagePlugin do PHP.
        const m = c.margin || {};
        const wrapperStyle = (m.top || m.right || m.bottom || m.left)
            ? ` style="margin:${m.top||0}px ${m.right||0}px ${m.bottom||0}px ${m.left||0}px;"`
            : '';

        return `<div class="pluginImagePreview pluginImagePreview--${align}"${wrapperStyle}><img src="${c.image_url}" alt="${this.escHtml(c.alt || '')}"${imgStyle}></div>`;
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

    // Coletores: leem os campos do painel e devolvem o content, SEM escrever no DOM.
    // Isso é o que permite reusá-los no preview ao vivo — se eles normalizassem os
    // inputs (clamp de mínimo, por exemplo), o valor mudaria embaixo do usuário
    // enquanto ele ainda está digitando.
    _collectTextFields() {
        const c = this.state.selected.element.content || {};

        let fontSize = parseInt($('#textFontSizeInput').val());
        fontSize = isNaN(fontSize) ? '' : Math.min(80, Math.max(12, fontSize));

        const margin = {
            top:    parseInt($('#textMarginTop').val())    || 0,
            right:  parseInt($('#textMarginRight').val())  || 0,
            bottom: parseInt($('#textMarginBottom').val()) || 0,
            left:   parseInt($('#textMarginLeft').val())   || 0,
        };

        let textColor = $('#textColorHex').val().trim();
        if (textColor && !textColor.startsWith('#')) textColor = '#' + textColor;
        if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(textColor)) textColor = '';

        return {
            ...c,
            font_size: fontSize,
            font_size_min: parseInt($('#textFontSizeMin').val()) || '',
            text_color: textColor,
            margin,
        };
    },

    saveElementStyleFields() {
        if (!['element', 'grid-element', 'panels-element'].includes(this.state.mode)) return;
        const content = this._collectTextFields();

        // Só ao salvar os campos são normalizados na tela (mostra o valor que valeu).
        $('#textFontSizeInput').val(content.font_size);
        $('#textColorHex').val(content.text_color);
        if (content.text_color) $('#textColorPicker').val(content.text_color);

        this._persistElementContent(content);
    },

    saveImageElementFields() {
        if (!['element', 'grid-element', 'panels-element'].includes(this.state.mode)) return;
        this._persistElementContent(this._collectImageFields());
    },

    _collectImageFields() {
        const c = this.state.selected.element.content || {};

        return {
            ...c,
            alt:           $('#imageAlt').val().trim(),
            link_url:      $('#imageLink').val().trim(),
            align:         $('#imageAlign').val() || 'center',
            width_value:   parseInt($('#imageWidthVal').val()) || '',
            width_unit:    $('#imageWidthUnit').val() || '%',
            border_radius: parseInt($('#imageBorderRadius').val()) || 0,
            margin: {
                top:    parseInt($('#imageMarginTop').val())    || 0,
                right:  parseInt($('#imageMarginRight').val())  || 0,
                bottom: parseInt($('#imageMarginBottom').val()) || 0,
                left:   parseInt($('#imageMarginLeft').val())   || 0,
            },
        };
    },

    saveSliderElementFields() {
        if (!['element', 'grid-element', 'panels-element'].includes(this.state.mode)) return;
        this._persistElementContent(this._collectSliderFields());
    },

    _collectSliderFields() {
        const c = this.state.selected.element.content || {};

        // Mesmo leitor usado pelos fluxos de adicionar/remover imagem — manter duas
        // cópias da leitura foi o que quebrou os subitens do Menu (ver _collectMenuFields).
        const images = this._syncSliderImagesFromDom(c.images || []);

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

        return { images, settings };
    },

    saveMenuElementFields() {
        if (!['element', 'grid-element', 'panels-element'].includes(this.state.mode)) return;
        this._persistElementContent(this._collectMenuFields());
    },

    _collectMenuFields() {
        const c = this.state.selected.element.content || {};

        // Usa o MESMO leitor dos fluxos de adicionar/remover item. Antes havia uma
        // segunda cópia da leitura aqui, e ela não conhecia submenu/subitens: o texto
        // digitado num subitem só era capturado quando outra ação disparava o sync,
        // então o subitem chegava vazio no preview e no que era salvo.
        const items = this._syncMenuItemsFromDom(c.items || []);

        const settings = {
            align:        $('#menuAlign').val() || 'left',
            gap:          Math.max(0, parseInt($('#menuGap').val()) || 0),
            font_size:    Math.max(10, parseInt($('#menuFontSize').val()) || 16),
            text_color:   this._normalizeColor($('#menuTextColorHex').val(),   $('#menuTextColor').val()),
            hover_color:  this._normalizeColor($('#menuHoverColorHex').val(),  $('#menuHoverColor').val()),
            burger_color: this._normalizeColor($('#menuBurgerColorHex').val(), $('#menuBurgerColor').val()),
            mobile_breakpoint: Math.min(2000, Math.max(320, parseInt($('#menuMobileBreakpoint').val()) || 767)),
            mobile_align:      $('#menuMobileAlign').val() || 'right',
            mobile_style:      $('#menuMobileStyle').val() || 'dropdown',
            // Submenu / mega menu
            sub_font_size:    Math.max(10, parseInt($('#menuSubFontSize').val()) || 15),
            sub_padding:      Math.max(0, parseInt($('#menuSubPadding').val()) || 0),
            sub_bg:           this._normalizeColor($('#menuSubBgHex').val(),    $('#menuSubBg').val()),
            sub_color:        this._normalizeColor($('#menuSubColorHex').val(), $('#menuSubColor').val()),
            sub_hover:        this._normalizeColor($('#menuSubHoverHex').val(), $('#menuSubHover').val()),
            sub_hover_bg:     $('#menuSubUseHoverBg').is(':checked') ? $('#menuSubHoverBg').val() : '',
            sub_radius:       Math.max(0, parseInt($('#menuSubRadius').val()) || 0),
            sub_border_width: parseInt($('#menuSubBorderWidth').val()) || 0,
            sub_border_color: $('#menuSubBorderColor').val() || '#e0e0e0',
            sub_shadow:       $('#menuSubShadow').is(':checked'),
        };

        return { items, settings };
    },

    saveCardElementFields() {
        if (!['element', 'grid-element', 'panels-element'].includes(this.state.mode)) return;
        this._persistElementContent(this._collectCardFields());
    },

    _collectCardFields() {
        const c = this.state.selected.element.content || {};

        // O `...` preserva o que o painel não expõe (ex: image.url, definida no upload,
        // e os campos de botão herdados do default que não têm campo no painel do card).
        const content = {
            image: {
                ...(c.image || {}),
                show:   $('#cardShowImage').is(':checked'),
                alt:    $('#cardImageAlt').val().trim(),
                height: parseInt($('#cardImageHeight').val()) || '',
            },
            text: {
                ...(c.text || {}),
                show:      $('#cardShowText').is(':checked'),
                content:   $('#cardText').val(),
                font_size: Math.min(80, Math.max(10, parseInt($('#cardTextSize').val()) || 20)),
                align:     $('#cardTextAlign').val() || 'left',
                color:     this._normalizeColor($('#cardTextColorHex').val(), $('#cardTextColor').val()),
                bold:      $('#cardTextBold').is(':checked'),
            },
            // Mesmos campos do elemento Botão, lidos pelo mesmo coletor.
            button: {
                ...this._collectButtonFields('cardBtn'),
                show: $('#cardShowButton').is(':checked'),
            },
            card: {
                padding: {
                    top:    parseInt($('#cardPadTop').val())    || 0,
                    right:  parseInt($('#cardPadRight').val())  || 0,
                    bottom: parseInt($('#cardPadBottom').val()) || 0,
                    left:   parseInt($('#cardPadLeft').val())   || 0,
                },
                // Mesmo shape de styles de Seção/Coluna, lido por _buildInlineStyle()
                // no preview e por buildInlineStyles() no PHP.
                styles: {
                    bg_color:     $('#cardUseBg').is(':checked') ? $('#cardBgColor').val() : '',
                    border_width: parseInt($('#cardBorderWidth').val()) || 0,
                    border_color: $('#cardBorderColor').val() || '#e0e0e0',
                    border_radius: {
                        tl: parseInt($('#cardRadiusTL').val()) || 0,
                        tr: parseInt($('#cardRadiusTR').val()) || 0,
                        br: parseInt($('#cardRadiusBR').val()) || 0,
                        bl: parseInt($('#cardRadiusBL').val()) || 0,
                    },
                    shadow: {
                        enabled:  $('#cardShadowEnabled').is(':checked'),
                        color:    $('#cardShadowColor').val() || '#000000',
                        size:     parseInt($('#cardShadowSize').val())  || 0,
                        distance: parseInt($('#cardShadowDist').val())  || 0,
                        angle:    parseInt($('#cardShadowAngle').val()) || 0,
                        opacity:  parseInt($('#cardShadowOp').val())    || 0,
                    },
                },
            },
        };

        return content;
    },

    saveButtonElementFields() {
        if (!['element', 'grid-element', 'panels-element'].includes(this.state.mode)) return;
        this._persistElementContent(this._collectButtonFields('btn'));
    },

    // ── Bloco flutuante (plugin "flutuante") ──────────────────
    // Reaproveita os modos 'panels-*' para editar o conteúdo de dentro: o bloco tem
    // um único "item" implícito, e a navegação (descer/voltar/gravar na raiz) já
    // funciona igual à das Abas/Sanfona.
    panelFlutuanteElement(element) {
        const c   = element.content || {};
        const pos = c.position || {};
        const box = c.box || {};
        const st  = box.styles || {};
        const br  = st.border_radius || {};
        const sh  = st.shadow || {};
        const p   = box.padding || {};
        const item = (c.items || [])[0] || { id: 0, elements: [] };

        const elementosHtml = (item.elements || []).map(el => `
            <div class="panelsStructureElement gridStructureElement" data-item-id="${item.id}" data-el-id="${el.id}">
                <span class="structureElement__badge">${this.escHtml(el.plugin_type)}</span>
                <span class="structureElement__label">${this._elementPreviewLabel(el)}</span>
            </div>`).join('');

        const flutuando = (pos.mode || 'float') === 'float';

        return `
            <div class="panelBody">
                <div class="panelSection">
                    <h4>Bloco flutuante</h4>

                    <div class="panelField">
                        <label>Conteúdo</label>
                        <div class="structureList">
                            <div class="structureCol">
                                ${elementosHtml ? `<div class="structureCol__elements">${elementosHtml}</div>` : ''}
                                <button class="structureCol__add btnPanelsAddElement" data-item-id="${item.id}">+ Novo elemento</button>
                            </div>
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <h4>Posição</h4>
                    <div class="panelField">
                        <label>Comportamento</label>
                        <select class="input" id="flutMode">
                            <option value="float"  ${flutuando ? 'selected' : ''}>Flutuante (por cima do conteúdo)</option>
                            <option value="normal" ${flutuando ? '' : 'selected'}>Normal (dentro do fluxo)</option>
                        </select>
                    </div>

                    <div id="flutPosControls" ${flutuando ? '' : 'style="display:none"'}>
                        <p class="panelNote">Arraste o bloco no preview ao lado para posicionar, ou ajuste aqui. Os valores são em % da seção, então a posição acompanha o tamanho da tela.</p>
                        <div class="twoColGrid">
                            <div class="panelField">
                                <label>Horizontal (X) %</label>
                                <input type="number" class="input" id="flutX" value="${pos.x !== undefined ? pos.x : 50}" min="-50" max="150" step="0.5">
                            </div>
                            <div class="panelField">
                                <label>Vertical (Y) %</label>
                                <input type="number" class="input" id="flutY" value="${pos.y !== undefined ? pos.y : 50}" min="-50" max="150" step="0.5">
                            </div>
                        </div>
                        <div class="twoColGrid">
                            <div class="panelField">
                                <label>Âncora horizontal</label>
                                <select class="input" id="flutAnchorX">
                                    <option value="start"  ${pos.anchor_x === 'start'  ? 'selected' : ''}>Esquerda do bloco</option>
                                    <option value="center" ${(pos.anchor_x || 'center') === 'center' ? 'selected' : ''}>Centro do bloco</option>
                                    <option value="end"    ${pos.anchor_x === 'end'    ? 'selected' : ''}>Direita do bloco</option>
                                </select>
                            </div>
                            <div class="panelField">
                                <label>Âncora vertical</label>
                                <select class="input" id="flutAnchorY">
                                    <option value="start"  ${pos.anchor_y === 'start'  ? 'selected' : ''}>Topo do bloco</option>
                                    <option value="center" ${(pos.anchor_y || 'center') === 'center' ? 'selected' : ''}>Centro do bloco</option>
                                    <option value="end"    ${pos.anchor_y === 'end'    ? 'selected' : ''}>Base do bloco</option>
                                </select>
                            </div>
                        </div>
                        <div class="panelField">
                            <label>Camada (z-index)</label>
                            <input type="number" class="input" id="flutZ" value="${pos.z_index !== undefined ? pos.z_index : 10}" min="0" max="999">
                            <p class="panelNote">Quanto maior, mais na frente. O menu do topo usa 50–60.</p>
                        </div>

                        <div class="panelField panelField--toggle">
                            <label>Posição própria no celular</label>
                            <input type="checkbox" id="flutMobileOverride" ${pos.mobile_override ? 'checked' : ''}>
                        </div>
                        <div id="flutMobileControls" ${pos.mobile_override ? '' : 'style="display:none"'}>
                            <div class="twoColGrid">
                                <div class="panelField">
                                    <label>X no celular %</label>
                                    <input type="number" class="input" id="flutXMobile" value="${pos.x_mobile !== undefined ? pos.x_mobile : 50}" min="-50" max="150" step="0.5">
                                </div>
                                <div class="panelField">
                                    <label>Y no celular %</label>
                                    <input type="number" class="input" id="flutYMobile" value="${pos.y_mobile !== undefined ? pos.y_mobile : 50}" min="-50" max="150" step="0.5">
                                </div>
                            </div>
                        </div>
                        <div class="panelField panelField--toggle">
                            <label>Esconder no celular</label>
                            <input type="checkbox" id="flutHideMobile" ${pos.hide_mobile ? 'checked' : ''}>
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <h4>Tamanho</h4>
                    <div class="panelField">
                        <label>Largura</label>
                        <div class="dimensionRow">
                            <input type="number" class="input" id="flutWidthVal" value="${box.width_value || ''}" min="0" placeholder="auto">
                            <select class="input" id="flutWidthUnit">
                                <option value="%"  ${(box.width_unit || '%') === '%'  ? 'selected' : ''}>%</option>
                                <option value="px" ${box.width_unit === 'px' ? 'selected' : ''}>px</option>
                            </select>
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Largura máxima (px)</label>
                        <input type="number" class="input" id="flutMaxWidth" value="${box.max_width || ''}" min="0" placeholder="sem limite">
                    </div>
                    <div class="panelField">
                        <label>Altura</label>
                        <div class="dimensionRow">
                            <input type="number" class="input" id="flutHeightVal" value="${box.height_value || ''}" min="0" placeholder="auto">
                            <select class="input" id="flutHeightUnit">
                                <option value="px" ${(box.height_unit || 'px') === 'px' ? 'selected' : ''}>px</option>
                                <option value="%"  ${box.height_unit === '%'  ? 'selected' : ''}>%</option>
                            </select>
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Espaço interno (px)</label>
                        <div class="spacingGrid">
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>↑ Cima</label>
                                    <input type="number" class="input" id="flutPadTop" value="${p.top !== undefined ? p.top : 24}" min="0"></div>
                                <div class="spacingGrid__field"><label>↓ Baixo</label>
                                    <input type="number" class="input" id="flutPadBottom" value="${p.bottom !== undefined ? p.bottom : 24}" min="0"></div>
                            </div>
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>← Esq.</label>
                                    <input type="number" class="input" id="flutPadLeft" value="${p.left !== undefined ? p.left : 24}" min="0"></div>
                                <div class="spacingGrid__field"><label>→ Dir.</label>
                                    <input type="number" class="input" id="flutPadRight" value="${p.right !== undefined ? p.right : 24}" min="0"></div>
                            </div>
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <h4>Aparência</h4>
                    <div class="panelField">
                        <label>Cor de fundo</label>
                        <div class="colorRow">
                            <input type="checkbox" id="flutUseBg" ${st.bg_color ? 'checked' : ''} />
                            <input type="color" class="colorInput" id="flutBgColor" value="${st.bg_color || '#ffffff'}" ${st.bg_color ? '' : 'disabled'}>
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Borda (px)</label>
                        <div class="borderRow">
                            <input type="number" class="input borderWidth" id="flutBorderWidth" value="${st.border_width || 0}" min="0" max="50">
                            <span class="borderUnit">px</span>
                            <input type="color" class="colorInput" id="flutBorderColor" value="${st.border_color || '#e0e0e0'}" />
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Arredondamento dos cantos (px)</label>
                        <div class="spacingGrid">
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>↖ Sup. Esq.</label>
                                    <input type="number" class="input" id="flutRadiusTL" value="${br.tl || 0}" min="0"></div>
                                <div class="spacingGrid__field"><label>↗ Sup. Dir.</label>
                                    <input type="number" class="input" id="flutRadiusTR" value="${br.tr || 0}" min="0"></div>
                            </div>
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>↙ Inf. Esq.</label>
                                    <input type="number" class="input" id="flutRadiusBL" value="${br.bl || 0}" min="0"></div>
                                <div class="spacingGrid__field"><label>↘ Inf. Dir.</label>
                                    <input type="number" class="input" id="flutRadiusBR" value="${br.br || 0}" min="0"></div>
                            </div>
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Sombra</label>
                        <div class="colorRow">
                            <input type="checkbox" id="flutShadowEnabled" ${sh.enabled ? 'checked' : ''} />
                            <label for="flutShadowEnabled" class="colorRowLabel">Ativar sombra</label>
                        </div>
                    </div>
                    <div id="flutShadowControls" ${sh.enabled ? '' : 'style="display:none"'}>
                        <div class="panelField">
                            <label>Cor da sombra</label>
                            <div class="colorRow">
                                <input type="color" class="colorInput" id="flutShadowColor" value="${sh.color || '#000000'}">
                            </div>
                        </div>
                        <div class="twoColGrid">
                            <div class="panelField">
                                <label>Tamanho (px)</label>
                                <input type="number" class="input" id="flutShadowSize" value="${sh.size !== undefined ? sh.size : 24}" min="0">
                            </div>
                            <div class="panelField">
                                <label>Distância (px)</label>
                                <input type="number" class="input" id="flutShadowDist" value="${sh.distance !== undefined ? sh.distance : 8}" min="0">
                            </div>
                        </div>
                        <div class="twoColGrid">
                            <div class="panelField">
                                <label>Ângulo (°)</label>
                                <input type="number" class="input" id="flutShadowAngle" value="${sh.angle !== undefined ? sh.angle : 0}" min="0" max="360">
                            </div>
                            <div class="panelField">
                                <label>Opacidade (%)</label>
                                <input type="number" class="input" id="flutShadowOp" value="${sh.opacity !== undefined ? sh.opacity : 18}" min="0" max="100">
                            </div>
                        </div>
                    </div>

                    <button class="btn btn--success btn--full" id="btnApplyFlutuante">Salvar alterações</button>

                    <div class="panelDivider"></div>
                    <button class="btn btn--danger btn--full" id="btnDeleteElement" data-id="${element.id}">Remover bloco</button>
                    <div class="panelDivider"></div>
                    <button class="btn btn--secondary btn--full btnBack">← Voltar</button>
                </div>
            </div>`;
    },

    _collectFlutuanteFields() {
        const c = this.state.selected.element.content || {};

        return {
            ...c,
            position: {
                mode:            $('#flutMode').val() || 'float',
                x:               parseFloat($('#flutX').val()) || 0,
                y:               parseFloat($('#flutY').val()) || 0,
                anchor_x:        $('#flutAnchorX').val() || 'center',
                anchor_y:        $('#flutAnchorY').val() || 'center',
                z_index:         parseInt($('#flutZ').val()) || 0,
                hide_mobile:     $('#flutHideMobile').is(':checked'),
                mobile_override: $('#flutMobileOverride').is(':checked'),
                x_mobile:        parseFloat($('#flutXMobile').val()) || 0,
                y_mobile:        parseFloat($('#flutYMobile').val()) || 0,
            },
            box: {
                width_value:  parseInt($('#flutWidthVal').val())  || '',
                width_unit:   $('#flutWidthUnit').val() || '%',
                max_width:    parseInt($('#flutMaxWidth').val())  || '',
                height_value: parseInt($('#flutHeightVal').val()) || '',
                height_unit:  $('#flutHeightUnit').val() || 'px',
                padding: {
                    top:    parseInt($('#flutPadTop').val())    || 0,
                    right:  parseInt($('#flutPadRight').val())  || 0,
                    bottom: parseInt($('#flutPadBottom').val()) || 0,
                    left:   parseInt($('#flutPadLeft').val())   || 0,
                },
                styles: {
                    bg_color:     $('#flutUseBg').is(':checked') ? $('#flutBgColor').val() : '',
                    border_width: parseInt($('#flutBorderWidth').val()) || 0,
                    border_color: $('#flutBorderColor').val() || '#e0e0e0',
                    border_radius: {
                        tl: parseInt($('#flutRadiusTL').val()) || 0,
                        tr: parseInt($('#flutRadiusTR').val()) || 0,
                        br: parseInt($('#flutRadiusBR').val()) || 0,
                        bl: parseInt($('#flutRadiusBL').val()) || 0,
                    },
                    shadow: {
                        enabled:  $('#flutShadowEnabled').is(':checked'),
                        color:    $('#flutShadowColor').val() || '#000000',
                        size:     parseInt($('#flutShadowSize').val())  || 0,
                        distance: parseInt($('#flutShadowDist').val())  || 0,
                        angle:    parseInt($('#flutShadowAngle').val()) || 0,
                        opacity:  parseInt($('#flutShadowOp').val())    || 0,
                    },
                },
            },
        };
    },

    saveFlutuanteFields() {
        if (this.state.mode !== 'panels') return;
        this._persistElementContent(this._collectFlutuanteFields());
    },

    // Espelha FlutuantePlugin::render().
    _renderFlutuantePreview(element) {
        const c    = element.content || {};
        const item = (c.items || [])[0] || { id: 0, elements: [] };
        const pos  = c.position || {};
        const box  = c.box || {};

        const filhos = (item.elements || [])
            .map(el => this.renderPanelsLeafElement(el, element.id, item.id))
            .join('');

        const flutuando = (pos.mode || 'float') === 'float';
        const classes = 'plugin-flutuante'
            + (flutuando ? '' : ' plugin-flutuante--normal')
            + (pos.hide_mobile ? ' plugin-flutuante--hide-mobile' : '');

        return `<div class="${classes} editorFlutuante" data-flut-id="${element.id}" style="${this._buildFlutuanteStyle(pos, box)}">
            <span class="editorFlutuante__handle" title="Arraste para posicionar">✥</span>
            <div class="plugin-flutuante__inner">${filhos || '<em class="previewEmpty">Bloco vazio — adicione elementos no painel</em>'}</div>
        </div>`;
    },

    _buildFlutuanteStyle(pos, box) {
        const desloca = (a) => a === 'start' ? '0' : a === 'end' ? '-100%' : '-50%';
        const limita  = (v) => Math.max(-50, Math.min(150, parseFloat(v) || 0));

        let css = '';

        if ((pos.mode || 'float') === 'float') {
            css += `left:${limita(pos.x !== undefined ? pos.x : 50)}%;`
                +  `top:${limita(pos.y !== undefined ? pos.y : 50)}%;`
                +  `transform:translate(${desloca(pos.anchor_x || 'center')},${desloca(pos.anchor_y || 'center')});`
                +  `z-index:${parseInt(pos.z_index) || 0};`;
        }

        if (box.width_value)  css += `width:${parseInt(box.width_value)}${box.width_unit || '%'};`;
        if (box.max_width)    css += `max-width:${parseInt(box.max_width)}px;`;
        if (box.height_value) css += `height:${parseInt(box.height_value)}${box.height_unit || 'px'};`;

        const p = box.padding || {};
        if (p.top || p.right || p.bottom || p.left) {
            css += `padding:${p.top||0}px ${p.right||0}px ${p.bottom||0}px ${p.left||0}px;`;
        }

        return css + this._buildInlineStyle(box.styles || {});
    },

    _flutuanteDefaultContent() {
        return {
            items: [{ id: this._genLocalId(), title: '', elements: [] }],
            position: {
                mode: 'float', x: 50, y: 50, anchor_x: 'center', anchor_y: 'center', z_index: 10,
                hide_mobile: false, mobile_override: false, x_mobile: 50, y_mobile: 50,
            },
            box: {
                width_value: '', width_unit: '%', max_width: 420,
                height_value: '', height_unit: 'px',
                padding: { top: 24, right: 24, bottom: 24, left: 24 },
                styles: {
                    bg_color: '#ffffff', border_width: 0, border_color: '#e0e0e0',
                    border_radius: { tl: 10, tr: 10, br: 10, bl: 10 },
                    shadow: { enabled: true, color: '#000000', size: 24, distance: 8, angle: 0, opacity: 18 },
                },
            },
        };
    },

    // ── Calculadora de impacto (plugin "calculadora") ─────────
    panelCalculadoraElement(element) {
        const c = element.content || {};
        const h = c.header || {};
        const f = c.form   || {};
        const t = c.style  || {};
        const animais = c.animals || [];
        const valores = c.values  || [];
        const pages   = (typeof ALL_PAGES !== 'undefined' && ALL_PAGES) || [];
        const calcIcons = [
            ['fa-solid fa-paw', 'Pata'], ['fa-solid fa-fish', 'Peixe'],
            ['fa-solid fa-dove', 'Ave'], ['fa-solid fa-cow', 'Animal'],
            ['fa-solid fa-shield-heart', 'Proteção'], ['fa-solid fa-heart', 'Coração'],
            ['fa-solid fa-hand-holding-heart', 'Cuidado'], ['fa-solid fa-seedling', 'Natureza']
        ];

        const soma = animais.reduce((acc, a) => acc + (parseFloat(a.pct) || 0), 0);

        const cor = (rotulo, campo, valor, padrao) => `
            <div class="panelField">
                <label>${rotulo}</label>
                <div class="colorRow">
                    <input type="color" class="colorInput" id="${campo}" value="${valor || padrao}">
                    <input type="text" class="input" id="${campo}Hex" value="${valor || ''}" placeholder="${padrao}">
                </div>
            </div>`;

        const animaisHtml = animais.map((a, i) => `
            <div class="calcAnimalRow" data-animal-id="${a.id}">
                <div class="structureCol__header">
                    <span>Espécie ${i + 1}</span>
                    <button class="structureCol__gear btnCalcAnimalRemove" data-animal-id="${a.id}" title="Remover">✕</button>
                </div>
                <div class="calcAnimalRow__body">
                    <label class="calcAnimalRow__field calcAnimalRow__field--name"><span>Nome</span>
                        <input type="text" class="input calcAnimalName" value="${this.escHtml(a.name || '')}" placeholder="Ex.: Roedores">
                    </label>
                    <label class="calcAnimalRow__field"><span>Percentual</span>
                        <div class="calcAnimalRow__pct"><input type="number" class="input calcAnimalPct" value="${a.pct !== undefined ? a.pct : 0}" min="0" max="100" step="0.01"><span>%</span></div>
                    </label>
                    <label class="calcAnimalRow__field calcAnimalRow__field--icon"><span>Ícone</span>
                        <div class="calcAnimalRow__iconSelect"><i class="${this.escHtml(a.icon || 'fa-solid fa-paw')}"></i><select class="input calcAnimalIcon">${calcIcons.map(([icon, label]) => `<option value="${icon}" ${(a.icon || 'fa-solid fa-paw') === icon ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
                    </label>
                </div>
            </div>`).join('');

        const valoresHtml = valores.map((v, i) => `
            <div class="calcValueRow" data-index="${i}">
                <span class="calcValueRow__prefix">R$</span><input type="number" class="input calcValueInput" value="${parseInt(v) || 0}" min="1">
                <button class="btnCalcValueRemove" data-index="${i}" title="Remover">✕</button>
            </div>`).join('');

        return `
            <div class="panelBody">
                <div class="panelSection">
                    <h4>Calculadora de impacto</h4>

                    <div class="panelField">
                        <label>Tarja acima do título</label>
                        <input type="text" class="input" id="calcEyebrow" value="${this.escHtml(h.eyebrow || '')}" placeholder="Calculadora de impacto">
                    </div>
                    <div class="panelField">
                        <label>Título</label>
                        <div id="calcTitleEditor" class="quillEditor quillEditor--compact"></div>
                    </div>
                    <div class="panelField">
                        <label>Texto de apoio</label>
                        <div id="calcTextEditor" class="quillEditor quillEditor--compact"></div>
                    </div>

                    <div class="panelDivider"></div>
                    <h4>Espécies e percentuais</h4>
                    <p class="panelNote">Cada espécie recebe uma fatia do valor doado. A soma ideal é 100%.</p>
                    <div class="calcAnimalList">${animaisHtml || '<p class="panelHint">Nenhuma espécie ainda.</p>'}</div>
                    <div class="calcSoma ${Math.round(soma) === 100 ? 'is-ok' : 'is-warn'}" id="calcSoma">
                        Soma: ${this._formataPct(soma)}%${Math.round(soma) === 100 ? '' : ' — o ideal é 100%'}
                    </div>
                    <button type="button" class="btn btn--secondary btn--full" id="btnCalcAnimalAdd">+ Adicionar espécie</button>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Custo por animal (R$)</label>
                        <input type="number" class="input" id="calcCost" value="${f.cost_per_animal !== undefined ? f.cost_per_animal : 15}" min="0.01" step="0.01">
                        <p class="panelNote">Quanto custa ajudar um animal. É o divisor da conta.</p>
                    </div>

                    <div class="panelDivider"></div>
                    <h4>Valores sugeridos</h4>
                    <div class="calcValueList">${valoresHtml || '<p class="panelHint">Nenhum valor ainda.</p>'}</div>
                    <button type="button" class="btn btn--secondary btn--full" id="btnCalcValueAdd">+ Adicionar valor</button>
                    <div class="panelField">
                        <label>Valor marcado por padrão</label>
                        <input type="number" class="input" id="calcDefaultIndex" value="${(f.default_index !== undefined ? f.default_index : 1) + 1}" min="1" max="${Math.max(1, valores.length)}">
                        <p class="panelNote">Posição na lista acima (1 = o primeiro).</p>
                    </div>

                    <div class="panelDivider"></div>
                    <h4>Textos do formulário</h4>
                    <div class="panelField">
                        <label>Título "escolha um valor"</label>
                        <input type="text" class="input" id="calcLabelValor" value="${this.escHtml(f.label_valor || '')}" placeholder="Escolha um valor">
                    </div>
                    <div class="panelField">
                        <label>Texto do campo livre</label>
                        <input type="text" class="input" id="calcPlaceholder" value="${this.escHtml(f.placeholder || '')}" placeholder="Outro valor (R$)">
                    </div>
                    <div class="panelField panelField--toggle">
                        <label>Mostrar frequência</label>
                        <input type="checkbox" id="calcShowFreq" ${f.show_frequency !== false ? 'checked' : ''}>
                    </div>
                    <div id="calcFreqControls" ${f.show_frequency !== false ? '' : 'style="display:none"'}>
                        <div class="panelField">
                            <label>Título "frequência"</label>
                            <input type="text" class="input" id="calcLabelFreq" value="${this.escHtml(f.label_frequencia || '')}" placeholder="Frequência">
                        </div>
                        <div class="twoColGrid">
                            <div class="panelField">
                                <label>Botão mensal</label>
                                <input type="text" class="input" id="calcLabelMensal" value="${this.escHtml(f.label_mensal || '')}" placeholder="Mensal">
                            </div>
                            <div class="panelField">
                                <label>Botão única</label>
                                <input type="text" class="input" id="calcLabelUnica" value="${this.escHtml(f.label_unica || '')}" placeholder="Única">
                            </div>
                        </div>
                        <div class="panelField">
                            <label>Multiplicador do mensal</label>
                            <input type="number" class="input" id="calcMultiplier" value="${f.monthly_multiplier || 12}" min="1" max="60">
                            <p class="panelNote">Quantas parcelas o mensal considera na conta (12 = um ano).</p>
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <h4>Botão</h4>
                    <div class="panelField">
                        <label>Texto (mensal)</label>
                        <input type="text" class="input" id="calcBtnText" value="${this.escHtml(f.button_text || '')}" placeholder="FAZER DOAÇÃO MENSAL">
                        <p class="panelNote">Deixe vazio para não mostrar o botão.</p>
                    </div>
                    <div class="panelField">
                        <label>Texto (doação única)</label>
                        <input type="text" class="input" id="calcBtnTextUnica" value="${this.escHtml(f.button_text_unica || '')}" placeholder="FAZER DOAÇÃO">
                    </div>
                    <div class="panelField">
                        <label>Link</label>
                        <select class="input" id="calcLinkType">
                            <option value="page" ${f.link_type === 'page' ? 'selected' : ''}>Página</option>
                            <option value="url"  ${(f.link_type || 'url') === 'url' ? 'selected' : ''}>URL</option>
                        </select>
                    </div>
                    <div class="panelField">
                        <select class="input" id="calcPageSelect" ${f.link_type === 'page' ? '' : 'style="display:none"'}>
                            <option value="">— Selecione a página —</option>
                            ${pages.map(p => `<option value="${p.id}" ${parseInt(f.page_id) === p.id ? 'selected' : ''}>${this.escHtml(p.title)} (/${this.escHtml(p.slug)})</option>`).join('')}
                        </select>
                        <input type="text" class="input" id="calcUrl" value="${this.escHtml(f.url || '')}" placeholder="https://..." ${f.link_type === 'page' ? 'style="display:none"' : ''}>
                    </div>
                    <div class="panelField panelField--toggle">
                        <label>Abrir em nova aba</label>
                        <input type="checkbox" id="calcBlank" ${f.target_blank ? 'checked' : ''}>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Texto do "?" (explicação do cálculo)</label>
                        <div id="calcTooltipEditor" class="quillEditor quillEditor--compact"></div>
                        <p class="panelNote">Deixe vazio para esconder.</p>
                    </div>

                    <div class="panelDivider"></div>
                    <h4>Aparência</h4>
                    ${cor('Cor de destaque', 'calcAccent', t.accent, '#ae272c')}
                    ${cor('Cor da tarja', 'calcEyebrowColor', t.eyebrow_color, '#ae272c')}
                    ${cor('Cor do título', 'calcTitleColor', t.title_color, '#111111')}
                    ${cor('Cor do texto', 'calcTextColor', t.text_color, '#555555')}
                    ${cor('Fundo do painel', 'calcPanelBg', t.panel_bg, '#ffffff')}
                    ${cor('Cor dos números', 'calcNumberColor', t.number_color, '#111111')}
                    <div class="twoColGrid">
                        <div class="panelField">
                            <label>Cantos do painel</label>
                            <input type="number" class="input" id="calcPanelRadius" value="${t.panel_radius !== undefined ? t.panel_radius : 14}" min="0" max="60">
                        </div>
                        <div class="panelField">
                            <label>Espaço interno</label>
                            <input type="number" class="input" id="calcPanelPadding" value="${t.panel_padding !== undefined ? t.panel_padding : 28}" min="0" max="80">
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Espaço entre texto e painel (px)</label>
                        <input type="number" class="input" id="calcGap" value="${t.gap !== undefined ? t.gap : 32}" min="0" max="120">
                    </div>
                    <div class="panelField panelField--toggle">
                        <label>Sombra no painel</label>
                        <input type="checkbox" id="calcPanelShadow" ${t.panel_shadow !== false ? 'checked' : ''}>
                    </div>

                    <button class="btn btn--success btn--full" id="btnApplyCalculadora">Salvar alterações</button>

                    <div class="panelDivider"></div>
                    <button class="btn btn--danger btn--full" id="btnDeleteElement" data-id="${element.id}">Remover elemento</button>
                    <div class="panelDivider"></div>
                    <button class="btn btn--secondary btn--full btnBack">← Voltar</button>
                </div>
            </div>`;
    },

    _formataPct(n) {
        const v = Math.round(n * 100) / 100;
        return v % 1 === 0 ? String(v) : v.toFixed(2);
    },

    _syncCalcAnimalsFromDom(animais) {
        return (animais || []).map(a => {
            const linha = $(`.calcAnimalRow[data-animal-id="${a.id}"]`);
            if (!linha.length) return a;
            return {
                ...a,
                name: linha.find('.calcAnimalName').val(),
                pct:  parseFloat(linha.find('.calcAnimalPct').val()) || 0,
                icon: linha.find('.calcAnimalIcon').val() || 'fa-solid fa-paw',
            };
        });
    },

    _syncCalcValuesFromDom() {
        const valores = [];
        $('.calcValueInput').each(function () {
            const v = parseInt($(this).val()) || 0;
            if (v > 0) valores.push(v);
        });
        return valores;
    },

    initCalculadoraEditors(element) {
        const c = element.content || {};
        const configs = {
            title:   { selector: '#calcTitleEditor', value: (c.header || {}).title || '', placeholder: 'Título da calculadora' },
            text:    { selector: '#calcTextEditor', value: (c.header || {}).text || '', placeholder: 'Texto de apoio' },
            tooltip: { selector: '#calcTooltipEditor', value: (c.form || {}).tooltip || '', placeholder: 'Explicação do cálculo' },
        };

        Object.entries(configs).forEach(([key, cfg]) => {
            const editor = new Quill(cfg.selector, {
                theme: 'snow',
                placeholder: cfg.placeholder,
                modules: { toolbar: [['bold', 'italic', 'underline'], [{ list: 'bullet' }], ['clean']] }
            });
            if (cfg.value) {
                if (/<[a-z][\s\S]*>/i.test(cfg.value)) editor.clipboard.dangerouslyPasteHTML(cfg.value);
                else editor.setText(cfg.value);
            }
            this.calcQuills[key] = editor;
        });
    },

    _calcEditorHtml(key) {
        const editor = this.calcQuills[key];
        return !editor || editor.getText().trim() === '' ? '' : editor.root.innerHTML;
    },

    _collectCalculadoraFields() {
        const c = this.state.selected.element.content || {};
        const valores = this._syncCalcValuesFromDom();

        return {
            header: {
                eyebrow: $('#calcEyebrow').val(),
                title:   this._calcEditorHtml('title'),
                text:    this._calcEditorHtml('text'),
            },
            animals: this._syncCalcAnimalsFromDom(c.animals),
            values:  valores,
            form: {
                ...(c.form || {}),
                label_valor:        $('#calcLabelValor').val(),
                placeholder:        $('#calcPlaceholder').val(),
                // No painel a posição é 1-based (mais natural); no content é índice.
                default_index:      Math.max(0, Math.min(valores.length - 1, (parseInt($('#calcDefaultIndex').val()) || 1) - 1)),
                show_frequency:     $('#calcShowFreq').is(':checked'),
                label_frequencia:   $('#calcLabelFreq').val(),
                label_mensal:       $('#calcLabelMensal').val(),
                label_unica:        $('#calcLabelUnica').val(),
                monthly_multiplier: Math.max(1, parseInt($('#calcMultiplier').val()) || 12),
                cost_per_animal:    Math.max(0.01, parseFloat($('#calcCost').val()) || 15),
                button_text:        $('#calcBtnText').val(),
                button_text_unica:  $('#calcBtnTextUnica').val(),
                link_type:          $('#calcLinkType').val() || 'url',
                page_id:            $('#calcPageSelect').val() || '',
                url:                $('#calcUrl').val().trim(),
                target_blank:       $('#calcBlank').is(':checked'),
                tooltip:            this._calcEditorHtml('tooltip'),
            },
            style: {
                accent:        this._normalizeColor($('#calcAccentHex').val(),       $('#calcAccent').val()),
                eyebrow_color: this._normalizeColor($('#calcEyebrowColorHex').val(), $('#calcEyebrowColor').val()),
                title_color:   this._normalizeColor($('#calcTitleColorHex').val(),   $('#calcTitleColor').val()),
                text_color:    this._normalizeColor($('#calcTextColorHex').val(),    $('#calcTextColor').val()),
                panel_bg:      this._normalizeColor($('#calcPanelBgHex').val(),      $('#calcPanelBg').val()),
                number_color:  this._normalizeColor($('#calcNumberColorHex').val(),  $('#calcNumberColor').val()),
                panel_radius:  parseInt($('#calcPanelRadius').val()) || 0,
                panel_padding: parseInt($('#calcPanelPadding').val()) || 0,
                gap:           parseInt($('#calcGap').val()) || 0,
                panel_shadow:  $('#calcPanelShadow').is(':checked'),
            },
        };
    },

    saveCalculadoraFields() {
        if (!['element', 'grid-element', 'panels-element'].includes(this.state.mode)) return;
        this._persistElementContent(this._collectCalculadoraFields());
    },

    // Espelha CalculadoraPlugin::render(). O preview mostra os números já calculados
    // com o valor marcado, para dar pra conferir os percentuais sem sair do editor.
    _renderCalculadoraPreview(c) {
        const animais = (c.animals || []).filter(a => (a.name || '').trim() !== '');
        const valores = (c.values || []).map(v => parseInt(v) || 0).filter(v => v > 0);
        const h = c.header || {};
        const f = c.form   || {};
        const t = c.style  || {};

        if (!animais.length) {
            return '<em class="previewEmpty">Nenhuma espécie configurada — adicione no painel ao lado</em>';
        }

        const ativo = Math.max(0, Math.min(valores.length - 1, parseInt(f.default_index) || 0));
        const custo = Math.max(0.01, parseFloat(f.cost_per_animal) || 15);
        const total = (valores[ativo] || 0) * (f.show_frequency !== false ? (parseInt(f.monthly_multiplier) || 12) : 1);

        let html = `<div class="plugin-calculadora" style="${this._buildCalcCssVars(t)}"><div class="plugin-calculadora__inner">`;

        if ((h.eyebrow || '').trim() || (h.title || '').trim() || (h.text || '').trim()) {
            html += '<div class="plugin-calculadora__texto">';
            if ((h.eyebrow || '').trim()) html += `<p class="plugin-calculadora__eyebrow">${this.escHtml(h.eyebrow)}</p>`;
            if ((h.title || '').trim())   html += `<h2 class="plugin-calculadora__title">${h.title}</h2>`;
            if ((h.text || '').trim())    html += `<div class="plugin-calculadora__text">${h.text}</div>`;
            html += '</div>';
        }

        html += '<div class="plugin-calculadora__panel"><div class="plugin-calculadora__form">'
             +  `<h3 class="plugin-calculadora__label">${this.escHtml(f.label_valor || 'Escolha um valor')}</h3>`
             +  '<div class="plugin-calculadora__values">'
             +  valores.map((v, i) => `<button type="button" class="plugin-calculadora__value${i === ativo ? ' is-active' : ''}">R${v}</button>`).join('')
             +  '</div>'
             +  `<input type="text" class="plugin-calculadora__input" placeholder="${this.escHtml(f.placeholder || 'Outro valor (R$)')}">`;

        if (f.show_frequency !== false) {
            html += `<h3 class="plugin-calculadora__label plugin-calculadora__label--spaced">${this.escHtml(f.label_frequencia || 'Frequência')}</h3>`
                 +  '<div class="plugin-calculadora__frequency">'
                 +  `<button type="button" class="plugin-calculadora__freq is-active">${this.escHtml(f.label_mensal || 'Mensal')}</button>`
                 +  `<button type="button" class="plugin-calculadora__freq">${this.escHtml(f.label_unica || 'Única')}</button>`
                 +  '</div>';
        }

        if ((f.button_text || '').trim()) {
            html += `<a class="plugin-calculadora__donate" href="#">${this.escHtml(f.button_text)}</a>`;
        }

        html += `</div><div class="plugin-calculadora__result"><p class="plugin-calculadora__resultTitle">Com <strong>R$${valores[ativo] || 0} por mês</strong>, você ajuda a:</p>`;

        if ((f.tooltip || '').trim()) {
            html += '<div class="plugin-calculadora__tooltip"><button type="button" class="plugin-calculadora__help">?</button>'
                 +  `<div class="plugin-calculadora__tooltipBox">${f.tooltip}</div></div>`;
        }

        animais.forEach(a => {
            const qtd = (total * ((parseFloat(a.pct) || 0) / 100)) / custo;
            const n   = Math.round(qtd * 10) / 10;
            html += '<div class="plugin-calculadora__animal">'
                 +  `<i class="plugin-calculadora__animalIcon ${this.escHtml(a.icon || 'fa-solid fa-paw')}"></i>`
                 +  `<strong class="plugin-calculadora__number">${n % 1 === 0 ? n : n.toFixed(1)}</strong>`
                 +  `<span class="plugin-calculadora__animalName">${this.escHtml(a.name)}</span></div>`;
        });

        return html + '</div></div></div></div>';
    },

    // Espelha CalculadoraPlugin::buildCssVars().
    _buildCalcCssVars(t) {
        const vars = {
            '--calc-accent':        t.accent        || '#ae272c',
            '--calc-eyebrow':       t.eyebrow_color || '#ae272c',
            '--calc-title':         t.title_color   || '#111111',
            '--calc-text':          t.text_color    || '#555555',
            '--calc-panel-bg':      t.panel_bg      || '#ffffff',
            '--calc-panel-radius':  `${Math.max(0, t.panel_radius !== undefined ? parseInt(t.panel_radius) || 0 : 14)}px`,
            '--calc-panel-pad':     `${Math.max(0, t.panel_padding !== undefined ? parseInt(t.panel_padding) || 0 : 28)}px`,
            '--calc-number':        t.number_color  || '#111111',
            '--calc-gap':           `${Math.max(0, t.gap !== undefined ? parseInt(t.gap) || 0 : 32)}px`,
            '--calc-panel-shadow':  t.panel_shadow !== false ? '0 8px 30px rgba(0,0,0,0.10)' : 'none',
        };
        let css = '';
        for (const k in vars) css += `${k}:${vars[k]};`;
        return css;
    },

    _calculadoraDefaultContent() {
        const animal = (name, pct, icon) => ({ id: this._genLocalId(), name, pct, icon });
        return {
            header: {
                eyebrow: 'Calculadora de impacto',
                title: '<p>Veja quantos animais <strong>você pode ajudar.</strong></p>',
                text: '<p>Seu apoio forma pessoas e impulsiona mudanças reais.<br>Use a calculadora e veja o impacto da sua doação.</p>',
            },
            animals: [animal('Roedores', 65, 'fa-solid fa-paw'), animal('Peixes', 20, 'fa-solid fa-fish'), animal('Galinhas', 7, 'fa-solid fa-dove'), animal('Outros', 8, 'fa-solid fa-shield-heart')],
            values: [30, 60, 120],
            form: {
                label_valor: 'Escolha um valor', placeholder: 'Outro valor (R$)', default_index: 1,
                show_frequency: true, label_frequencia: 'Frequência', label_mensal: 'Mensal', label_unica: 'Única',
                monthly_multiplier: 12, cost_per_animal: 15,
                button_text: 'FAZER DOAÇÃO MENSAL', button_text_unica: 'FAZER DOAÇÃO',
                link_type: 'url', page_id: '', url: '', target_blank: false,
                tooltip: '<p>Trata-se de uma simplificação baseada em estimativas, que deve ser interpretada com cautela.</p>',
            },
            style: {
                accent: '#ae272c', eyebrow_color: '#ae272c', title_color: '#111111', text_color: '#555555',
                panel_bg: '#ffffff', panel_radius: 14, panel_padding: 28, panel_shadow: true,
                number_color: '#111111', gap: 32,
            },
        };
    },

    // ── Depoimentos (plugin "testimonials") ───────────────────
    panelTestimonialsElement(element) {
        const c = element.content || {};
        const h = c.header || {};
        const s = c.slider || {};
        const t = c.style  || {};
        const itens = c.items || [];

        const cor = (id, valor, padrao) => `
            <div class="panelField">
                <label>${id.rotulo}</label>
                <div class="colorRow">
                    <input type="color" class="colorInput" id="${id.campo}" value="${valor || padrao}">
                    <input type="text" class="input" id="${id.campo}Hex" value="${valor || ''}" placeholder="${padrao}">
                </div>
            </div>`;

        const itensHtml = itens.map((item, i) => `
            <div class="depItemRow" data-item-id="${item.id}">
                <div class="structureCol__header">
                    <span>Depoimento ${i + 1}</span>
                    <button class="structureCol__gear btnDepRemove" data-item-id="${item.id}" title="Remover">✕</button>
                </div>
                <div class="depItemRow__body">
                    <textarea class="input cardTextArea depItemText" rows="3" placeholder="Texto do depoimento">${this.escHtml(item.text || '')}</textarea>
                    <input type="text" class="input depItemName"  value="${this.escHtml(item.name  || '')}" placeholder="Nome">
                    <input type="text" class="input depItemRole"  value="${this.escHtml(item.role  || '')}" placeholder="Cargo / profissão (opcional)">
                    <input type="text" class="input depItemExtra" value="${this.escHtml(item.extra || '')}" placeholder="Linha extra (ex: Aluna da 1ª Edição)">
                    <div class="depItemRow__order">
                        <button class="btnDepUp"   data-item-id="${item.id}" ${i === 0 ? 'disabled' : ''} title="Subir">↑</button>
                        <button class="btnDepDown" data-item-id="${item.id}" ${i === itens.length - 1 ? 'disabled' : ''} title="Descer">↓</button>
                    </div>
                </div>
            </div>`).join('');

        return `
            <div class="panelBody">
                <div class="panelSection">
                    <h4>Depoimentos</h4>

                    <div class="panelField">
                        <label>Tarja acima do título</label>
                        <input type="text" class="input" id="depEyebrow" value="${this.escHtml(h.eyebrow || '')}" placeholder="Depoimentos">
                    </div>
                    <div class="panelField">
                        <label>Título</label>
                        <input type="text" class="input" id="depTitle" value="${this.escHtml(h.title || '')}" placeholder="Quem apoia, <strong>recomenda!</strong>">
                        <p class="panelNote">Use &lt;strong&gt;…&lt;/strong&gt; para destacar parte do título.</p>
                    </div>
                    <div class="panelField">
                        <label>Alinhamento do topo</label>
                        <select class="input" id="depAlign">
                            <option value="left"   ${h.align === 'left'   ? 'selected' : ''}>Esquerda</option>
                            <option value="center" ${(h.align || 'center') === 'center' ? 'selected' : ''}>Centro</option>
                            <option value="right"  ${h.align === 'right'  ? 'selected' : ''}>Direita</option>
                        </select>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Depoimentos</label>
                        <div class="depItemList">${itensHtml || '<p class="panelHint">Nenhum depoimento ainda.</p>'}</div>
                        <button type="button" class="btn btn--secondary btn--full" id="btnDepAdd">+ Adicionar depoimento</button>
                    </div>

                    <div class="panelDivider"></div>
                    <h4>Carrossel</h4>
                    <div class="twoColGrid">
                        <div class="panelField">
                            <label>Cards no desktop</label>
                            <input type="number" class="input" id="depSlidesDesktop" value="${s.slides_desktop || 3}" min="1" max="6">
                        </div>
                        <div class="panelField">
                            <label>No tablet</label>
                            <input type="number" class="input" id="depSlidesTablet" value="${s.slides_tablet || 2}" min="1" max="4">
                        </div>
                    </div>
                    <div class="panelField">
                        <label>No celular</label>
                        <input type="number" class="input" id="depSlidesMobile" value="${s.slides_mobile || 1}" min="1" max="3">
                    </div>
                    <div class="panelField panelField--toggle">
                        <label>Setas</label>
                        <input type="checkbox" id="depArrows" ${s.arrows !== false ? 'checked' : ''}>
                    </div>
                    <div class="panelField panelField--toggle">
                        <label>Bolinhas</label>
                        <input type="checkbox" id="depDots" ${s.dots !== false ? 'checked' : ''}>
                    </div>
                    <div class="panelField panelField--toggle">
                        <label>Loop infinito</label>
                        <input type="checkbox" id="depInfinite" ${s.infinite !== false ? 'checked' : ''}>
                    </div>
                    <div class="panelField panelField--toggle">
                        <label>Passar sozinho</label>
                        <input type="checkbox" id="depAutoplay" ${s.autoplay ? 'checked' : ''}>
                    </div>
                    <div class="panelField">
                        <label>Tempo entre trocas (ms)</label>
                        <input type="number" class="input" id="depAutoplaySpeed" value="${s.autoplay_speed || 5000}" min="1000" step="500">
                    </div>

                    <div class="panelDivider"></div>
                    <h4>Aparência</h4>
                    <div class="panelField panelField--toggle">
                        <label>Mostrar avatar com iniciais</label>
                        <input type="checkbox" id="depShowAvatar" ${t.show_avatar !== false ? 'checked' : ''}>
                    </div>
                    <div class="panelField panelField--toggle">
                        <label>Mostrar "Ver mais"</label>
                        <input type="checkbox" id="depShowMore" ${t.show_more !== false ? 'checked' : ''}>
                    </div>
                    <div class="panelField">
                        <label>Texto do "Ver mais"</label>
                        <input type="text" class="input" id="depMoreLabel" value="${this.escHtml(t.more_label || '')}" placeholder="Ver mais">
                    </div>

                    ${cor({ rotulo: 'Cor de destaque (setas, bolinhas, link)', campo: 'depAccent' }, t.accent, '#ae272c')}
                    ${cor({ rotulo: 'Cor da tarja', campo: 'depEyebrowColor' }, t.eyebrow_color, '#ae272c')}
                    ${cor({ rotulo: 'Cor do título', campo: 'depTitleColor' }, t.title_color, '#111111')}
                    ${cor({ rotulo: 'Fundo do card', campo: 'depCardBg' }, t.card_bg, '#ffffff')}
                    ${cor({ rotulo: 'Cor do texto', campo: 'depQuoteColor' }, t.quote_color, '#555555')}
                    ${cor({ rotulo: 'Cor do nome', campo: 'depNameColor' }, t.name_color, '#111111')}
                    ${cor({ rotulo: 'Fundo do avatar', campo: 'depAvatarBg' }, t.avatar_bg, '#f3d9dc')}
                    ${cor({ rotulo: 'Cor das iniciais', campo: 'depAvatarColor' }, t.avatar_color, '#ae272c')}

                    <div class="panelField">
                        <label>Cor de fundo da seção</label>
                        <div class="colorRow">
                            <input type="checkbox" id="depUseSectionBg" ${t.section_bg ? 'checked' : ''} />
                            <input type="color" class="colorInput" id="depSectionBg" value="${t.section_bg || '#f7f7f7'}" ${t.section_bg ? '' : 'disabled'}>
                        </div>
                    </div>

                    <div class="twoColGrid">
                        <div class="panelField">
                            <label>Tamanho do texto (px)</label>
                            <input type="number" class="input" id="depQuoteSize" value="${t.quote_size || 15}" min="10" max="40">
                        </div>
                        <div class="panelField">
                            <label>Espaço entre cards</label>
                            <input type="number" class="input" id="depGap" value="${t.gap !== undefined ? t.gap : 16}" min="0" max="80">
                        </div>
                    </div>
                    <div class="twoColGrid">
                        <div class="panelField">
                            <label>Cantos do card (px)</label>
                            <input type="number" class="input" id="depCardRadius" value="${t.card_radius !== undefined ? t.card_radius : 10}" min="0" max="60">
                        </div>
                        <div class="panelField">
                            <label>Espaço interno</label>
                            <input type="number" class="input" id="depCardPadding" value="${t.card_padding !== undefined ? t.card_padding : 28}" min="0" max="80">
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Borda do card (px)</label>
                        <div class="borderRow">
                            <input type="number" class="input borderWidth" id="depCardBorderWidth" value="${t.card_border_width || 0}" min="0" max="20">
                            <span class="borderUnit">px</span>
                            <input type="color" class="colorInput" id="depCardBorderColor" value="${t.card_border_color || '#e0e0e0'}" />
                        </div>
                    </div>
                    <div class="panelField panelField--toggle">
                        <label>Sombra no card</label>
                        <input type="checkbox" id="depCardShadow" ${t.card_shadow !== false ? 'checked' : ''}>
                    </div>

                    <button class="btn btn--success btn--full" id="btnApplyTestimonials">Salvar alterações</button>

                    <div class="panelDivider"></div>
                    <button class="btn btn--danger btn--full" id="btnDeleteElement" data-id="${element.id}">Remover elemento</button>
                    <div class="panelDivider"></div>
                    <button class="btn btn--secondary btn--full btnBack">← Voltar</button>
                </div>
            </div>`;
    },

    // Lê os depoimentos que estão na tela (mesmo papel do _syncMenuItemsFromDom).
    _syncDepItemsFromDom(itens) {
        return (itens || []).map(item => {
            const linha = $(`.depItemRow[data-item-id="${item.id}"]`);
            if (!linha.length) return item;
            return {
                ...item,
                text:  linha.find('.depItemText').val(),
                name:  linha.find('.depItemName').val(),
                role:  linha.find('.depItemRole').val(),
                extra: linha.find('.depItemExtra').val(),
            };
        });
    },

    _collectTestimonialsFields() {
        const c = this.state.selected.element.content || {};

        return {
            header: {
                eyebrow: $('#depEyebrow').val(),
                title:   $('#depTitle').val(),
                align:   $('#depAlign').val() || 'center',
            },
            items: this._syncDepItemsFromDom(c.items),
            slider: {
                slides_desktop: Math.max(1, parseInt($('#depSlidesDesktop').val()) || 3),
                slides_tablet:  Math.max(1, parseInt($('#depSlidesTablet').val())  || 2),
                slides_mobile:  Math.max(1, parseInt($('#depSlidesMobile').val())  || 1),
                arrows:         $('#depArrows').is(':checked'),
                dots:           $('#depDots').is(':checked'),
                infinite:       $('#depInfinite').is(':checked'),
                autoplay:       $('#depAutoplay').is(':checked'),
                autoplay_speed: Math.max(1000, parseInt($('#depAutoplaySpeed').val()) || 5000),
            },
            style: {
                accent:        this._normalizeColor($('#depAccentHex').val(),       $('#depAccent').val()),
                eyebrow_color: this._normalizeColor($('#depEyebrowColorHex').val(), $('#depEyebrowColor').val()),
                title_color:   this._normalizeColor($('#depTitleColorHex').val(),   $('#depTitleColor').val()),
                card_bg:       this._normalizeColor($('#depCardBgHex').val(),       $('#depCardBg').val()),
                quote_color:   this._normalizeColor($('#depQuoteColorHex').val(),   $('#depQuoteColor').val()),
                name_color:    this._normalizeColor($('#depNameColorHex').val(),    $('#depNameColor').val()),
                avatar_bg:     this._normalizeColor($('#depAvatarBgHex').val(),     $('#depAvatarBg').val()),
                avatar_color:  this._normalizeColor($('#depAvatarColorHex').val(),  $('#depAvatarColor').val()),
                section_bg:    $('#depUseSectionBg').is(':checked') ? $('#depSectionBg').val() : '',
                quote_size:    Math.max(10, parseInt($('#depQuoteSize').val()) || 15),
                gap:           parseInt($('#depGap').val()) || 0,
                card_radius:   parseInt($('#depCardRadius').val()) || 0,
                card_padding:  parseInt($('#depCardPadding').val()) || 0,
                card_border_width: parseInt($('#depCardBorderWidth').val()) || 0,
                card_border_color: $('#depCardBorderColor').val() || '#e0e0e0',
                card_shadow:   $('#depCardShadow').is(':checked'),
                show_avatar:   $('#depShowAvatar').is(':checked'),
                show_more:     $('#depShowMore').is(':checked'),
                more_label:    $('#depMoreLabel').val(),
            },
        };
    },

    saveTestimonialsFields() {
        if (!['element', 'grid-element', 'panels-element'].includes(this.state.mode)) return;
        this._persistElementContent(this._collectTestimonialsFields());
    },

    // Espelha TestimonialsPlugin::render(). O preview NÃO inicializa o Slick: os cards
    // aparecem lado a lado numa faixa rolável, para dar pra ver e editar todos sem
    // brigar com o carrossel a cada redesenho do canvas.
    _renderTestimonialsPreview(c) {
        const itens = (c.items || []).filter(i => (i.text || '').trim() !== '');
        const h = c.header || {};
        const t = c.style  || {};

        if (!itens.length) {
            return '<em class="previewEmpty">Nenhum depoimento — adicione no painel ao lado</em>';
        }

        const align = ['left', 'center', 'right'].includes(h.align) ? h.align : 'center';
        let html = `<div class="plugin-depoimentos plugin-depoimentos--preview" style="${this._buildDepCssVars(t)}">`;

        if ((h.eyebrow || '').trim() || (h.title || '').trim()) {
            html += `<div class="plugin-depoimentos__header" style="text-align:${align};">`;
            if ((h.eyebrow || '').trim()) html += `<p class="plugin-depoimentos__eyebrow">${this.escHtml(h.eyebrow)}</p>`;
            if ((h.title || '').trim())   html += `<h2 class="plugin-depoimentos__title">${h.title}</h2>`;
            html += '</div>';
        }

        html += '<div class="plugin-depoimentos__preview-track">';
        for (const item of itens) {
            html += `<div class="plugin-depoimentos__slide"><article class="plugin-depoimentos__card">
                <div class="plugin-depoimentos__quote">${this.escHtml(item.text).replace(/\n/g, '<br>')}</div>`;

            if ((item.name || '').trim() || (item.role || '').trim()) {
                html += '<div class="plugin-depoimentos__author">';
                if ((item.name || '').trim() && t.show_avatar !== false) {
                    html += `<span class="plugin-depoimentos__avatar">${this.escHtml(this._depIniciais(item.name))}</span>`;
                }
                html += '<p class="plugin-depoimentos__person">';
                if ((item.name || '').trim()) html += `<strong>${this.escHtml(item.name)}</strong>`;
                ['role', 'extra'].forEach(k => {
                    if ((item[k] || '').trim()) html += `<span>${this.escHtml(item[k])}</span>`;
                });
                html += '</p></div>';
            }

            if (t.show_more !== false) {
                html += `<button class="plugin-depoimentos__more" type="button">${this.escHtml((t.more_label || '').trim() || 'Ver mais')}</button>`;
            }

            html += '</article></div>';
        }

        return html + '</div></div>';
    },

    _depIniciais(nome) {
        const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
        if (!partes.length) return '';
        const a = partes[0].charAt(0).toUpperCase();
        const b = partes.length > 1 ? partes[partes.length - 1].charAt(0).toUpperCase() : '';
        return a + b;
    },

    // Espelha TestimonialsPlugin::buildCssVars().
    _buildDepCssVars(t) {
        const vars = {
            '--dep-bg':           t.section_bg   || 'transparent',
            '--dep-accent':       t.accent       || '#ae272c',
            '--dep-eyebrow':      t.eyebrow_color || '#ae272c',
            '--dep-title':        t.title_color  || '#111111',
            '--dep-card-bg':      t.card_bg      || '#ffffff',
            '--dep-card-radius':  `${Math.max(0, t.card_radius !== undefined ? parseInt(t.card_radius) || 0 : 10)}px`,
            '--dep-card-pad':     `${Math.max(0, t.card_padding !== undefined ? parseInt(t.card_padding) || 0 : 28)}px`,
            '--dep-quote':        t.quote_color  || '#555555',
            '--dep-quote-size':   this._fluidFont(Math.max(10, parseInt(t.quote_size) || 15)),
            '--dep-name':         t.name_color   || '#111111',
            '--dep-avatar-bg':    t.avatar_bg    || '#f3d9dc',
            '--dep-avatar-color': t.avatar_color || '#ae272c',
            '--dep-gap':          `${Math.max(0, t.gap !== undefined ? parseInt(t.gap) || 0 : 16)}px`,
            '--dep-card-border':  (parseInt(t.card_border_width) || 0) > 0
                ? `${parseInt(t.card_border_width)}px solid ${t.card_border_color || '#e0e0e0'}`
                : 'none',
            '--dep-card-shadow':  t.card_shadow !== false ? '0 6px 24px rgba(0,0,0,0.10)' : 'none',
        };
        let css = '';
        for (const k in vars) css += `${k}:${vars[k]};`;
        return css;
    },

    _testimonialsDefaultContent() {
        const item = (text, name, role, extra) => ({ id: this._genLocalId(), text, name, role, extra });
        return {
            header: { eyebrow: 'Depoimentos', title: 'Quem apoia, <strong>recomenda!</strong>', align: 'center' },
            items: [
                item('Escreva aqui o depoimento de quem já participou.', 'Nome Sobrenome', 'Profissão', 'Aluna da 1ª Edição do Curso'),
                item('Outro depoimento, contando o impacto do trabalho.', 'Outra Pessoa', 'Profissão', 'Aluno da 1ª Edição do Curso'),
                item('Mais um depoimento para o carrossel ficar cheio.', 'Terceira Pessoa', 'Profissão', 'Aluna da 1ª Edição do Curso'),
            ],
            slider: { slides_desktop: 3, slides_tablet: 2, slides_mobile: 1, arrows: true, dots: true, infinite: true, autoplay: false, autoplay_speed: 5000 },
            style: {
                section_bg: '', accent: '#ae272c', eyebrow_color: '#ae272c', title_color: '#111111',
                card_bg: '#ffffff', card_radius: 10, card_padding: 28,
                card_border_width: 0, card_border_color: '#e0e0e0', card_shadow: true,
                quote_color: '#555555', quote_size: 15, name_color: '#111111',
                avatar_bg: '#f3d9dc', avatar_color: '#ae272c', gap: 16,
                show_avatar: true, show_more: true, more_label: 'Ver mais',
            },
        };
    },

    // ── Card com ícones (plugin "cardicon") ───────────────────
    // Reaproveita o seletor de ícones (_iconPickerHtml) e os campos de botão
    // (_buttonFieldsHtml) — só o selo e os dois textos são específicos daqui.
    panelCardIconElement(element) {
        const c      = element.content || {};
        const image  = c.image  || {};
        const badge  = c.badge  || {};
        const title  = c.title  || {};
        const text   = c.text   || {};
        const button = c.button || {};
        const card   = c.card   || {};
        const st     = card.styles || {};
        const cp     = card.padding || {};
        const br     = st.border_radius || {};
        const sh     = st.shadow || {};

        const alinhamento = (sel) => ['left', 'center', 'right'].map(v => {
            const rotulo = { left: 'Esquerda', center: 'Centro', right: 'Direita' }[v];
            return `<option value="${v}" ${(sel || 'left') === v ? 'selected' : ''}>${rotulo}</option>`;
        }).join('');

        const blocoTexto = (prefixo, dados, rotulo, tamanhoPadrao) => `
            <div class="panelField panelField--toggle">
                <label>Usar ${rotulo}</label>
                <input type="checkbox" id="ci${prefixo}Show" ${dados.show !== false ? 'checked' : ''}>
            </div>
            <div id="ci${prefixo}Controls" ${dados.show !== false ? '' : 'style="display:none"'}>
                <div class="panelField">
                    <textarea class="input cardTextArea" id="ci${prefixo}Content" rows="${prefixo === 'Title' ? 2 : 3}" placeholder="${rotulo}">${this.escHtml(dados.content || '')}</textarea>
                </div>
                <div class="twoColGrid">
                    <div class="panelField">
                        <label>Tamanho (px)</label>
                        <input type="number" class="input" id="ci${prefixo}Size" value="${dados.font_size || tamanhoPadrao}" min="8" max="80">
                    </div>
                    <div class="panelField">
                        <label>Alinhamento</label>
                        <select class="input" id="ci${prefixo}Align">${alinhamento(dados.align)}</select>
                    </div>
                </div>
                <div class="panelField">
                    <label>Cor</label>
                    <div class="colorRow">
                        <input type="color" class="colorInput" id="ci${prefixo}Color" value="${dados.color || '#222222'}">
                        <input type="text" class="input" id="ci${prefixo}ColorHex" value="${dados.color || ''}" placeholder="#222222">
                    </div>
                </div>
                <div class="panelField panelField--toggle">
                    <label>Negrito</label>
                    <input type="checkbox" id="ci${prefixo}Bold" ${dados.bold ? 'checked' : ''}>
                </div>
                ${prefixo === 'Title' ? `
                <div class="panelField panelField--toggle">
                    <label>MAIÚSCULAS</label>
                    <input type="checkbox" id="ci${prefixo}Upper" ${dados.uppercase ? 'checked' : ''}>
                </div>` : ''}
            </div>`;

        return `
            <div class="panelBody">
                <div class="panelSection">
                    <h4>Card com ícones</h4>

                    <!-- ── Imagem ── -->
                    <div class="panelField panelField--toggle">
                        <label>Usar imagem</label>
                        <input type="checkbox" id="ciImageShow" ${image.show !== false ? 'checked' : ''}>
                    </div>
                    <div id="ciImageControls" ${image.show !== false ? '' : 'style="display:none"'}>
                        <div class="panelField">
                            <input type="file" id="ciImageFile" accept="image/*" style="display:none">
                            <button type="button" class="btn btn--secondary btn--full" id="btnCardIconImagePick">
                                ${image.url ? 'Trocar imagem' : 'Enviar imagem'}
                            </button>
                            ${image.url ? `
                                <div class="bgImagePreview">
                                    <img src="${image.url}" alt="">
                                    <button type="button" class="btn btn--danger btn--sm btn--full" id="btnCardIconImageRemove">Remover imagem</button>
                                </div>` : ''}
                        </div>
                        <div class="panelField">
                            <label>Texto alternativo</label>
                            <input type="text" class="input" id="ciImageAlt" value="${this.escHtml(image.alt || '')}" placeholder="Descrição da imagem">
                        </div>
                        <div class="panelField">
                            <label>Altura da imagem (px)</label>
                            <input type="number" class="input" id="ciImageHeight" value="${image.height || ''}" min="0" placeholder="auto">
                        </div>
                    </div>

                    <div class="panelDivider"></div>

                    <!-- ── Selo de ícone ── -->
                    <div class="panelField panelField--toggle">
                        <label>Usar ícone sobre a imagem</label>
                        <input type="checkbox" id="ciBadgeShow" ${badge.show !== false ? 'checked' : ''}>
                    </div>
                    <div id="ciBadgeControls" ${badge.show !== false ? '' : 'style="display:none"'}>
                        ${this._iconPickerHtml('ciBadgeIcon', badge.icon)}
                        <div class="twoColGrid">
                            <div class="panelField">
                                <label>Tamanho do selo (px)</label>
                                <input type="number" class="input" id="ciBadgeSize" value="${badge.size || 64}" min="20" max="200">
                            </div>
                            <div class="panelField">
                                <label>Tamanho do ícone (px)</label>
                                <input type="number" class="input" id="ciBadgeIconSize" value="${badge.icon_size || 28}" min="10" max="120">
                            </div>
                        </div>
                        <div class="panelField">
                            <label>Cor do ícone</label>
                            <div class="colorRow">
                                <input type="color" class="colorInput" id="ciBadgeColor" value="${badge.color || '#ae272c'}">
                                <input type="text" class="input" id="ciBadgeColorHex" value="${badge.color || ''}" placeholder="#ae272c">
                            </div>
                        </div>
                        <div class="panelField">
                            <label>Cor de fundo do selo</label>
                            <div class="colorRow">
                                <input type="color" class="colorInput" id="ciBadgeBg" value="${badge.bg_color || '#ffffff'}">
                                <input type="text" class="input" id="ciBadgeBgHex" value="${badge.bg_color || ''}" placeholder="#ffffff">
                            </div>
                        </div>
                        <div class="panelField">
                            <label>Posição</label>
                            <select class="input" id="ciBadgePosition">${alinhamento(badge.position)}</select>
                        </div>
                        <div class="twoColGrid">
                            <div class="panelField">
                                <label>Distância do topo (px)</label>
                                <input type="number" class="input" id="ciBadgeOffsetY" value="${badge.offset_y !== undefined ? badge.offset_y : 16}" min="-100" max="300">
                            </div>
                            <div class="panelField">
                                <label>Distância da lateral</label>
                                <input type="number" class="input" id="ciBadgeOffsetX" value="${badge.offset_x !== undefined ? badge.offset_x : 16}" min="-100" max="300">
                            </div>
                        </div>
                        <div class="panelField">
                            <label>Arredondamento do selo (%)</label>
                            <input type="number" class="input" id="ciBadgeRadius" value="${badge.border_radius !== undefined ? badge.border_radius : 50}" min="0" max="50">
                        </div>
                        <div class="panelField panelField--toggle">
                            <label>Sombra no selo</label>
                            <input type="checkbox" id="ciBadgeShadow" ${badge.shadow !== false ? 'checked' : ''}>
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    ${blocoTexto('Title', title, 'título', 18)}

                    <div class="panelDivider"></div>
                    ${blocoTexto('Text', text, 'texto', 15)}

                    <div class="panelDivider"></div>
                    <div class="panelField panelField--toggle">
                        <label>Usar botão</label>
                        <input type="checkbox" id="ciButtonShow" ${button.show !== false ? 'checked' : ''}>
                    </div>
                    <div id="ciButtonControls" ${button.show !== false ? '' : 'style="display:none"'}>
                        ${this._buttonFieldsHtml('ciBtn', button)}
                    </div>

                    <div class="panelDivider"></div>
                    <h4>Aparência do card</h4>
                    <div class="panelField">
                        <label>Cor de fundo</label>
                        <div class="colorRow">
                            <input type="checkbox" id="ciUseBg" ${st.bg_color ? 'checked' : ''} />
                            <input type="color" class="colorInput" id="ciBgColor" value="${st.bg_color || '#ffffff'}" ${st.bg_color ? '' : 'disabled'}>
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Espaço interno do conteúdo (px)</label>
                        <div class="spacingGrid">
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>↑ Cima</label>
                                    <input type="number" class="input" id="ciPadTop" value="${cp.top !== undefined ? cp.top : 24}" min="0"></div>
                                <div class="spacingGrid__field"><label>↓ Baixo</label>
                                    <input type="number" class="input" id="ciPadBottom" value="${cp.bottom !== undefined ? cp.bottom : 24}" min="0"></div>
                            </div>
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>← Esq.</label>
                                    <input type="number" class="input" id="ciPadLeft" value="${cp.left !== undefined ? cp.left : 24}" min="0"></div>
                                <div class="spacingGrid__field"><label>→ Dir.</label>
                                    <input type="number" class="input" id="ciPadRight" value="${cp.right !== undefined ? cp.right : 24}" min="0"></div>
                            </div>
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Borda (px)</label>
                        <div class="borderRow">
                            <input type="number" class="input borderWidth" id="ciBorderWidth" value="${st.border_width || 0}" min="0" max="50">
                            <span class="borderUnit">px</span>
                            <input type="color" class="colorInput" id="ciBorderColor" value="${st.border_color || '#e0e0e0'}" />
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Arredondamento dos cantos (px)</label>
                        <div class="spacingGrid">
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>↖ Sup. Esq.</label>
                                    <input type="number" class="input" id="ciRadiusTL" value="${br.tl || 0}" min="0"></div>
                                <div class="spacingGrid__field"><label>↗ Sup. Dir.</label>
                                    <input type="number" class="input" id="ciRadiusTR" value="${br.tr || 0}" min="0"></div>
                            </div>
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>↙ Inf. Esq.</label>
                                    <input type="number" class="input" id="ciRadiusBL" value="${br.bl || 0}" min="0"></div>
                                <div class="spacingGrid__field"><label>↘ Inf. Dir.</label>
                                    <input type="number" class="input" id="ciRadiusBR" value="${br.br || 0}" min="0"></div>
                            </div>
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Sombra</label>
                        <div class="colorRow">
                            <input type="checkbox" id="ciShadowEnabled" ${sh.enabled ? 'checked' : ''} />
                            <label for="ciShadowEnabled" class="colorRowLabel">Ativar sombra</label>
                        </div>
                    </div>
                    <div id="ciShadowControls" ${sh.enabled ? '' : 'style="display:none"'}>
                        <div class="panelField">
                            <label>Cor da sombra</label>
                            <div class="colorRow">
                                <input type="color" class="colorInput" id="ciShadowColor" value="${sh.color || '#000000'}">
                            </div>
                        </div>
                        <div class="twoColGrid">
                            <div class="panelField">
                                <label>Tamanho (px)</label>
                                <input type="number" class="input" id="ciShadowSize" value="${sh.size !== undefined ? sh.size : 20}" min="0">
                            </div>
                            <div class="panelField">
                                <label>Distância (px)</label>
                                <input type="number" class="input" id="ciShadowDist" value="${sh.distance !== undefined ? sh.distance : 6}" min="0">
                            </div>
                        </div>
                        <div class="twoColGrid">
                            <div class="panelField">
                                <label>Ângulo (°)</label>
                                <input type="number" class="input" id="ciShadowAngle" value="${sh.angle !== undefined ? sh.angle : 0}" min="0" max="360">
                            </div>
                            <div class="panelField">
                                <label>Opacidade (%)</label>
                                <input type="number" class="input" id="ciShadowOp" value="${sh.opacity !== undefined ? sh.opacity : 12}" min="0" max="100">
                            </div>
                        </div>
                    </div>

                    <button class="btn btn--success btn--full" id="btnApplyCardIconStyle">Salvar alterações</button>

                    <div class="panelDivider"></div>
                    <button class="btn btn--danger btn--full" id="btnDeleteElement" data-id="${element.id}">Remover elemento</button>
                    <div class="panelDivider"></div>
                    <button class="btn btn--secondary btn--full btnBack">← Voltar</button>
                </div>
            </div>`;
    },

    _collectCardIconFields() {
        const c = this.state.selected.element.content || {};

        const bloco = (prefixo, atual) => ({
            ...(atual || {}),
            show:      $(`#ci${prefixo}Show`).is(':checked'),
            content:   $(`#ci${prefixo}Content`).val(),
            font_size: Math.min(80, Math.max(8, parseInt($(`#ci${prefixo}Size`).val()) || 15)),
            align:     $(`#ci${prefixo}Align`).val() || 'left',
            color:     this._normalizeColor($(`#ci${prefixo}ColorHex`).val(), $(`#ci${prefixo}Color`).val()),
            bold:      $(`#ci${prefixo}Bold`).is(':checked'),
        });

        const title = bloco('Title', c.title);
        title.uppercase = $('#ciTitleUpper').is(':checked');

        return {
            image: {
                ...(c.image || {}),
                show:   $('#ciImageShow').is(':checked'),
                alt:    $('#ciImageAlt').val().trim(),
                height: parseInt($('#ciImageHeight').val()) || '',
            },
            badge: {
                ...(c.badge || {}),
                show:          $('#ciBadgeShow').is(':checked'),
                icon:          $('#ciBadgeIcon').val().trim(),
                size:          Math.max(20, parseInt($('#ciBadgeSize').val()) || 64),
                icon_size:     Math.max(10, parseInt($('#ciBadgeIconSize').val()) || 28),
                color:         this._normalizeColor($('#ciBadgeColorHex').val(), $('#ciBadgeColor').val()),
                bg_color:      this._normalizeColor($('#ciBadgeBgHex').val(),    $('#ciBadgeBg').val()),
                position:      $('#ciBadgePosition').val() || 'left',
                offset_x:      parseInt($('#ciBadgeOffsetX').val()) || 0,
                offset_y:      parseInt($('#ciBadgeOffsetY').val()) || 0,
                border_radius: Math.min(50, Math.max(0, parseInt($('#ciBadgeRadius').val()) || 0)),
                shadow:        $('#ciBadgeShadow').is(':checked'),
            },
            title,
            text: bloco('Text', c.text),
            button: {
                ...this._collectButtonFields('ciBtn'),
                show: $('#ciButtonShow').is(':checked'),
            },
            card: {
                padding: {
                    top:    parseInt($('#ciPadTop').val())    || 0,
                    right:  parseInt($('#ciPadRight').val())  || 0,
                    bottom: parseInt($('#ciPadBottom').val()) || 0,
                    left:   parseInt($('#ciPadLeft').val())   || 0,
                },
                styles: {
                    bg_color:     $('#ciUseBg').is(':checked') ? $('#ciBgColor').val() : '',
                    border_width: parseInt($('#ciBorderWidth').val()) || 0,
                    border_color: $('#ciBorderColor').val() || '#e0e0e0',
                    border_radius: {
                        tl: parseInt($('#ciRadiusTL').val()) || 0,
                        tr: parseInt($('#ciRadiusTR').val()) || 0,
                        br: parseInt($('#ciRadiusBR').val()) || 0,
                        bl: parseInt($('#ciRadiusBL').val()) || 0,
                    },
                    shadow: {
                        enabled:  $('#ciShadowEnabled').is(':checked'),
                        color:    $('#ciShadowColor').val() || '#000000',
                        size:     parseInt($('#ciShadowSize').val())  || 0,
                        distance: parseInt($('#ciShadowDist').val())  || 0,
                        angle:    parseInt($('#ciShadowAngle').val()) || 0,
                        opacity:  parseInt($('#ciShadowOp').val())    || 0,
                    },
                },
            },
        };
    },

    saveCardIconElementFields() {
        if (!['element', 'grid-element', 'panels-element'].includes(this.state.mode)) return;
        this._persistElementContent(this._collectCardIconFields());
    },

    // Espelha CardiconPlugin::render() do PHP.
    _renderCardIconPreview(c) {
        const image  = c.image  || {};
        const badge  = c.badge  || {};
        const title  = c.title  || {};
        const text   = c.text   || {};
        const button = c.button || {};
        const card   = c.card   || {};

        const temImagem = image.show  !== false && (image.url || '').trim() !== '';
        const temSelo   = badge.show  !== false && (badge.icon || '').trim() !== '';
        const temTitulo = title.show  !== false && (title.content || '').trim() !== '';
        const temTexto  = text.show   !== false && (text.content || '').trim() !== '';
        const temBotao  = button.show !== false && (button.text || '').trim() !== '';

        if (!temImagem && !temSelo && !temTitulo && !temTexto && !temBotao) {
            return '<em class="previewEmpty">Card vazio — configure imagem, ícone, textos ou botão</em>';
        }

        const rootStyle = this._buildInlineStyle(card.styles || {});
        let html = `<div class="plugin-cardicon"${rootStyle ? ` style="${rootStyle}"` : ''}>`;

        if (temImagem || temSelo) {
            html += '<div class="plugin-cardicon__media">';
            if (temImagem) {
                let css = image.height ? `height:${parseInt(image.height)}px;object-fit:cover;` : '';
                css += this._cardIconImageRadius(card, temTitulo || temTexto || temBotao);
                html += `<img class="plugin-cardicon__image" src="${image.url}" alt="${this.escHtml(image.alt || '')}"${css ? ` style="${css}"` : ''}>`;
            }
            if (temSelo) html += this._renderCardIconBadge(badge);
            html += '</div>';
        }

        if (temTitulo || temTexto || temBotao) {
            const p = card.padding || {};
            const pad = (p.top || p.right || p.bottom || p.left)
                ? ` style="padding:${p.top||0}px ${p.right||0}px ${p.bottom||0}px ${p.left||0}px;"`
                : '';
            html += `<div class="plugin-cardicon__body"${pad}>`;
            if (temTitulo) html += `<div class="plugin-cardicon__title" style="${this._cardIconTextStyle(title, 18, true)}">${this.escHtml(title.content).replace(/\n/g, '<br>')}</div>`;
            if (temTexto)  html += `<div class="plugin-cardicon__text" style="${this._cardIconTextStyle(text, 15, false)}">${this.escHtml(text.content).replace(/\n/g, '<br>')}</div>`;
            if (temBotao)  html += this._renderButtonPreview(button);
            html += '</div>';
        }

        return html + '</div>';
    },

    // Espelha CardiconPlugin::imagemRadiusCss(): a imagem herda os cantos de cima do
    // card (os 4, se não houver corpo abaixo), descontando a espessura da borda.
    _cardIconImageRadius(card, temCorpo) {
        const st    = card.styles || {};
        const br    = st.border_radius || {};
        const borda = parseInt(st.border_width) || 0;
        const r     = (v) => Math.max(0, (parseInt(v) || 0) - borda);

        const tl = r(br.tl), tr = r(br.tr);
        const bl = temCorpo ? 0 : r(br.bl);
        const brr = temCorpo ? 0 : r(br.br);

        if (!tl && !tr && !bl && !brr) return '';
        return `border-radius:${tl}px ${tr}px ${brr}px ${bl}px;`;
    },

    _renderCardIconBadge(b) {
        const pos  = ['left', 'center', 'right'].includes(b.position) ? b.position : 'left';
        const tam  = Math.max(20, parseInt(b.size) || 64);
        const raio = b.border_radius !== undefined ? Math.min(50, Math.max(0, parseInt(b.border_radius) || 0)) : 50;

        let css = `width:${tam}px;height:${tam}px;`
                + `background-color:${b.bg_color || '#ffffff'};`
                + `color:${b.color || '#ae272c'};`
                + `font-size:${Math.max(10, parseInt(b.icon_size) || Math.round(tam * 0.45))}px;`
                + `border-radius:${raio}%;`
                + `top:${parseInt(b.offset_y) || 0}px;`;

        if (pos !== 'center') css += `${pos}:${parseInt(b.offset_x) || 0}px;`;
        if (b.shadow) css += 'box-shadow:0 4px 12px rgba(0,0,0,0.18);';

        return `<span class="plugin-cardicon__badge plugin-cardicon__badge--${pos}" style="${css}"><i class="${this.escHtml(b.icon)}"></i></span>`;
    },

    _cardIconTextStyle(t, tamanhoPadrao, negritoPadrao) {
        const align = ['left', 'center', 'right'].includes(t.align) ? t.align : 'left';
        let css = `font-size:${this._fluidFont(Math.max(8, parseInt(t.font_size) || tamanhoPadrao), t.font_size_min)};`
                + `color:${t.color || '#222222'};`
                + `text-align:${align};`;
        const negrito = ('bold' in t) ? !!t.bold : negritoPadrao;
        if (negrito) css += 'font-weight:700;';
        if (t.uppercase) css += 'text-transform:uppercase;';
        return css;
    },

    // Espelha CardiconPlugin::getDefaultConfig() do PHP.
    _cardIconDefaultContent() {
        return {
            image: { show: true, url: '', alt: '', height: 200 },
            badge: { show: true, icon: 'fa-solid fa-flask', position: 'left', size: 64, icon_size: 28,
                     color: '#ae272c', bg_color: '#ffffff', border_radius: 50, offset_x: 16, offset_y: 16, shadow: true },
            title: { show: true, content: 'Título do card', font_size: 18, color: '#111111', align: 'left', bold: true, uppercase: true },
            text:  { show: true, content: 'Uma frase curta explicando do que se trata este card.', font_size: 15, color: '#555555', align: 'left', bold: false },
            button: {
                show: true, text: 'CONHECER CAMPANHA', link_type: 'url', page_id: '', url: '',
                target_blank: false, align: 'left', font_size: 14,
                icon: 'fa-solid fa-arrow-right', icon_position: 'right', icon_gap: 8, icon_size: '',
                padding: { top: 0, right: 0, bottom: 0, left: 0 },
                bg_color: '#ffffff', text_color: '#ae272c',
                hover_bg_color: '#ffffff', hover_text_color: '#8a1f23',
                border_radius: { tl: 0, tr: 0, br: 0, bl: 0 },
            },
            card: {
                padding: { top: 24, right: 24, bottom: 24, left: 24 },
                styles: {
                    bg_color: '#ffffff', border_width: 0, border_color: '#e0e0e0',
                    border_radius: { tl: 10, tr: 10, br: 10, bl: 10 },
                    shadow: { enabled: true, color: '#000000', size: 20, distance: 6, angle: 0, opacity: 12 },
                },
            },
        };
    },

    // ── Ícone (Font Awesome) ──────────────────────────────────
    // A lista de ícones vem de FA_ICONS (admin/pages/editor/fa-icons.js), extraída do
    // CSS oficial do FA 7 Free — só contém ícones que existem no plano gratuito.
    // Seletor de ícones reutilizável. `targetId` é o id do input que recebe a classe
    // escolhida — assim o mesmo componente serve ao plugin Ícone e ao ícone do Botão
    // (só existe um painel aberto por vez, então os ids internos não colidem).
    _iconPickerHtml(targetId, valor) {
        const atual  = valor || '';
        const estilo = atual.includes('fa-brands') ? 'brands' : 'solid';

        return `
            <div class="panelField">
                <div class="iconChosen">
                    <i class="${this.escHtml(atual || 'fa-regular fa-square')}" data-preview-for="${targetId}"></i>
                    <input type="text" class="input iconClassInput" id="${targetId}" data-preview-for="${targetId}"
                           value="${this.escHtml(atual)}" placeholder="fa-solid fa-star">
                </div>
                <p class="panelNote">Escolha na lista abaixo ou digite a classe direto.</p>
            </div>

            <div class="panelField iconPicker" data-target="${targetId}">
                <div class="iconStyleTabs">
                    <button type="button" class="iconStyleTab ${estilo === 'solid' ? 'active' : ''}" data-style="solid">Sólidos</button>
                    <button type="button" class="iconStyleTab ${estilo === 'brands' ? 'active' : ''}" data-style="brands">Marcas</button>
                </div>
                <input type="text" class="input iconSearchInput" id="iconSearch" placeholder="Buscar em português: casa, vaca, telefone...">
                <div class="iconPicker__count" id="iconCount"></div>
                <div class="iconGrid" id="iconGrid"></div>
            </div>`;
    },

    panelIconElement(element) {
        const c        = element.content || {};
        const estilo   = (c.icon || '').includes('fa-brands') ? 'brands' : 'solid';
        const linkType = c.link_type || 'none';
        const pages    = (typeof ALL_PAGES !== 'undefined' && ALL_PAGES) || [];
        const pageOpts = pages.map(p =>
            `<option value="${p.id}" ${parseInt(c.page_id) === p.id ? 'selected' : ''}>${this.escHtml(p.title)} (/${this.escHtml(p.slug)})</option>`
        ).join('');

        return `
            <div class="panelBody">
                <div class="panelSection">
                    <h4>Ícone</h4>

                    ${this._iconPickerHtml('iconClass', c.icon)}

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Texto ao lado (opcional)</label>
                        <input type="text" class="input" id="iconLabel" value="${this.escHtml(c.label || '')}" placeholder="deixe vazio para só o ícone">
                    </div>

                    <div class="twoColGrid">
                        <div class="panelField">
                            <label>Tamanho (px)</label>
                            <input type="number" class="input" id="iconSize" value="${c.size || 32}" min="8" max="200">
                        </div>
                        <div class="panelField">
                            <label>Alinhamento</label>
                            <select class="input" id="iconAlign">
                                <option value="left"   ${(c.align||'left') === 'left'   ? 'selected' : ''}>Esquerda</option>
                                <option value="center" ${c.align === 'center' ? 'selected' : ''}>Centro</option>
                                <option value="right"  ${c.align === 'right'  ? 'selected' : ''}>Direita</option>
                            </select>
                        </div>
                    </div>

                    <div class="panelField">
                        <label>Cor</label>
                        <div class="colorRow">
                            <input type="color" class="colorInput" id="iconColor" value="${c.color || '#333333'}">
                            <input type="text" class="input" id="iconColorHex" value="${c.color || ''}" placeholder="#333333">
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Cor ao passar o mouse</label>
                        <div class="colorRow">
                            <input type="color" class="colorInput" id="iconHoverColor" value="${c.hover_color || '#ae272c'}">
                            <input type="text" class="input" id="iconHoverColorHex" value="${c.hover_color || ''}" placeholder="deixe vazio para não mudar">
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Cor de fundo</label>
                        <div class="colorRow">
                            <input type="checkbox" id="iconUseBg" ${c.bg_color ? 'checked' : ''} />
                            <input type="color" class="colorInput" id="iconBgColor" value="${c.bg_color || '#eeeeee'}" ${c.bg_color ? '' : 'disabled'}>
                        </div>
                    </div>
                    <div class="twoColGrid">
                        <div class="panelField">
                            <label>Espaço interno (px)</label>
                            <input type="number" class="input" id="iconPadding" value="${c.padding || 0}" min="0" max="100">
                        </div>
                        <div class="panelField">
                            <label>Arredondar (px)</label>
                            <input type="number" class="input" id="iconRadius" value="${c.border_radius || 0}" min="0" max="200">
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Borda (px)</label>
                        <div class="borderRow">
                            <input type="number" class="input borderWidth" id="iconBorderWidth" value="${c.border_width || 0}" min="0" max="50">
                            <span class="borderUnit">px</span>
                            <input type="color" class="colorInput" id="iconBorderColor" value="${c.border_color || '#333333'}" />
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Rotação (graus)</label>
                        <input type="number" class="input" id="iconRotate" value="${c.rotate || 0}" min="0" max="360">
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Link</label>
                        <select class="input" id="iconLinkType">
                            <option value="none" ${linkType === 'none' ? 'selected' : ''}>Sem link</option>
                            <option value="page" ${linkType === 'page' ? 'selected' : ''}>Página</option>
                            <option value="url"  ${linkType === 'url'  ? 'selected' : ''}>URL</option>
                        </select>
                    </div>
                    <div class="panelField">
                        <select class="input" id="iconPageSelect" ${linkType === 'page' ? '' : 'style="display:none"'}>
                            <option value="">— Selecione a página —</option>
                            ${pageOpts}
                        </select>
                        <input type="text" class="input" id="iconUrl" value="${this.escHtml(c.url || '')}" placeholder="https://..." ${linkType === 'url' ? '' : 'style="display:none"'}>
                    </div>
                    <div class="panelField panelField--toggle" ${linkType === 'none' ? 'style="display:none"' : ''} id="iconBlankWrap">
                        <label>Abrir em nova aba</label>
                        <input type="checkbox" id="iconTargetBlank" ${c.target_blank ? 'checked' : ''}>
                    </div>

                    <button class="btn btn--success btn--full" id="btnApplyIconStyle">Salvar alterações</button>

                    <div class="panelDivider"></div>
                    <button class="btn btn--danger btn--full" id="btnDeleteElement" data-id="${element.id}">Remover elemento</button>
                    <div class="panelDivider"></div>
                    <button class="btn btn--secondary btn--full btnBack">← Voltar</button>
                </div>
            </div>`;
    },

    // Tira acentos e caixa alta, para "coração" e "CORACAO" caírem na mesma chave
    // do dicionário (que é escrito todo sem acento).
    _normalizarBusca(txt) {
        return (txt || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '');
    },

    // Traduz a busca em português para os termos em inglês dos nomes dos ícones.
    // Devolve sempre o termo digitado também, para quem já busca em inglês.
    _termosDeBusca(busca) {
        const termo  = this._normalizarBusca(busca);
        const alvos  = new Set();
        if (termo) alvos.add(termo);

        const dic = (typeof FA_PT !== 'undefined' && FA_PT) || {};
        if (termo.length >= 2) {
            // A chave exata entra antes das que só começam com o termo — senão buscar
            // "cachorro" traria "hotdog" (de "cachorro-quente") na frente de "dog".
            // O prefixo existe para funcionar enquanto a pessoa digita ("cav" → cavalo);
            // o mínimo de 2 letras evita que "a" puxe o dicionário inteiro.
            if (dic[termo]) dic[termo].forEach(en => alvos.add(en));

            for (const pt in dic) {
                if (pt !== termo && pt.startsWith(termo)) {
                    dic[pt].forEach(en => alvos.add(en));
                }
            }
        }

        return [...alvos];
    },

    // Preenche a grade de ícones. Limitada a 120 resultados porque são ~2600 ícones:
    // renderizar todos de uma vez trava o painel; a busca é que afunila.
    renderIconGrid(estilo, busca) {
        const lista   = (typeof FA_ICONS !== 'undefined' && FA_ICONS[estilo]) || [];
        const prefixo = estilo === 'brands' ? 'fa-brands' : 'fa-solid';
        const termo   = this._normalizarBusca(busca);

        let filtrados;
        if (!termo) {
            filtrados = lista;
        } else {
            const alvos = this._termosDeBusca(termo);
            // Relevância = qual alvo casou (a ordem no dicionário é a preferência: em
            // 'casa': ['house','home'], house ganha de home, que é apelido legado) e
            // como casou (igual > começa com > contém). Sem isso, "casa" mostraria
            // "home" e "house-chimney-window" antes de "house".
            filtrados = lista
                .map(nome => {
                    let peso = 999;
                    alvos.forEach((alvo, ordem) => {
                        if (!nome.includes(alvo)) return;
                        const tipo = nome === alvo ? 0 : nome.startsWith(alvo) ? 1 : 2;
                        // Como casou pesa mais que qual alvo casou: buscar "insta"
                        // deve trazer "instagram" (nome exato do alvo traduzido) antes
                        // de "instalod", que só por acaso começa com as mesmas letras.
                        peso = Math.min(peso, tipo * 100 + ordem);
                    });
                    return { nome, peso };
                })
                .filter(x => x.peso < 999)
                .sort((a, b) => a.peso - b.peso || a.nome.length - b.nome.length)
                .map(x => x.nome);
        }

        const total = filtrados.length;
        filtrados   = filtrados.slice(0, 120);

        if (!filtrados.length) {
            $('#iconGrid').html('<p class="iconGrid__empty">Nenhum ícone encontrado para essa busca.</p>');
            $('#iconCount').text('');
            return;
        }

        $('#iconCount').text(total > 120 ? `mostrando 120 de ${total}` : `${total} ${total === 1 ? 'ícone' : 'ícones'}`);
        $('#iconGrid').html(filtrados.map(nome =>
            `<button type="button" class="iconGrid__item" data-icon="${prefixo} fa-${nome}" title="${nome}">
                <i class="${prefixo} fa-${nome}"></i>
            </button>`
        ).join(''));
    },

    _collectIconFields() {
        return {
            icon:          $('#iconClass').val().trim(),
            label:         $('#iconLabel').val().trim(),
            size:          Math.max(8, parseInt($('#iconSize').val()) || 32),
            align:         $('#iconAlign').val() || 'left',
            color:         this._normalizeColor($('#iconColorHex').val(),      $('#iconColor').val()),
            // Hover vazio = não muda de cor no hover, então aqui o vazio é preservado.
            hover_color:   $('#iconHoverColorHex').val().trim() ? this._normalizeColor($('#iconHoverColorHex').val(), $('#iconHoverColor').val()) : '',
            bg_color:      $('#iconUseBg').is(':checked') ? $('#iconBgColor').val() : '',
            padding:       parseInt($('#iconPadding').val()) || 0,
            border_radius: parseInt($('#iconRadius').val()) || 0,
            border_width:  parseInt($('#iconBorderWidth').val()) || 0,
            border_color:  $('#iconBorderColor').val() || '#333333',
            rotate:        parseInt($('#iconRotate').val()) || 0,
            link_type:     $('#iconLinkType').val() || 'none',
            page_id:       $('#iconPageSelect').val() || '',
            url:           $('#iconUrl').val().trim(),
            target_blank:  $('#iconTargetBlank').is(':checked'),
        };
    },

    saveIconElementFields() {
        if (!['element', 'grid-element', 'panels-element'].includes(this.state.mode)) return;
        this._persistElementContent(this._collectIconFields());
    },

    // Espelha IconPlugin::render() do PHP.
    _renderIconPreview(c) {
        const icone = (c.icon || '').trim();
        if (!icone) return '<em class="previewEmpty">Nenhum ícone escolhido</em>';

        const align = ['left', 'center', 'right'].includes(c.align) ? c.align : 'left';
        const cor   = c.color || '#333333';
        const vars  = `--icon-color:${cor};--icon-hover:${c.hover_color || cor};`;

        let css = `font-size:${Math.max(8, parseInt(c.size) || 32)}px;`;
        if (c.bg_color)      css += `background-color:${c.bg_color};`;
        if (c.padding)       css += `padding:${parseInt(c.padding)}px;`;
        if (c.border_width)  css += `border:${parseInt(c.border_width)}px solid ${c.border_color || '#333333'};`;
        if (c.border_radius) css += `border-radius:${parseInt(c.border_radius)}px;`;
        if (c.rotate)        css += `transform:rotate(${parseInt(c.rotate)}deg);`;

        let inner = `<i class="${this.escHtml(icone)}" style="${css}"></i>`;
        if ((c.label || '').trim()) inner += `<span class="plugin-icon__label">${this.escHtml(c.label)}</span>`;
        if (c.link_type && c.link_type !== 'none') inner = `<a class="plugin-icon__link" href="#">${inner}</a>`;

        return `<div class="plugin-icon plugin-icon--${align}" style="${vars}">${inner}</div>`;
    },

    _iconDefaultContent() {
        return {
            icon: 'fa-solid fa-star', label: '', size: 32, color: '#333333', hover_color: '',
            align: 'left', bg_color: '', padding: 0, border_width: 0, border_color: '#333333',
            border_radius: 0, rotate: 0, link_type: 'none', page_id: '', url: '', target_blank: false,
        };
    },

    // ── Abas / Sanfona (plugins "tabs" e "accordion") ─────────
    // Os dois têm o mesmo content ({items:[{id,title,elements:[]}], settings:{}}) e a
    // mesma navegação no editor, então compartilham painel, preview e persistência —
    // só o plugin_type muda. Modos: 'panels' (visão geral), 'panels-add-element'
    // (escolher plugin) e 'panels-element' (editar elemento aninhado).
    _panelsLabels(pluginType) {
        return pluginType === 'tabs'
            ? { nome: 'Abas',    item: 'Aba',  itens: 'Abas',  addItem: '+ Nova aba' }
            : { nome: 'Sanfona', item: 'Item', itens: 'Itens', addItem: '+ Novo item' };
    },

    panelPanels(data) {
        const { element } = data;
        const c        = element.content || {};
        const items    = c.items || [];
        const s        = c.settings || {};
        const st       = s.styles || {};
        const br       = st.border_radius || {};
        const sh       = st.shadow || {};
        const hp       = s.header_padding  || {};
        const cp       = s.content_padding || {};
        const labels   = this._panelsLabels(element.plugin_type);

        const itemsHtml = items.map((item, i) => {
            const elems = (item.elements || []).map(el => `
                <div class="panelsStructureElement gridStructureElement" data-item-id="${item.id}" data-el-id="${el.id}">
                    <span class="structureElement__badge">${this.escHtml(el.plugin_type)}</span>
                    <span class="structureElement__label">${this._elementPreviewLabel(el)}</span>
                </div>`).join('');

            return `
                <div class="structureCol">
                    <div class="structureCol__header">
                        <span>${labels.item} ${i + 1}</span>
                        <button class="structureCol__gear btnPanelsRemoveItem" data-item-id="${item.id}" title="Remover">✕</button>
                    </div>
                    <div class="panelField panelsItemTitle">
                        <input type="text" class="input panelsTitleInput" data-item-id="${item.id}"
                               value="${this.escHtml(item.title || '')}" placeholder="Título d${labels.item === 'Aba' ? 'a aba' : 'o item'}">
                    </div>
                    ${elems ? `<div class="structureCol__elements">${elems}</div>` : ''}
                    <button class="structureCol__add btnPanelsAddElement" data-item-id="${item.id}">+ Novo elemento</button>
                </div>`;
        }).join('');

        return `
            <div class="panelBody">
                <div class="panelSection">
                    <h4>${labels.nome}</h4>

                    <div class="panelField">
                        <label>${labels.itens} e conteúdo</label>
                        <div class="structureList">${itemsHtml || `<p class="panelHint">Nenhum item ainda.</p>`}</div>
                        <button class="btn btn--secondary btn--full" id="btnPanelsAddItem">${labels.addItem}</button>
                    </div>

                    <div class="panelDivider"></div>
                    <h4>Aparência</h4>

                    <div class="panelField">
                        <label>Tamanho da fonte do título (px)</label>
                        <input type="number" class="input" id="panelsFontSize" value="${s.font_size || 16}" min="10" max="60">
                    </div>
                    <div class="panelField">
                        <label>Espaço entre ${labels.itens.toLowerCase()} (px)</label>
                        <input type="number" class="input" id="panelsGap" value="${s.gap !== undefined ? s.gap : 8}" min="0">
                    </div>

                    <div class="panelField">
                        <label>Cor do título</label>
                        <div class="colorRow">
                            <input type="color" class="colorInput" id="panelsTitleColor" value="${s.title_color || '#333333'}">
                            <input type="text" class="input" id="panelsTitleColorHex" value="${s.title_color || ''}" placeholder="#333333">
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Fundo do título</label>
                        <div class="colorRow">
                            <input type="color" class="colorInput" id="panelsTitleBg" value="${s.title_bg || '#f2f2f2'}">
                            <input type="text" class="input" id="panelsTitleBgHex" value="${s.title_bg || ''}" placeholder="#f2f2f2">
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Cor do título (ativo)</label>
                        <div class="colorRow">
                            <input type="color" class="colorInput" id="panelsActiveColor" value="${s.active_color || '#ffffff'}">
                            <input type="text" class="input" id="panelsActiveColorHex" value="${s.active_color || ''}" placeholder="#ffffff">
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Fundo do título (ativo)</label>
                        <div class="colorRow">
                            <input type="color" class="colorInput" id="panelsActiveBg" value="${s.active_bg || '#ae272c'}">
                            <input type="text" class="input" id="panelsActiveBgHex" value="${s.active_bg || ''}" placeholder="#ae272c">
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Cor da linha divisória</label>
                        <div class="colorRow">
                            <input type="color" class="colorInput" id="panelsDividerColor" value="${s.divider_color || '#e0e0e0'}">
                            <input type="text" class="input" id="panelsDividerColorHex" value="${s.divider_color || ''}" placeholder="#e0e0e0">
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Espaço interno do título (px)</label>
                        <div class="spacingGrid">
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>↑ Cima</label>
                                    <input type="number" class="input" id="panelsHeadPadTop" value="${hp.top !== undefined ? hp.top : 12}" min="0"></div>
                                <div class="spacingGrid__field"><label>↓ Baixo</label>
                                    <input type="number" class="input" id="panelsHeadPadBottom" value="${hp.bottom !== undefined ? hp.bottom : 12}" min="0"></div>
                            </div>
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>← Esq.</label>
                                    <input type="number" class="input" id="panelsHeadPadLeft" value="${hp.left !== undefined ? hp.left : 20}" min="0"></div>
                                <div class="spacingGrid__field"><label>→ Dir.</label>
                                    <input type="number" class="input" id="panelsHeadPadRight" value="${hp.right !== undefined ? hp.right : 20}" min="0"></div>
                            </div>
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Espaço interno do conteúdo (px)</label>
                        <div class="spacingGrid">
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>↑ Cima</label>
                                    <input type="number" class="input" id="panelsContPadTop" value="${cp.top !== undefined ? cp.top : 20}" min="0"></div>
                                <div class="spacingGrid__field"><label>↓ Baixo</label>
                                    <input type="number" class="input" id="panelsContPadBottom" value="${cp.bottom !== undefined ? cp.bottom : 20}" min="0"></div>
                            </div>
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>← Esq.</label>
                                    <input type="number" class="input" id="panelsContPadLeft" value="${cp.left !== undefined ? cp.left : 20}" min="0"></div>
                                <div class="spacingGrid__field"><label>→ Dir.</label>
                                    <input type="number" class="input" id="panelsContPadRight" value="${cp.right !== undefined ? cp.right : 20}" min="0"></div>
                            </div>
                        </div>
                    </div>

                    <div class="panelDivider"></div>
                    <div class="panelField">
                        <label>Cor de fundo da caixa</label>
                        <div class="colorRow">
                            <input type="checkbox" id="panelsUseBg" ${st.bg_color ? 'checked' : ''} />
                            <input type="color" class="colorInput" id="panelsBgColor" value="${st.bg_color || '#ffffff'}" ${st.bg_color ? '' : 'disabled'}>
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Borda (px)</label>
                        <div class="borderRow">
                            <input type="number" class="input borderWidth" id="panelsBorderWidth" value="${st.border_width || 0}" min="0" max="50">
                            <span class="borderUnit">px</span>
                            <input type="color" class="colorInput" id="panelsBorderColor" value="${st.border_color || '#e0e0e0'}" />
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Arredondamento dos cantos (px)</label>
                        <div class="spacingGrid">
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>↖ Sup. Esq.</label>
                                    <input type="number" class="input" id="panelsRadiusTL" value="${br.tl || 0}" min="0"></div>
                                <div class="spacingGrid__field"><label>↗ Sup. Dir.</label>
                                    <input type="number" class="input" id="panelsRadiusTR" value="${br.tr || 0}" min="0"></div>
                            </div>
                            <div class="spacingGrid__row">
                                <div class="spacingGrid__field"><label>↙ Inf. Esq.</label>
                                    <input type="number" class="input" id="panelsRadiusBL" value="${br.bl || 0}" min="0"></div>
                                <div class="spacingGrid__field"><label>↘ Inf. Dir.</label>
                                    <input type="number" class="input" id="panelsRadiusBR" value="${br.br || 0}" min="0"></div>
                            </div>
                        </div>
                    </div>
                    <div class="panelField">
                        <label>Sombra</label>
                        <div class="colorRow">
                            <input type="checkbox" id="panelsShadowEnabled" ${sh.enabled ? 'checked' : ''} />
                            <label for="panelsShadowEnabled" class="colorRowLabel">Ativar sombra</label>
                        </div>
                    </div>
                    <div id="panelsShadowControls" ${sh.enabled ? '' : 'style="display:none"'}>
                        <div class="panelField">
                            <label>Cor da sombra</label>
                            <div class="colorRow">
                                <input type="color" class="colorInput" id="panelsShadowColor" value="${sh.color || '#000000'}">
                            </div>
                        </div>
                        <div class="twoColGrid">
                            <div class="panelField">
                                <label>Tamanho (px)</label>
                                <input type="number" class="input" id="panelsShadowSize" value="${sh.size || 0}" min="0">
                            </div>
                            <div class="panelField">
                                <label>Distância (px)</label>
                                <input type="number" class="input" id="panelsShadowDist" value="${sh.distance || 0}" min="0">
                            </div>
                        </div>
                        <div class="twoColGrid">
                            <div class="panelField">
                                <label>Ângulo (°)</label>
                                <input type="number" class="input" id="panelsShadowAngle" value="${sh.angle !== undefined ? sh.angle : 0}" min="0" max="360">
                            </div>
                            <div class="panelField">
                                <label>Opacidade (%)</label>
                                <input type="number" class="input" id="panelsShadowOp" value="${sh.opacity !== undefined ? sh.opacity : 30}" min="0" max="100">
                            </div>
                        </div>
                    </div>

                    <button class="btn btn--success btn--full" id="btnApplyPanelsStyle">Salvar alterações</button>

                    <div class="panelDivider"></div>
                    <button class="btn btn--danger btn--full" id="btnDeleteElement" data-id="${element.id}">Remover ${labels.nome.toLowerCase()}</button>
                    <div class="panelDivider"></div>
                    <button class="btn btn--secondary btn--full btnBack">← Voltar</button>
                </div>
            </div>`;
    },

    panelPanelsAddElement(data) {
        const labels = this._panelsLabels(data.containerElement.plugin_type);
        return `
            <div class="panelBody">
                <div class="panelSection">
                    <h4>Adicionar elemento</h4>
                    <p class="panelHint">Escolha o tipo de conteúdo para est${labels.item === 'Aba' ? 'a aba' : 'e item'}:</p>
                    <div class="pluginList">${this._pluginButtons(0)}</div>
                    <div class="panelDivider"></div>
                    <button class="btn btn--secondary btn--full btnBack">← Voltar</button>
                </div>
            </div>`;
    },

    // Lê os campos de aparência do painel (puro, sem escrever no DOM — ver livePreview).
    _collectPanelsSettings() {
        const { containerElement, element } = this.state.selected;
        const target = containerElement || element;
        const s      = (target.content && target.content.settings) || {};

        return {
            ...s,
            font_size:     Math.max(10, parseInt($('#panelsFontSize').val()) || 16),
            gap:           parseInt($('#panelsGap').val()) || 0,
            title_color:   this._normalizeColor($('#panelsTitleColorHex').val(),   $('#panelsTitleColor').val()),
            title_bg:      this._normalizeColor($('#panelsTitleBgHex').val(),      $('#panelsTitleBg').val()),
            active_color:  this._normalizeColor($('#panelsActiveColorHex').val(),  $('#panelsActiveColor').val()),
            active_bg:     this._normalizeColor($('#panelsActiveBgHex').val(),     $('#panelsActiveBg').val()),
            divider_color: this._normalizeColor($('#panelsDividerColorHex').val(), $('#panelsDividerColor').val()),
            header_padding: {
                top:    parseInt($('#panelsHeadPadTop').val())    || 0,
                right:  parseInt($('#panelsHeadPadRight').val())  || 0,
                bottom: parseInt($('#panelsHeadPadBottom').val()) || 0,
                left:   parseInt($('#panelsHeadPadLeft').val())   || 0,
            },
            content_padding: {
                top:    parseInt($('#panelsContPadTop').val())    || 0,
                right:  parseInt($('#panelsContPadRight').val())  || 0,
                bottom: parseInt($('#panelsContPadBottom').val()) || 0,
                left:   parseInt($('#panelsContPadLeft').val())   || 0,
            },
            styles: {
                bg_color:     $('#panelsUseBg').is(':checked') ? $('#panelsBgColor').val() : '',
                border_width: parseInt($('#panelsBorderWidth').val()) || 0,
                border_color: $('#panelsBorderColor').val() || '#e0e0e0',
                border_radius: {
                    tl: parseInt($('#panelsRadiusTL').val()) || 0,
                    tr: parseInt($('#panelsRadiusTR').val()) || 0,
                    br: parseInt($('#panelsRadiusBR').val()) || 0,
                    bl: parseInt($('#panelsRadiusBL').val()) || 0,
                },
                shadow: {
                    enabled:  $('#panelsShadowEnabled').is(':checked'),
                    color:    $('#panelsShadowColor').val() || '#000000',
                    size:     parseInt($('#panelsShadowSize').val())  || 0,
                    distance: parseInt($('#panelsShadowDist').val())  || 0,
                    angle:    parseInt($('#panelsShadowAngle').val()) || 0,
                    opacity:  parseInt($('#panelsShadowOp').val())    || 0,
                },
            },
        };
    },

    // Títulos são lidos do DOM junto, senão renomear uma aba e clicar em salvar
    // perderia o texto digitado.
    _syncPanelsTitlesFromDom(items) {
        return items.map(item => {
            const input = $(`.panelsTitleInput[data-item-id="${item.id}"]`);
            return input.length ? { ...item, title: input.val() } : item;
        });
    },

    savePanelsFields() {
        if (this.state.mode !== 'panels') return;
        const { element } = this.state.selected;
        element.content = {
            ...element.content,
            items:    this._syncPanelsTitlesFromDom(element.content.items || []),
            settings: this._collectPanelsSettings(),
        };
        this.savePanelsContent(element);
        this.renderPanel();
    },

    // Mesmo raciocínio do saveGridContent: quem vai pro banco é sempre a raiz.
    savePanelsContent(containerElement) {
        this.saveElementDirect(this._rootFor(containerElement));
    },

    addPanelsItem() {
        if (this.state.mode !== 'panels') return;
        const { element } = this.state.selected;
        const items = element.content.items || [];
        const labels = this._panelsLabels(element.plugin_type);
        items.push({ id: this._genLocalId(), title: `${labels.item} ${items.length + 1}`, elements: [] });
        element.content = { ...element.content, items };
        this.savePanelsContent(element);
        this.renderPanel();
    },

    removePanelsItem(itemId) {
        if (this.state.mode !== 'panels') return;
        const { element } = this.state.selected;
        element.content = {
            ...element.content,
            items: (element.content.items || []).filter(i => i.id !== itemId),
        };
        this.savePanelsContent(element);
        this.renderPanel();
    },

    addPanelsElement(pluginType) {
        if (this.state.mode !== 'panels-add-element') return;
        const { containerElement, item } = this.state.selected;
        const element = { id: this._genLocalId(), plugin_type: pluginType, content: this._defaultContentFor(pluginType) };
        item.elements = item.elements || [];
        item.elements.push(element);

        this.state = { mode: 'panels-element', selected: this._withRoot({ containerElement, item, element }), selectedCols: 1 };
        this.savePanelsContent(containerElement);

        this._abrirSeContainer(element);
        this.renderPanel();
    },

    deletePanelsElement() {
        if (this.state.mode !== 'panels-element') return;
        const { containerElement, item, element, rootElement: raiz } = this.state.selected;
        item.elements = (item.elements || []).filter(e => e.id !== element.id);
        this.state = { mode: 'panels', selected: { element: containerElement, column: null, rootElement: raiz }, selectedCols: 1 };
        this.savePanelsContent(containerElement);
        this.renderPanel();
    },

    // ── Preview de Abas/Sanfona no canvas ─────────────────────
    // No editor a Sanfona sai com todos os itens abertos e as Abas mostram a aba
    // selecionada (clicar no título troca só a visualização, sem abrir o painel do
    // elemento) — assim dá pra ver e clicar nos elementos de dentro de qualquer item.
    renderPanelsElement(element) {
        const c     = element.content || {};
        const items = c.items || [];
        const s     = c.settings || {};

        if (!items.length) {
            return `<em class="previewEmpty">${element.plugin_type === 'tabs' ? 'Nenhuma aba criada' : 'Nenhum item criado'}</em>`;
        }

        const rootStyle = this._buildInlineStyle(s.styles || {}) + this._buildPanelsCssVars(s);
        const headPad   = this._panelsPaddingCss(s.header_padding,  { top: 12, right: 20, bottom: 12, left: 20 });
        const contPad   = this._panelsPaddingCss(s.content_padding, { top: 20, right: 20, bottom: 20, left: 20 });
        const activeIdx = Math.min(this._panelsPreviewIndex(element.id), items.length - 1);

        const title = (item, i) => this.escHtml((item.title || '').trim() || `Item ${i + 1}`);
        const inner = (item) => (item.elements || [])
            .map(el => this.renderPanelsLeafElement(el, element.id, item.id))
            .join('');

        if (element.plugin_type === 'tabs') {
            const nav = items.map((item, i) =>
                `<button type="button" class="plugin-tabs__tab${i === activeIdx ? ' is-active' : ''}" data-preview-tab="${i}" data-panels-id="${element.id}" style="${headPad}">${title(item, i)}</button>`
            ).join('');
            const panels = items.map((item, i) =>
                `<div class="plugin-tabs__panel${i === activeIdx ? ' is-active' : ''}" style="${contPad}">${inner(item)}</div>`
            ).join('');
            return `<div class="plugin-tabs" style="${rootStyle}">
                <div class="plugin-tabs__nav">${nav}</div>
                <div class="plugin-tabs__panels">${panels}</div>
            </div>`;
        }

        const itemsHtml = items.map((item, i) => `
            <div class="plugin-accordion__item is-open">
                <button type="button" class="plugin-accordion__header" style="${headPad}">
                    <span class="plugin-accordion__title">${title(item, i)}</span>
                    <span class="plugin-accordion__icon"></span>
                </button>
                <div class="plugin-accordion__body">
                    <div class="plugin-accordion__content" style="${contPad}">${inner(item)}</div>
                </div>
            </div>`).join('');

        return `<div class="plugin-accordion" style="${rootStyle}">${itemsHtml}</div>`;
    },

    renderPanelsLeafElement(element, containerId, itemId) {
        return `
            <div class="editorPanelsElement" data-panels-id="${containerId}" data-item-id="${itemId}" data-el-id="${element.id}" data-plugin="${element.plugin_type}">
                <div class="previewElement">${this._renderNestedPreviewHtml(element)}</div>
            </div>`;
    },

    // Um elemento aninhado pode ser um container também — aí o preview dele é o do
    // próprio container, e não o de um plugin simples.
    _renderNestedPreviewHtml(element) {
        if (element.plugin_type === 'flutuante') return this._renderFlutuantePreview(element);
        if (element.plugin_type === 'grid') return this.renderGridElement(element);
        if (['tabs', 'accordion'].includes(element.plugin_type)) return this.renderPanelsElement(element);
        return this._renderLeafPreviewHtml(element);
    },

    // Qual aba está sendo visualizada no preview de cada elemento tabs (só visual,
    // não é salvo no banco).
    _panelsPreview: {},

    _panelsPreviewIndex(elementId) {
        return this._panelsPreview[elementId] || 0;
    },

    // Espelha PanelsPluginBase::buildCssVars() do PHP.
    _buildPanelsCssVars(s) {
        const vars = {
            '--panels-title-color':  s.title_color   || '#333333',
            '--panels-title-bg':     s.title_bg      || '#f2f2f2',
            '--panels-active-color': s.active_color  || '#ffffff',
            '--panels-active-bg':    s.active_bg     || '#ae272c',
            '--panels-font-size':    this._fluidFont(Math.max(10, parseInt(s.font_size) || 16)),
            '--panels-gap':          `${s.gap !== undefined ? parseInt(s.gap) || 0 : 8}px`,
            '--panels-divider':      s.divider_color || '#e0e0e0',
        };
        let css = '';
        for (const k in vars) css += `${k}:${vars[k]};`;
        return css;
    },

    _panelsPaddingCss(p, fallback) {
        const v = p || fallback;
        return `padding:${v.top || 0}px ${v.right || 0}px ${v.bottom || 0}px ${v.left || 0}px;`;
    },

    _panelsDefaultContent(pluginType) {
        const labels = this._panelsLabels(pluginType);
        return {
            items: [
                { id: this._genLocalId(), title: `${labels.item} 1`, elements: [] },
                { id: this._genLocalId(), title: `${labels.item} 2`, elements: [] },
            ],
            settings: {
                title_color: '#333333', title_bg: '#f2f2f2',
                active_color: '#ffffff', active_bg: '#ae272c',
                divider_color: '#e0e0e0', font_size: 16, gap: 8,
                header_padding:  { top: 12, right: 20, bottom: 12, left: 20 },
                content_padding: { top: 20, right: 20, bottom: 20, left: 20 },
                styles: {
                    bg_color: '#ffffff', border_width: 1, border_color: '#e0e0e0',
                    border_radius: { tl: 6, tr: 6, br: 6, bl: 6 },
                    shadow: { enabled: false, color: '#000000', size: 0, distance: 0, angle: 0, opacity: 30 },
                },
            },
        };
    },

    // ── Preview ao vivo ───────────────────────────────────────
    // Qualquer mexida num campo do painel reflete na hora no preview ao lado.
    // NÃO grava no banco: a persistência continua no botão verde "Salvar alterações"
    // (o preview ao vivo é só visual, o que preserva o controle explícito de quando
    // a alteração de fato vale).
    _collectContentForMode() {
        const { element } = this.state.selected || {};
        if (!element) return null;

        switch (element.plugin_type) {
            case 'text':   return this._collectTextFields();
            case 'image':  return this._collectImageFields();
            case 'slider': return this._collectSliderFields();
            case 'menu':   return this._collectMenuFields();
            case 'button': return this._collectButtonFields('btn');
            case 'card':   return this._collectCardFields();
            case 'icon':     return this._collectIconFields();
            case 'cardicon': return this._collectCardIconFields();
            case 'testimonials': return this._collectTestimonialsFields();
            case 'calculadora':  return this._collectCalculadoraFields();
            default:       return null;
        }
    },

    livePreview() {
        if (this.state.mode === 'panels') {
            const { element } = this.state.selected;
            element.content = element.plugin_type === 'flutuante'
                ? this._collectFlutuanteFields()
                : { ...element.content, settings: this._collectPanelsSettings() };
            this.renderPreview();
            return;
        }
        if (!['element', 'grid-element', 'panels-element'].includes(this.state.mode)) return;

        let content;
        try {
            content = this._collectContentForMode();
        } catch (e) {
            return; // painel em transição: ignora e espera a próxima mexida
        }
        if (!content) return;

        this.state.selected.element.content = content;
        this.renderPreview();
    },

    // ── Events ────────────────────────────────────────────────
    // Debounce do preview ao vivo: sem isso o canvas inteiro seria redesenhado a cada
    // tecla digitada (e o Slick dos sliders destruído/reinicializado junto).
    _liveTimer: null,

    livePreviewDebounced() {
        clearTimeout(this._liveTimer);
        this._liveTimer = setTimeout(() => this.livePreview(), 180);
    },

    bindEvents() {
        const E = this;

        // Preview ao vivo: qualquer campo do painel de elemento reflete no preview
        // imediatamente (sem gravar). Fica antes dos demais handlers de propósito —
        // os toggles que mostram/escondem campos rodam depois e não conflitam.
        $(document).on('input change', '#editorPanel input, #editorPanel select, #editorPanel textarea', function () {
            E.livePreviewDebounced();
        });

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

        // Abrir um elemento de topo começa um novo caminho de navegação.
        // Structure tree: element click (open editor)
        $(document).on('click', '.structureElement', function (e) {
            if ($(e.target).closest('.structureElement__order').length) return;
            e.stopPropagation();
            const id   = parseInt($(this).data('element-id'));
            const data = E.findElement(id);
            if (data) E._abrirElementoDeTopo(data);
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
            if (data) E._abrirElementoDeTopo(data);
        });

        // Grid: open nested element for editing (canvas click)
        $(document).on('click', '.editorGridElement', function (e) {
            if ($(e.target).closest('.slick-arrow, .slick-dots').length) return;
            e.stopPropagation();
            const achado = E._findAnyElement(parseInt($(this).data('grid-id')));
            if (!achado) return;
            const gridElement = achado.element;
            const column      = (gridElement.content.columns || []).find(c => c.id === parseInt($(this).data('grid-col-id')));
            const elId        = parseInt($(this).data('grid-el-id'));
            const element     = column && (column.elements || []).find(el => el.id === elId);
            if (column && element) {
                E._abrirElementoAninhado({ gridElement, column, element }, achado.root);
            }
        });

        // Grid: click empty grid column to add element (canvas click)
        $(document).on('click', '.editorGridColumn', function (e) {
            if ($(e.target).closest('.editorGridElement').length) return;
            const achado = E._findAnyElement(parseInt($(this).data('grid-id')));
            if (!achado) return;
            const gridElement = achado.element;
            const column      = (gridElement.content.columns || []).find(c => c.id === parseInt($(this).data('grid-col-id')));
            if (column) {
                E._stack.push(E.state);
                E.state = { mode: 'grid-add-element', selected: { gridElement, column, rootElement: achado.root }, selectedCols: 1 };
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
            if (column && element) E._abrirElementoAninhado({ gridElement, column, element });
        });

        // Grid: "+ Novo elemento" button for a specific grid column
        $(document).on('click', '.btnGridAddElement', function (e) {
            e.stopPropagation();
            if (E.state.mode !== 'grid') return;
            const { element: gridElement } = E.state.selected;
            const colId  = parseInt($(this).data('grid-col-id'));
            const column = (gridElement.content.columns || []).find(c => c.id === colId);
            if (column) E._descend({ gridElement, column }, 'grid-add-element');
        });

        // Grid: open column settings (border, radius, background)
        $(document).on('click', '.btnGridColumnSettings', function (e) {
            e.stopPropagation();
            if (E.state.mode !== 'grid') return;
            const { element: gridElement } = E.state.selected;
            const colId  = parseInt($(this).data('grid-col-id'));
            const column = (gridElement.content.columns || []).find(c => c.id === colId);
            if (column) E._descend({ gridElement, column }, 'grid-column-settings');
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

        // ── Grid: larguras avançadas ──────────────────────────────
        $(document).on('click', '.gridPreset', function () {
            const sizes = String($(this).data('sizes')).split('-').map(Number);
            E.aplicarPresetGrid(sizes);
        });

        // Mudar um select já reflete no preview e atualiza o aviso da soma; a gravação
        // continua no botão verde, como nos demais painéis.
        $(document).on('change', '.gridWidthSelect', function () {
            let total = 0;
            $('.gridWidthSelect').each(function () { total += parseInt($(this).val()) || 0; });
            $('#gridWidthTotal')
                .text(E._textoTotalGrid(total))
                .toggleClass('is-ok', total === 12)
                .toggleClass('is-warn', total !== 12);
            E._aplicarLargurasGrid(false);
        });

        $(document).on('click', '#btnApplyGridWidths', () => E._aplicarLargurasGrid(true));

        $(document).on('change', '#gridResponsiveEnabled', function () {
            $('#gridResponsiveControls').toggle(this.checked);
            E._aplicarLargurasGrid(false);
        });

        $(document).on('change', '#gridResponsiveBreakpoint, .gridResponsiveWidthSelect', function () {
            E._aplicarLargurasGrid(false);
        });

        $(document).on('change', '.gridResponsiveHideInput', function () {
            const $row = $(this).closest('.gridResponsiveWidthRow');
            $row.toggleClass('is-hidden', this.checked);
            $row.find('.gridResponsiveWidthSelect').prop('disabled', this.checked);
            E._aplicarLargurasGrid(false);
        });

        $(document).on('click', '#btnApplyGridResponsive', () => E._aplicarLargurasGrid(true));

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
            if (E.state.mode === 'panels-add-element') {
                E.addPanelsElement(plugin);
                return;
            }
            const columnId = parseInt($(this).data('column-id'));
            E.addElement(columnId, plugin);
        });

        // Delete element
        $(document).on('click', '#btnDeleteElement', function () {
            if (E.state.mode === 'panels-element') {
                if (confirm('Remover este elemento?')) E.deletePanelsElement();
                return;
            }
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
            if (!file || !['element', 'grid-element', 'panels-element'].includes(E.state.mode)) return;
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
            if (!['element', 'grid-element', 'panels-element'].includes(E.state.mode)) return;
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
            if (!file || !['element', 'grid-element', 'panels-element'].includes(E.state.mode)) return;
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
            if (!['element', 'grid-element', 'panels-element'].includes(E.state.mode)) return;
            const { element } = E.state.selected;
            const imgId = parseInt($(this).data('image-id'));
            element.content.images = E._syncSliderImagesFromDom(element.content.images || []).filter(img => img.id !== imgId);
            E.renderPanel();
            E.renderPreview();
        });

        $(document).on('click', '.btnSliderImgUp, .btnSliderImgDown', function () {
            if (!['element', 'grid-element', 'panels-element'].includes(E.state.mode)) return;
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
            if (!['element', 'grid-element', 'panels-element'].includes(E.state.mode)) return;
            const { element } = E.state.selected;
            const content = element.content || {};
            content.items = E._syncMenuItemsFromDom(content.items || []);
            content.items.push({ id: E._genLocalId(), label: '', link_type: 'url', page_id: '', url: '', target_blank: false, submenu: 'none', mega_columns: 3, children: [] });
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

        // Submenu: trocar o tipo mostra/esconde os subitens e as colunas do mega.
        $(document).on('change', '.menuItemSubmenu', function () {
            const row  = $(this).closest('.menuItemRow');
            const tipo = $(this).val();
            row.find('.menuChildList').toggle(tipo !== 'none');
            row.find('.menuItemMegaCols').toggle(tipo === 'mega');
        });

        $(document).on('change', '.menuChildLinkType', function () {
            const linha  = $(this).closest('.menuChildRow');
            const isPage = $(this).val() === 'page';
            linha.find('.menuChildPageSelect').toggle(isPage);
            linha.find('.menuChildUrl').toggle(!isPage);
        });

        $(document).on('click', '.btnMenuAddChild', function () {
            if (!['element', 'grid-element', 'panels-element'].includes(E.state.mode)) return;
            const { element } = E.state.selected;
            const itemId = parseInt($(this).data('item-id'));
            const items  = E._syncMenuItemsFromDom(element.content.items || []);
            const item   = items.find(i => i.id === itemId);
            if (!item) return;

            item.children = item.children || [];
            item.children.push({ id: E._genLocalId(), label: '', link_type: 'url', page_id: '', url: '', target_blank: false });
            // Criar um subitem já liga o submenu, senão ele ficaria escondido.
            if (!item.submenu || item.submenu === 'none') item.submenu = 'dropdown';

            element.content.items = items;
            E.renderPanel();
            E.renderPreview();
        });

        $(document).on('click', '.btnMenuChildRemove', function () {
            if (!['element', 'grid-element', 'panels-element'].includes(E.state.mode)) return;
            const { element } = E.state.selected;
            const itemId  = parseInt($(this).data('item-id'));
            const childId = parseInt($(this).data('child-id'));
            const items   = E._syncMenuItemsFromDom(element.content.items || []);
            const item    = items.find(i => i.id === itemId);
            if (item) item.children = (item.children || []).filter(f => f.id !== childId);

            element.content.items = items;
            E.renderPanel();
            E.renderPreview();
        });

        $(document).on('change', '#menuSubUseHoverBg', function () {
            $('#menuSubHoverBg').prop('disabled', !this.checked);
        });

        $(document).on('click', '.btnMenuItemRemove', function () {
            if (!['element', 'grid-element', 'panels-element'].includes(E.state.mode)) return;
            const { element } = E.state.selected;
            const itemId = parseInt($(this).data('item-id'));
            element.content.items = E._syncMenuItemsFromDom(element.content.items || []).filter(i => i.id !== itemId);
            E.renderPanel();
            E.renderPreview();
        });

        $(document).on('click', '.btnMenuItemUp, .btnMenuItemDown', function () {
            if (!['element', 'grid-element', 'panels-element'].includes(E.state.mode)) return;
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
        // (a sincronia cor ↔ hex destes campos é feita pelo handler genérico de .colorInput)

        // Slider: color picker ↔ hex input sync
        $(document).on('input change', '#sliderAccentColor', function () { $('#sliderAccentColorHex').val($(this).val()); });

        // Slider: bg color toggle (visual only)
        $(document).on('change', '#sliderUseBg', function () {
            $('#sliderBgColor').prop('disabled', !this.checked);
        });

        $(document).on('click', '#btnApplyMenuStyle', () => E.saveMenuElementFields());

        // Permite abrir e fechar o menu em tela inteira dentro do próprio preview.
        $(document).on('click', '#editorCanvas .plugin-menu__burger', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const $menu = $(this).closest('.plugin-menu');
            $menu.toggleClass('plugin-menu--open');
            $('body').toggleClass(
                'plugin-menu-fullscreen-open',
                $('#editorCanvas .plugin-menu--mobile-fullscreen.plugin-menu--open').length > 0
            );
        });

        // Campos de botão (elemento Botão e botão do Card): os toggles são por classe +
        // data-prefix, então valem para os dois painéis sem duplicar handler.
        $(document).on('change', '.jsBtnLinkType', function () {
            const prefix = $(this).data('prefix');
            const isPage = $(this).val() === 'page';
            $('#' + prefix + 'PageSelect').toggle(isPage);
            $('#' + prefix + 'UrlInput').toggle(!isPage);
        });

        $(document).on('change', '.jsBtnShadowToggle', function () {
            $('#' + $(this).data('prefix') + 'ShadowControls').toggle(this.checked);
        });

        // Color pickers ↔ hex inputs: qualquer .colorInput cujo id termine em X e que
        // tenha um #XHex ao lado sincroniza sozinho (vale para btn e cardBtn).
        $(document).on('input change', '.colorInput', function () {
            const hex = $('#' + this.id + 'Hex');
            if (hex.length) hex.val($(this).val());
        });

        $(document).on('click', '#btnApplyButtonStyle', () => E.saveButtonElementFields());

        // ── Card element ──────────────────────────────────────────
        // Toggles de "usar imagem/texto/botão": só mostram/escondem os campos.
        // A gravação continua no botão verde "Salvar alterações", como nos demais.
        $(document).on('change', '#cardShowImage',  function () { $('#cardImageControls').toggle(this.checked); });
        $(document).on('change', '#cardShowText',   function () { $('#cardTextControls').toggle(this.checked); });
        $(document).on('change', '#cardShowButton', function () { $('#cardButtonControls').toggle(this.checked); });


        $(document).on('change', '#cardUseBg', function () {
            $('#cardBgColor').prop('disabled', !this.checked);
        });

        $(document).on('change', '#cardShadowEnabled', function () {
            $('#cardShadowControls').toggle(this.checked);
        });

        // Upload da imagem do card — mesmo endpoint genérico dos demais elementos.
        $(document).on('click', '#btnCardImagePick', () => $('#cardImageFile').trigger('click'));

        $(document).on('change', '#cardImageFile', function () {
            const file = this.files[0];
            if (!file || !['element', 'grid-element', 'panels-element'].includes(E.state.mode)) return;
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
                    const c = element.content || {};
                    element.content = { ...c, image: { ...(c.image || {}), url: res.url } };
                    E.renderPanel();
                    E.renderPreview();
                } else { alert(res.message); }
            }).fail(() => alert('Erro ao enviar imagem.'));
        });

        $(document).on('click', '#btnCardImageRemove', function () {
            if (!['element', 'grid-element', 'panels-element'].includes(E.state.mode)) return;
            const { element } = E.state.selected;
            const c = element.content || {};
            element.content = { ...c, image: { ...(c.image || {}), url: '' } };
            E.renderPanel();
            E.renderPreview();
        });

        $(document).on('click', '#btnApplyCardStyle', () => E.saveCardElementFields());

        // ── Ícone ─────────────────────────────────────────────────
        $(document).on('click', '.iconStyleTab', function () {
            $('.iconStyleTab').removeClass('active');
            $(this).addClass('active');
            E.renderIconGrid($(this).data('style'), $('#iconSearch').val());
        });

        $(document).on('input', '#iconSearch', function () {
            E.renderIconGrid($('.iconStyleTab.active').data('style') || 'solid', $(this).val());
        });

        // Escolher na grade só preenche o campo de classe — a gravação continua no
        // botão verde, e o preview ao vivo cuida de mostrar o resultado.
        $(document).on('click', '.iconGrid__item', function () {
            const classe = $(this).data('icon');
            const alvo   = $(this).closest('.iconPicker').data('target');
            $('#' + alvo).val(classe);
            $('i[data-preview-for="' + alvo + '"]').attr('class', classe);
            E.livePreviewDebounced();
        });

        $(document).on('input', '.iconClassInput', function () {
            const alvo = $(this).data('preview-for');
            $('i[data-preview-for="' + alvo + '"]').attr('class', $(this).val());
        });

        // Botão: liga/desliga os campos de ícone.
        $(document).on('change', '.jsBtnUseIcon', function () {
            $('#' + $(this).data('prefix') + 'IconControls').toggle(this.checked);
        });

        $(document).on('change', '#iconUseBg', function () {
            $('#iconBgColor').prop('disabled', !this.checked);
        });

        $(document).on('change', '#iconLinkType', function () {
            const tipo = $(this).val();
            $('#iconPageSelect').toggle(tipo === 'page');
            $('#iconUrl').toggle(tipo === 'url');
            $('#iconBlankWrap').toggle(tipo !== 'none');
        });

        $(document).on('click', '#btnApplyIconStyle', () => E.saveIconElementFields());

        // ── Bloco flutuante ───────────────────────────────────────
        $(document).on('click', '#btnApplyFlutuante', () => E.saveFlutuanteFields());

        $(document).on('change', '#flutMode', function () {
            $('#flutPosControls').toggle($(this).val() === 'float');
        });

        $(document).on('change', '#flutMobileOverride', function () {
            $('#flutMobileControls').toggle(this.checked);
        });

        $(document).on('change', '#flutUseBg', function () {
            $('#flutBgColor').prop('disabled', !this.checked);
        });

        $(document).on('change', '#flutShadowEnabled', function () {
            $('#flutShadowControls').toggle(this.checked);
        });

        // Arrastar o bloco no canvas para posicionar. A conta é feita em % da seção
        // que contém o bloco, que é exatamente o que vai para o content — por isso a
        // posição continua certa quando a tela muda de tamanho.
        let _flutArraste = null;

        $(document).on('mousedown', '.editorFlutuante__handle', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const $bloco = $(this).closest('.editorFlutuante');
            const $secao = $bloco.closest('.editorSection');
            if (!$secao.length) return;

            const achado = E._findAnyElement(parseInt($bloco.data('flut-id')));
            if (!achado) return;

            _flutArraste = { $bloco, $secao, element: achado.element, root: achado.root };
            $bloco.addClass('is-dragging');
        });

        $(document).on('mousemove', function (e) {
            if (!_flutArraste) return;

            const r = _flutArraste.$secao[0].getBoundingClientRect();
            if (!r.width || !r.height) return;

            const pos = _flutArraste.element.content.position || {};
            const x = Math.max(-50, Math.min(150, Math.round(((e.clientX - r.left) / r.width)  * 1000) / 10));
            const y = Math.max(-50, Math.min(150, Math.round(((e.clientY - r.top)  / r.height) * 1000) / 10));

            _flutArraste.element.content = {
                ..._flutArraste.element.content,
                position: { ...pos, x, y },
            };

            // Move só o bloco enquanto arrasta; redesenhar o canvas inteiro a cada
            // mousemove perderia o elemento debaixo do cursor.
            _flutArraste.$bloco.css({ left: x + '%', top: y + '%' });
        });

        $(document).on('mouseup', function () {
            if (!_flutArraste) return;

            const { $bloco, element } = _flutArraste;
            $bloco.removeClass('is-dragging');
            _flutArraste = null;

            // Atualiza os campos do painel (se ele estiver aberto) e grava.
            const pos = element.content.position || {};
            $('#flutX').val(pos.x);
            $('#flutY').val(pos.y);
            E.saveElementDirect(E._rootFor(element));
            E.renderPreview();
        });

        // ── Calculadora ───────────────────────────────────────────
        $(document).on('click', '#btnApplyCalculadora', () => E.saveCalculadoraFields());

        $(document).on('change', '#calcShowFreq', function () {
            $('#calcFreqControls').toggle(this.checked);
        });

        $(document).on('change', '#calcLinkType', function () {
            const ehPagina = $(this).val() === 'page';
            $('#calcPageSelect').toggle(ehPagina);
            $('#calcUrl').toggle(!ehPagina);
        });

        // Soma dos percentuais atualiza enquanto digita, para o usuário perceber
        // na hora se passou (ou não chegou a) 100%.
        $(document).on('input', '.calcAnimalPct', function () {
            let soma = 0;
            $('.calcAnimalPct').each(function () { soma += parseFloat($(this).val()) || 0; });
            const ok = Math.round(soma) === 100;
            $('#calcSoma')
                .text('Soma: ' + E._formataPct(soma) + '%' + (ok ? '' : ' — o ideal é 100%'))
                .toggleClass('is-ok', ok)
                .toggleClass('is-warn', !ok);
        });

        $(document).on('click', '#btnCalcAnimalAdd', function () {
            if (!['element', 'grid-element', 'panels-element'].includes(E.state.mode)) return;
            const { element } = E.state.selected;
            const animais = E._syncCalcAnimalsFromDom(element.content.animals || []);
            animais.push({ id: E._genLocalId(), name: '', pct: 0, icon: 'fa-solid fa-paw' });
            element.content = { ...element.content, animals, values: E._syncCalcValuesFromDom() };
            E.renderPanel();
            E.renderPreview();
        });

        $(document).on('click', '.btnCalcAnimalRemove', function () {
            if (!['element', 'grid-element', 'panels-element'].includes(E.state.mode)) return;
            const { element } = E.state.selected;
            const id = String($(this).data('animal-id'));
            element.content = {
                ...element.content,
                animals: E._syncCalcAnimalsFromDom(element.content.animals || []).filter(a => String(a.id) !== id),
                values:  E._syncCalcValuesFromDom(),
            };
            E.renderPanel();
            E.renderPreview();
        });

        $(document).on('change', '.calcAnimalIcon', function () {
            $(this).siblings('i').attr('class', 'plugin-calculadora__animalIcon ' + $(this).val());
            E.livePreviewDebounced();
        });

        $(document).on('click', '#btnCalcValueAdd', function () {
            if (!['element', 'grid-element', 'panels-element'].includes(E.state.mode)) return;
            const { element } = E.state.selected;
            const valores = E._syncCalcValuesFromDom();
            valores.push(50);
            element.content = {
                ...element.content,
                animals: E._syncCalcAnimalsFromDom(element.content.animals || []),
                values: valores,
            };
            E.renderPanel();
            E.renderPreview();
        });

        $(document).on('click', '.btnCalcValueRemove', function () {
            if (!['element', 'grid-element', 'panels-element'].includes(E.state.mode)) return;
            const { element } = E.state.selected;
            const idx = parseInt($(this).data('index'));
            const valores = E._syncCalcValuesFromDom().filter((_, i) => i !== idx);
            element.content = {
                ...element.content,
                animals: E._syncCalcAnimalsFromDom(element.content.animals || []),
                values: valores,
            };
            E.renderPanel();
            E.renderPreview();
        });

        // ── Depoimentos ───────────────────────────────────────────
        $(document).on('click', '#btnApplyTestimonials', () => E.saveTestimonialsFields());

        $(document).on('change', '#depUseSectionBg', function () {
            $('#depSectionBg').prop('disabled', !this.checked);
        });

        $(document).on('click', '#btnDepAdd', function () {
            if (!['element', 'grid-element', 'panels-element'].includes(E.state.mode)) return;
            const { element } = E.state.selected;
            const itens = E._syncDepItemsFromDom(element.content.items || []);
            itens.push({ id: E._genLocalId(), text: '', name: '', role: '', extra: '' });
            element.content = { ...element.content, items: itens };
            E.renderPanel();
            E.renderPreview();
        });

        $(document).on('click', '.btnDepRemove', function () {
            if (!['element', 'grid-element', 'panels-element'].includes(E.state.mode)) return;
            const { element } = E.state.selected;
            const id = parseInt($(this).data('item-id'));
            element.content = {
                ...element.content,
                items: E._syncDepItemsFromDom(element.content.items || []).filter(i => i.id !== id),
            };
            E.renderPanel();
            E.renderPreview();
        });

        $(document).on('click', '.btnDepUp, .btnDepDown', function () {
            if (!['element', 'grid-element', 'panels-element'].includes(E.state.mode)) return;
            const { element } = E.state.selected;
            const itens = E._syncDepItemsFromDom(element.content.items || []);
            const idx   = itens.findIndex(i => i.id === parseInt($(this).data('item-id')));
            const novo  = idx + ($(this).hasClass('btnDepUp') ? -1 : 1);
            if (idx === -1 || novo < 0 || novo >= itens.length) return;
            [itens[idx], itens[novo]] = [itens[novo], itens[idx]];
            element.content = { ...element.content, items: itens };
            E.renderPanel();
            E.renderPreview();
        });

        // ── Card com ícones ───────────────────────────────────────
        $(document).on('change', '#ciImageShow',  function () { $('#ciImageControls').toggle(this.checked); });
        $(document).on('change', '#ciBadgeShow',  function () { $('#ciBadgeControls').toggle(this.checked); });
        $(document).on('change', '#ciTitleShow',  function () { $('#ciTitleControls').toggle(this.checked); });
        $(document).on('change', '#ciTextShow',   function () { $('#ciTextControls').toggle(this.checked); });
        $(document).on('change', '#ciButtonShow', function () { $('#ciButtonControls').toggle(this.checked); });

        $(document).on('change', '#ciUseBg', function () {
            $('#ciBgColor').prop('disabled', !this.checked);
        });

        $(document).on('change', '#ciShadowEnabled', function () {
            $('#ciShadowControls').toggle(this.checked);
        });

        $(document).on('click', '#btnCardIconImagePick', () => $('#ciImageFile').trigger('click'));

        $(document).on('change', '#ciImageFile', function () {
            const file = this.files[0];
            if (!file || !['element', 'grid-element', 'panels-element'].includes(E.state.mode)) return;
            const { element } = E.state.selected;

            const formData = new FormData();
            formData.append('image', file);

            $.ajax({
                url: ADMIN_BASE_URL + '/services/editor/upload_image.php',
                method: 'POST', data: formData, processData: false, contentType: false
            }).done(res => {
                if (res.success) {
                    const c = element.content || {};
                    element.content = { ...c, image: { ...(c.image || {}), url: res.url } };
                    E.renderPanel();
                    E.renderPreview();
                } else { alert(res.message); }
            }).fail(() => alert('Erro ao enviar imagem.'));
        });

        $(document).on('click', '#btnCardIconImageRemove', function () {
            if (!['element', 'grid-element', 'panels-element'].includes(E.state.mode)) return;
            const { element } = E.state.selected;
            const c = element.content || {};
            element.content = { ...c, image: { ...(c.image || {}), url: '' } };
            E.renderPanel();
            E.renderPreview();
        });

        $(document).on('click', '#btnApplyCardIconStyle', () => E.saveCardIconElementFields());

        // ── Abas / Sanfona ────────────────────────────────────────
        $(document).on('click', '#btnPanelsAddItem',   () => E.addPanelsItem());
        $(document).on('click', '#btnApplyPanelsStyle', () => E.savePanelsFields());

        $(document).on('change', '#panelsUseBg', function () {
            $('#panelsBgColor').prop('disabled', !this.checked);
        });

        $(document).on('change', '#panelsShadowEnabled', function () {
            $('#panelsShadowControls').toggle(this.checked);
        });

        $(document).on('click', '.btnPanelsRemoveItem', function (e) {
            e.stopPropagation();
            if (confirm('Remover este item e todo o conteúdo dele?')) {
                E.removePanelsItem(parseInt($(this).data('item-id')));
            }
        });

        // Árvore lateral: "+ Novo elemento" dentro de uma aba/item
        $(document).on('click', '.btnPanelsAddElement', function (e) {
            e.stopPropagation();
            if (E.state.mode !== 'panels') return;
            const { element: containerElement } = E.state.selected;
            const itemId = parseInt($(this).data('item-id'));
            const item   = (containerElement.content.items || []).find(i => i.id === itemId);
            if (item) E._descend({ containerElement, item }, 'panels-add-element');
        });

        // Árvore lateral: abrir um elemento aninhado
        $(document).on('click', '.panelsStructureElement', function (e) {
            e.stopPropagation();
            if (E.state.mode !== 'panels') return;
            const { element: containerElement } = E.state.selected;
            const itemId = parseInt($(this).data('item-id'));
            const elId   = parseInt($(this).data('el-id'));
            const item   = (containerElement.content.items || []).find(i => i.id === itemId);
            const element = item && (item.elements || []).find(el => el.id === elId);
            if (element) E._abrirElementoAninhado({ containerElement, item, element });
        });

        // Preview: clique num elemento dentro de uma aba/item abre a edição dele
        $(document).on('click', '.editorPanelsElement', function (e) {
            if ($(e.target).closest('.slick-arrow, .slick-dots').length) return;
            e.stopPropagation();
            const achado = E._findAnyElement(parseInt($(this).data('panels-id')));
            if (!achado) return;
            const containerElement = achado.element;
            const item    = (containerElement.content.items || []).find(i => i.id === parseInt($(this).data('item-id')));
            const elId    = parseInt($(this).data('el-id'));
            const element = item && (item.elements || []).find(el => el.id === elId);
            if (element) {
                E._abrirElementoAninhado({ containerElement, item, element }, achado.root);
            }
        });

        // Preview: clicar no título de uma aba só troca a aba visualizada — não abre
        // o painel do elemento (senão não daria pra ver o conteúdo das outras abas).
        $(document).on('click', '.plugin-tabs__tab[data-preview-tab]', function (e) {
            e.stopPropagation();
            E._panelsPreview[$(this).data('panels-id')] = parseInt($(this).data('preview-tab')) || 0;
            E.renderPreview();
        });

        // Back
        $(document).on('click', '.btnBack', () => {
            E._goBack();
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
            if (styles.bg_size) css += `background-size:${styles.bg_size};`;
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
                    const conteudoPadrao = this._defaultContentFor(pluginType);
                    if (Object.keys(conteudoPadrao).length) {
                        res.element.content = conteudoPadrao;
                        this.saveElementDirect(res.element);
                    }
                    this._stack = [];
                    this.state = { mode: this._modeForElement(res.element), selected: { element: res.element, column: col }, selectedCols: 1 };
                    this.renderPanel();
                    this.renderPreview();
                }
            } else { alert(res.message); }
        });
    },

    saveElementContent() {
        if (!['element', 'grid-element', 'panels-element'].includes(this.state.mode) || !this.quill) return;
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

        if (this.state.mode === 'panels-element') {
            this.savePanelsContent(this.state.selected.containerElement);
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
    // Grava o content de um elemento real sem depender de state.selected — usado ao
    // criar um elemento que já nasce com conteúdo padrão (ver addElement).
    saveElementDirect(element) {
        $.post(ADMIN_BASE_URL + '/services/editor/save_element.php', {
            element_id: element.id, content: JSON.stringify(element.content)
        }).done(() => {
            this.renderPreview();
            this.showSaved();
        });
    },

    // Conteúdo inicial de um elemento recém-criado, seja ele de topo ou aninhado.
    // Plugins "montados" (card, botão, abas, sanfona, grid) nascem preenchidos para
    // não aparecerem vazios e para o preview bater com o render público (que completa
    // o content com getDefaultConfig() do PHP).
    _defaultContentFor(pluginType) {
        if (pluginType === 'card')   return this._cardDefaultContent();
        if (pluginType === 'icon')   return this._iconDefaultContent();
        if (pluginType === 'cardicon') return this._cardIconDefaultContent();
        if (pluginType === 'testimonials') return this._testimonialsDefaultContent();
        if (pluginType === 'calculadora') return this._calculadoraDefaultContent();
        if (pluginType === 'button') return this._buttonDefaultContent();
        if (pluginType === 'flutuante') return this._flutuanteDefaultContent();
        if (['tabs', 'accordion'].includes(pluginType)) return this._panelsDefaultContent(pluginType);
        if (pluginType === 'grid') {
            return {
                columns: [
                    { id: this._genLocalId(), col_size: 6, responsive_size: 12, hide_responsive: false, elements: [] },
                    { id: this._genLocalId(), col_size: 6, responsive_size: 12, hide_responsive: false, elements: [] },
                ],
            };
        }
        return {};
    },

    // ── Aninhamento em profundidade ───────────────────────────
    // Só o elemento de topo tem linha no banco; tudo abaixo dele mora no JSON dele.
    // Por isso qualquer gravação de conteúdo aninhado grava o elemento RAIZ.
    _rootFor(element) {
        return (this.state.selected && this.state.selected.rootElement) || element;
    },

    // Herda a raiz do estado atual ao descer um nível. Na primeira descida (de um
    // container de topo) a raiz é o próprio elemento selecionado.
    _withRoot(selected) {
        const atual = this.state.selected || {};
        return { ...selected, rootElement: selected.rootElement || atual.rootElement || atual.element };
    },

    // Procura um elemento por id em toda a árvore (topo, colunas de grid e itens de
    // abas/sanfona), devolvendo também qual é a raiz dele. Necessário porque os
    // cliques no preview vêm com o id sintético de um elemento que pode estar a
    // vários níveis de profundidade.
    _findAnyElement(id) {
        for (const section of this.data) {
            for (const column of section.columns) {
                for (const element of column.elements) {
                    const hit = this._searchElementTree(element, id, element);
                    if (hit) return hit;
                }
            }
        }
        return null;
    },

    _searchElementTree(element, id, root) {
        if (element.id === id) return { element, root };
        const c = element.content || {};

        for (const grupo of [...(c.columns || []), ...(c.items || [])]) {
            for (const filho of (grupo.elements || [])) {
                const hit = this._searchElementTree(filho, id, root);
                if (hit) return hit;
            }
        }
        return null;
    },

    // Pilha de navegação do painel: cada descida empilha o estado anterior, e o
    // "← Voltar" desempilha. Sem isso, voltar de um Grid dentro de uma Aba não teria
    // como saber para onde ir.
    _stack: [],

    _descend(selected, mode) {
        this._stack.push(this.state);
        this.state = { mode, selected: this._withRoot(selected), selectedCols: 1 };
        this.renderPanel();
    },

    // Abre um elemento de topo: novo caminho, então a pilha de navegação recomeça.
    _abrirElementoDeTopo(data) {
        this._stack = [];
        this.state  = { mode: this._modeForElement(data.element), selected: data, selectedCols: 1 };
        this.renderPanel();
    },

    // Abre um elemento aninhado. Se ele for outro container (Grid/Abas/Sanfona), abre
    // o painel do container; senão, o painel de elemento simples. Em ambos os casos a
    // raiz é preservada, porque é ela que vai pro banco.
    _abrirElementoAninhado(selected, raizExplicita) {
        const modo = this._modeForElement(selected.element);
        const base = raizExplicita
            ? { ...selected, rootElement: raizExplicita }
            : this._withRoot(selected);

        this._stack.push(this.state);

        this.state = modo === 'element'
            ? { mode: selected.gridElement ? 'grid-element' : 'panels-element', selected: base, selectedCols: 1 }
            : { mode: modo, selected: { element: selected.element, column: null, rootElement: base.rootElement }, selectedCols: 1 };

        this.renderPanel();
    },

    _goBack() {
        this.state = this._stack.length
            ? this._stack.pop()
            : { mode: 'default', selected: null, selectedCols: 1 };
        this.renderPanel();
    },

    // Espelha ButtonPlugin::getDefaultConfig() do PHP.
    _buttonDefaultContent() {
        return {
            text: 'Clique aqui', link_type: 'url', page_id: '', url: '',
            target_blank: false, align: 'left', font_size: '', bold: false,
            icon: '', icon_position: 'left', icon_gap: 8, icon_size: '',
            width_value: '', width_unit: 'px', height_value: '', height_unit: 'px',
            padding: { top: 12, right: 24, bottom: 12, left: 24 },
            margin:  { top: 0, right: 0, bottom: 0, left: 0 },
            bg_color: '#ae272c', text_color: '#ffffff',
            hover_bg_color: '#8a1f23', hover_text_color: '#ffffff',
            border_width: 0, border_color: '#000000',
            border_radius: { tl: 4, tr: 4, br: 4, bl: 4 },
            shadow: { enabled: false, color: '#000000', size: 0, distance: 0, angle: 135, opacity: 30 },
        };
    },

    // Espelha CardPlugin::getDefaultConfig() do PHP.
    _cardDefaultContent() {
        return {
            image:  { show: true, url: '', alt: '', height: 200 },
            text:   { show: true, content: 'Título do card', font_size: 20, color: '#222222', align: 'left', bold: true },
            button: {
                show: true, text: 'Saiba mais', link_type: 'url', page_id: '', url: '',
                target_blank: false, align: 'left',
                padding: { top: 10, right: 20, bottom: 10, left: 20 },
                bg_color: '#ae272c', text_color: '#ffffff',
                hover_bg_color: '#8a1f23', hover_text_color: '#ffffff',
                border_radius: { tl: 4, tr: 4, br: 4, bl: 4 },
            },
            card: {
                padding: { top: 24, right: 24, bottom: 24, left: 24 },
                styles: {
                    bg_color: '#ffffff',
                    border_width: 0,
                    border_color: '#e0e0e0',
                    border_radius: { tl: 8, tr: 8, br: 8, bl: 8 },
                    // Ângulo 0 = sombra para baixo (o eixo Y usa cos do ângulo).
                    shadow: { enabled: true, color: '#000000', size: 18, distance: 4, angle: 0, opacity: 12 },
                },
            },
        };
    },

    // Grava o Grid — ou, se ele estiver aninhado dentro de outro container, o
    // elemento raiz (o único que tem linha no banco).
    saveGridContent(gridElement) {
        this.saveElementDirect(this._rootFor(gridElement));
    },

    // `sizes` é opcional: quando vem (modelos prontos / larguras avançadas), define a
    // largura de cada coluna individualmente; sem ele, divide 12 em partes iguais.
    updateGridColumns(gridElement, newCount, sizes) {
        const cols    = gridElement.content.columns || [];
        const colSize = Math.floor(12 / newCount);

        if (newCount < cols.length) {
            const removed       = cols.splice(newCount);
            const movedElements = removed.flatMap(c => c.elements || []);
            cols[newCount - 1].elements = [...(cols[newCount - 1].elements || []), ...movedElements];
        } else {
            while (cols.length < newCount) {
                cols.push({ id: this._genLocalId(), col_size: colSize, responsive_size: 12, hide_responsive: false, elements: [] });
            }
        }
        cols.forEach((c, i) => {
            c.col_size = sizes ? Math.min(12, Math.max(1, sizes[i] || colSize)) : colSize;
            if (!c.responsive_size) c.responsive_size = 12;
            if (c.hide_responsive === undefined) c.hide_responsive = false;
        });

        gridElement.content.columns = cols;
        this.saveGridContent(gridElement);
        this.renderPanel();
    },

    addGridElement(pluginType) {
        if (this.state.mode !== 'grid-add-element') return;
        const { gridElement, column } = this.state.selected;
        const element = { id: this._genLocalId(), plugin_type: pluginType, content: this._defaultContentFor(pluginType) };
        column.elements = column.elements || [];
        column.elements.push(element);

        this.state = { mode: 'grid-element', selected: this._withRoot({ gridElement, column, element }), selectedCols: 1 };
        this.saveGridContent(gridElement);

        // Se o que entrou foi outro container, já abre o painel dele (Grid/Abas/Sanfona
        // são editados pelos próprios modos, não pelo painel de elemento simples).
        this._abrirSeContainer(element);
        this.renderPanel();
    },

    // Após criar um elemento aninhado, decide se o painel aberto é o de elemento
    // simples ou o do container (grid/panels), preservando a raiz para gravação.
    _abrirSeContainer(element) {
        const modo = this._modeForElement(element);
        if (modo === 'element') return;

        // Substitui o estado em vez de empilhar: o modo de "elemento aninhado" definido
        // logo acima foi só transitório, e o "← Voltar" deve levar ao container pai
        // (que já está na pilha, empilhado por _descend ao entrar em "+ Novo elemento").
        this.state = {
            mode: modo,
            selected: { element, column: null, rootElement: this.state.selected.rootElement },
            selectedCols: 1,
        };
    },

    deleteGridElement() {
        if (this.state.mode !== 'grid-element') return;
        const { gridElement, column, element, rootElement: raiz } = this.state.selected;
        column.elements = (column.elements || []).filter(e => e.id !== element.id);
        // Preserva a raiz: sem isso, apagar um elemento dentro de um Grid aninhado
        // faria a próxima gravação mirar o container errado.
        this.state = { mode: 'grid', selected: { element: gridElement, column: null, rootElement: raiz }, selectedCols: 1 };
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
        if (element.plugin_type === 'grid') return 'grid';
        if (['tabs', 'accordion', 'flutuante'].includes(element.plugin_type)) return 'panels';
        return 'element';
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
                submenu:      row.find('.menuItemSubmenu').val() || 'none',
                mega_columns: parseInt(row.find('.menuItemMegaCols').val()) || 3,
                children:     this._syncMenuChildrenFromDom(item),
            };
        });
    },

    // Mesmo papel do _syncMenuItemsFromDom, um nível abaixo: lê os subitens que estão
    // na tela para não perder o que foi digitado antes de redesenhar o painel.
    _syncMenuChildrenFromDom(item) {
        return (item.children || []).map(filho => {
            const linha = $(`.menuChildRow[data-child-id="${filho.id}"]`);
            if (!linha.length) return filho;
            return {
                ...filho,
                label:        linha.find('.menuChildLabel').val(),
                link_type:    linha.find('.menuChildLinkType').val() || 'url',
                page_id:      linha.find('.menuChildPageSelect').val() || '',
                url:          linha.find('.menuChildUrl').val(),
                target_blank: linha.find('.menuChildBlank').is(':checked'),
            };
        });
    },

    // Bloco de submenu de um item do menu (tipo + colunas do mega + lista de subitens).
    _menuSubmenuHtml(item, pages) {
        const tipo   = item.submenu || 'none';
        const filhos = item.children || [];

        const filhosHtml = filhos.map(filho => {
            const tipoLink = filho.link_type || 'url';
            const opts = pages.map(p =>
                `<option value="${p.id}" ${parseInt(filho.page_id) === p.id ? 'selected' : ''}>${this.escHtml(p.title)} (/${this.escHtml(p.slug)})</option>`
            ).join('');

            return `
                <div class="menuChildRow" data-child-id="${filho.id}">
                    <div class="menuItemRow__row">
                        <input type="text" class="input menuChildLabel" value="${this.escHtml(filho.label || '')}" placeholder="Texto do subitem">
                        <select class="input menuChildLinkType">
                            <option value="page" ${tipoLink === 'page' ? 'selected' : ''}>Página</option>
                            <option value="url"  ${tipoLink === 'url'  ? 'selected' : ''}>URL</option>
                        </select>
                    </div>
                    <div class="menuItemRow__row">
                        <select class="input menuChildPageSelect" ${tipoLink === 'page' ? '' : 'style="display:none"'}>
                            <option value="">— Selecione a página —</option>
                            ${opts}
                        </select>
                        <input type="text" class="input menuChildUrl" value="${this.escHtml(filho.url || '')}" placeholder="https://... ou /pagina" ${tipoLink === 'page' ? 'style="display:none"' : ''}>
                    </div>
                    <div class="menuItemRow__row menuItemRow__actions">
                        <label class="menuItemRow__blankLabel">
                            <input type="checkbox" class="menuChildBlank" ${filho.target_blank ? 'checked' : ''}> Nova aba
                        </label>
                        <div class="menuItemRow__buttons">
                            <button class="btnMenuChildRemove" data-item-id="${item.id}" data-child-id="${filho.id}" title="Remover subitem">✕</button>
                        </div>
                    </div>
                </div>`;
        }).join('');

        return `
            <div class="menuSubBlock">
                <div class="menuItemRow__row">
                    <select class="input menuItemSubmenu" data-item-id="${item.id}">
                        <option value="none"     ${tipo === 'none'     ? 'selected' : ''}>Sem submenu</option>
                        <option value="dropdown" ${tipo === 'dropdown' ? 'selected' : ''}>Submenu em lista</option>
                        <option value="mega"     ${tipo === 'mega'     ? 'selected' : ''}>Mega menu</option>
                    </select>
                    <select class="input menuItemMegaCols" ${tipo === 'mega' ? '' : 'style="display:none"'}>
                        ${[1,2,3,4].map(n => `<option value="${n}" ${(parseInt(item.mega_columns) || 3) === n ? 'selected' : ''}>${n} col.</option>`).join('')}
                    </select>
                </div>
                <div class="menuChildList" ${tipo === 'none' ? 'style="display:none"' : ''}>
                    ${filhosHtml}
                    <button type="button" class="btn btn--sm btn--secondary btn--full btnMenuAddChild" data-item-id="${item.id}">+ Subitem</button>
                </div>
            </div>`;
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
        if (element.plugin_type === 'flutuante') {
            const n = (((c.items || [])[0] || {}).elements || []).length;
            return `Bloco flutuante (${n})`;
        }
        if (element.plugin_type === 'tabs' || element.plugin_type === 'accordion') {
            const n = (c.items || []).length;
            const nome = element.plugin_type === 'tabs' ? 'Abas' : 'Sanfona';
            return `${nome} (${n} ${n === 1 ? 'item' : 'itens'})`;
        }
        if (element.plugin_type === 'testimonials') {
            const n = (c.items || []).length;
            return `Depoimentos (${n})`;
        }
        if (element.plugin_type === 'calculadora') {
            const n = (c.animals || []).length;
            return `Calculadora (${n} ${n === 1 ? 'espécie' : 'espécies'})`;
        }
        if (element.plugin_type === 'cardicon') {
            const t = ((c.title || {}).content || '').trim();
            return t ? 'Card ícone: ' + this.escHtml(t.length > 18 ? t.substring(0, 18) + '…' : t) : 'Card com ícones';
        }
        if (element.plugin_type === 'icon') {
            const nome = (c.icon || '').split(/\s+/).filter(x => x && x !== 'fa-solid' && x !== 'fa-brands' && x !== 'fa-regular')[0];
            return nome ? 'Ícone: ' + this.escHtml(nome.replace(/^fa-/, '')) : 'Ícone';
        }
        if (element.plugin_type === 'card') {
            const t = ((c.text || {}).content || '').trim();
            return t ? 'Card: ' + this.escHtml(t.length > 20 ? t.substring(0, 20) + '…' : t) : 'Card';
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
