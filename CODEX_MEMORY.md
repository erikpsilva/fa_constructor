# FA Constructor - memoria de projeto

## Visao geral

`fa_constructor` e um construtor de sites em PHP, inspirado em builders como o Elementor do WordPress. A entrada publica e `index.php`, que carrega `core/Bootstrap.php` e despacha rotas pelo `core/Router.php`.

O sistema usa MySQL via PDO, banco `faconstructor_db`, com configuracao em `config/database.php`. Em localhost, `BASE_URL` aponta para `/fa_constructor`; em producao, o placeholder atual e `https://www.meusite.com.br`.

## Arquitetura principal

- `core/Router.php`: separa rotas publicas e rotas `/admin`.
- `core/Database.php`: wrapper PDO estatico com `fetch`, `fetchAll`, `insert` e `execute`.
- `core/Helpers.php`: helpers de URL, sessao, settings, JSON e `buildInlineStyles()`.
- `templates/default/template.php`: render publico das paginas dinamicas.
- `plugins/PluginBase.php`: contrato base de plugins.
- `plugins/text/Plugin.php`: plugin de texto atual, renderiza HTML vindo do Quill.

## Modelo mental do builder

As paginas publicadas sao montadas pelo banco:

- `pages`: titulo, slug, template, status, home.
- `page_sections`: secoes da pagina, layout e estilos em JSON.
- `section_columns`: colunas dentro da secao, tamanho bootstrap-like e estilos em JSON.
- `column_elements`: elementos dentro da coluna, tipo de plugin e conteudo em JSON.
- `templates`: templates disponiveis, usados pelo slug.
- `settings`: configuracoes como `site_name`.

O render publico carrega secoes ordenadas, depois colunas ordenadas, depois elementos ordenados. Cada elemento procura `plugins/{plugin_type}/Plugin.php` e instancia `{Tipo}Plugin`.

## Editor admin

O editor fica em:

- `admin/pages/editor/index.php`
- `admin/pages/editor/editor.js`
- `admin/pages/editor/editor.less`

Ele funciona com painel esquerdo e preview central. O JS mantem `Editor.data` com a arvore da pagina e troca o painel por modo:

- `default`: arvore/estrutura.
- `add-section`: criacao de secao.
- `section`: configuracoes da secao.
- `column`: adicionar elemento na coluna.
- `column-settings`: configuracoes da coluna.
- `element`: edicao de elemento.

Recursos ja existentes:

- Criar secoes com 1 a 6 colunas.
- Layouts de secao: `container`, `full`, `full-inner`.
- Alterar quantidade de colunas.
- Mover elementos para cima/baixo dentro da coluna.
- Excluir secoes e elementos.
- Editar texto com Quill.
- Estilos de secao e coluna: cor de fundo, padding, margin, largura, altura, position absolute/z-index, borda, border-radius e sombra.

## Endpoints do editor

Os endpoints principais estao em `admin/services/editor/`:

- `save_section.php`: cria/atualiza secao, nome, layout e estilos.
- `update_section_columns.php`: muda quantidade de colunas; ao reduzir, move elementos das colunas removidas para a ultima coluna mantida.
- `save_column.php`: salva estilos da coluna.
- `save_element.php`: cria elemento ou atualiza conteudo.
- `reorder_elements.php`: salva nova ordem dos elementos.
- `delete_section.php`: exclui secao.
- `delete_element.php`: exclui elemento.

Todos validam sessao admin e usam `config/api_security.php`.

## Admin de paginas

O gerenciamento de paginas fica em:

- `admin/pages/paginas/index.php`
- `admin/pages/paginas/paginas.js`
- `admin/services/create_page.php`
- `admin/services/update_page.php`
- `admin/services/delete_page.php`

Permite criar, editar e excluir paginas, definir slug, template, status `draft/published` e pagina inicial. A regra atual impede mais de uma pagina inicial ao mesmo tempo.

## Front publico

`templates/default/template.php` renderiza as secoes dinamicas e inclui:

- `templates/default/header.php`
- `templates/default/footer.php`
- `styles/style.min.css`
- `scripts/common.js`

Se nao houver pagina home dinamica publicada, o router cai no fallback `pages/inicio/index.php`.

## Build e assets

O projeto usa Gulp:

- `npm run dev` executa `gulp`.
- `gulpfile.js` compila `styles/style.min.less` para `styles/style.min.css`.
- Tambem compila `admin/styles/style.min.less` para `admin/styles/style.min.css`.
- BrowserSync usa proxy `localhost/fa_constructor`.

Entradas LESS:

- Publico: `styles/style.min.less`.
- Admin: `admin/styles/style.min.less`.

## Observacoes importantes

- Ha varios textos/comentarios exibidos com encoding quebrado no terminal, provavelmente por diferenca de charset na visualizacao. Antes de editar strings existentes, conferir com cuidado para nao piorar acentuacao.
- Nao ha schema SQL versionado encontrado nos arquivos listados.
- O README atual ainda diz apenas `project_php_start`, entao esta memoria e a melhor referencia local do estado atual.
- O projeto nao parece estar sob Git no nivel `c:\xampp\htdocs`.
