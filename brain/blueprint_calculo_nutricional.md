# Blueprint: Cálculo Nutricional (Padrão ANVISA)

Este documento detalha a engenharia matemática por trás da geração dos rótulos nutricionais e tabelas consolidadas do sistema.

## 1. Origem dos Dados
Os cálculos dependem de três entidades principais no banco de dados:
- **`nutritional_ref`**: Valores de referência por **100g** de cada insumo.
- **`recipe_ingredients`**: Quantidade exata de cada insumo na receita (em kg).
- **`recipe_categories`**: Define a porção padrão (ex: 190g para Ravioli) para o cálculo do %VD.

## 2. O Algoritmo de Cálculo

O processo ocorre em 4 etapas principais:

### Etapa A: Agregação do Batch (Total da Receita)
Para cada ingrediente na receita, calculamos sua contribuição absoluta:
```python
fator_ingrediente = quantidade_na_receita_kg / 0.1  # Pois a referência é por 100g
total_nutriente_batch += valor_referencia_100g * fator_ingrediente
```

### Etapa B: Normalização por Peso Total
Como as receitas têm perdas ou pesos variados, calculamos a densidade nutricional:
```python
fator_densidade = 1 / peso_total_da_receita_kg
```

### Etapa C: Cálculo por Porção (Rótulo)
Para o rótulo ANVISA, os valores são calculados com base na porção da categoria (`P`):
```python
valor_na_porção = (total_nutriente_batch * fator_densidade) * (P / 1000)
```

### Etapa D: Cálculo por 100g (Tabela Consolidada)
Para a comparação entre produtos, usamos o padrão de 100g (0.1kg):
```python
valor_100g_final = (total_nutriente_batch * fator_densidade) * 0.1
```

## 3. Valores Diários de Referência (%VD)
O sistema utiliza as bases oficiais da ANVISA para uma dieta de 2.000 kcal:

| Nutriente | Valor Diário (100%) |
| :--- | :--- |
| Valor Energético | 2.000 kcal |
| Carboidratos | 300 g |
| Proteínas | 50 g |
| Gorduras Totais | 65 g |
| Gorduras Saturadas | 22 g |
| Fibra Alimentar | 25 g |
| Sódio | 2.000 mg |

## 4. Arredondamentos e Regras de Exibição
- **Nutrientes**: Exibidos com 1 casa decimal.
- **%VD**: Arredondado para o número inteiro mais próximo.
- **Valores Zero**: Itens com valor < 0.1 são exibidos como "0" seguindo diretrizes de rotulagem.
