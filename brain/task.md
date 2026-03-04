# Tarefas Radar de Preço - Atualiza CMV

- [x] **Fase 1: Inicialização e MVP Backend**
    - [x] Configuração de Banco de Dados Supabase
    - [x] FastAPI + Modelos OCR e Handlers Base
    - [x] Gestão de Receitas (Yeld e Integração Base)
    - [x] Testes de Conexão com Webhook Discord e DB
- [x] **Fase 2: Conclusão do MVP**
    - [x] MVP finalizado e Operacional
- [x] **Fase 3: Evolução do Front-end (Nova Frente)**
    - [x] Criar fork/branch para produção separada do ambiente de desenvolvimento do front-end
    - [x] Corrigir tela em branco no Rótulo ANVISA (nomes de campos inconsistentes)
    - [x] Corrigir falha no salvamento de categoria de produto (conversão UUID para Number)
    - [x] Implementar cálculo nutricional baseado no rendimento (Peso Final Acabado)
    - [x] Incluir Açúcares Adicionados no Rótulo e Tabela Consolidada
    - [x] Implementar Alerta de Lupa (Alto em...) conforme ANVISA 2022
    - [x] Validar persistência de dados no Supabase (UUIDs)
    - [x] Corrigir renderização da Tabela Nutricional Consolidada (colSpan e dados)
    - [x] Evoluir interface do painel mantendo o núcleo atual intocável
- [x] **Fase 4: Cascateamento de Pesos e Sincronização Global**
    - [x] Implementar Colunas de Peso Líquido no DB
    - [x] Criar Tabela de Configurações Globais no DB
    - [x] Implementar lógica de cascateamento no Backend
    - [x] Sincronizar Custo de Mão de Obra via API (Settings)
    - [x] Atualizar Interface de Receitas com opção de Cascateamento

- [x] **Fase 5: Manutenção e Cadastro de Dados**
    - [x] Analisar imagem da tabela nutricional da Farinha de Tremoço
    - [x] Inserir Farinha de Tremoço e Farinha de Tremoço Pré-Cozida na tabela `nutritional_ref`
