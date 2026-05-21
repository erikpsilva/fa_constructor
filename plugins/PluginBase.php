<?php

abstract class PluginBase {
    protected array $config;

    public function __construct(array $config = []) {
        $this->config = array_merge($this->getDefaultConfig(), $config);
    }

    // Renderiza o HTML do plugin na página pública
    abstract public function render(): string;

    // Configuração padrão do plugin (valores iniciais dos campos)
    abstract public function getDefaultConfig(): array;

    // Define os campos editáveis no page builder
    // Retorna array de [ 'key' => string, 'label' => string, 'type' => 'text'|'image'|'color'|'textarea'|'repeater' ]
    abstract public function getEditorFields(): array;

    public function getConfig(): array {
        return $this->config;
    }

    // Nome exibido no page builder
    public function getName(): string {
        return static::class;
    }
}
