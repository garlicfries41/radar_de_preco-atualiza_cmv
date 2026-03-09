# PLANEJAMENTO - Módulo DRE & Refatoração de Custos

## Motivação
Refinar a estrutura de despesas da DRE para refletir com precisão os custos fixos, variáveis e operacionais, permitindo uma análise clara do EBITDA e do Resultado Líquido.

## Histórico de Raciocínio
- Identificamos que a estrutura de despesas estava simplista.
- Reorganizamos o banco de dados (`financial_categories`) para suportar uma hierarquia de pais e filhos.
- Atualizamos o backend para lidar com nomes de categorias duplicados (ex: "Venda Direta" em Marketing e Entregas) usando o nome do pai como desambiguador.
- Reformulamos o Wizard de Fechamento para ser mais intuitivo e completo.

## Próximos Passos (Concluídos)
- [x] Otimização da DRE (Visualização de 3 meses).
- [x] Refatoração completa das categorias financeiras no Supabase.
- [x] Novo layout da DRE seguindo hierarquia contabíl solicitada (Estrutura, Marketing, Logística, Inadimplência).
- [x] Implementação do EBITDA e Resultados Pós-EBITDA (Depreciação, Juros, Impostos).
- [x] Ajuste nos cálculos de CMV % e Margem Bruta (baseados na Receita Bruta Total).
- [x] Melhoria no Wizard de Fechamento com campos agrupados e suporte a categorias duplicadas.

## Pendentes / Melhorias Futuras
- [ ] Automação da busca de taxas do Stripe/Mercado Pago via API.
- [ ] Integração automática da depreciação via cadastro de ativos (PoC funcional já existe no backend).
- [ ] Relatórios comparativos anuais.
