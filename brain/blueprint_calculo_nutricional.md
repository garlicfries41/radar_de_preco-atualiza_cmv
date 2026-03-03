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

### Etapa B: Normalização por Rendimento (Peso Final)
Diferente da versão anterior, agora consideramos a perda/ganho de peso no preparo (evaporação, drenagem):
```python
# Cálculo do Peso Final Acabado (KG)
Se Unidade == 'KG':
    peso_final_kg = rendimento_da_receita (yield_units)
Senão (Unidade == 'UN'):
    peso_final_kg = rendimento (yield_units) * peso_unitario (net_weight)

fator_densidade = 1 / peso_final_kg
```

### Etapa C: Cálculo por Porção (Rótulo)
Para o rótulo ANVISA, os valores são calculados com base na porção da categoria (`P` em gramas):
```python
# (Total Batch / Peso Final em gramas) * Porção
valor_na_porção = (total_nutriente_batch / (peso_final_kg * 1000)) * P
```

### Etapa D: Cálculo por 100g (Tabela Consolidada)
```python
# (Total Batch / Peso Final em kg) * 0.1
valor_100g_final = (total_nutriente_batch / peso_final_kg) * 0.1
```

## 3. Valores Diários de Referência (%VD)
O sistema utiliza as bases oficiais da ANVISA para uma dieta de 2.000 kcal:

| Nutriente | Valor Diário (100%) |
| :--- | :--- |
| Valor Energético | 2.000 kcal |
| Carboidratos | 300 g |
| Açúcares Totais | - |
| Açúcares Adicionados | 50 g |
| Proteínas | 50 g |
| Gorduras Totais | 65 g |
| Gorduras Saturadas | 22 g |
| Fibra Alimentar | 25 g |
| Sódio | 2.000 mg |

## 4. Selo de Advertência Frontal (Lupa) - ANVISA 2022
O sistema deve emitir um alerta ("Alto em...") se o valor por **100g do produto pronto** for igual ou superior a:

- **Açúcar Adicionado**: $\geq 15g$
- **Gordura Saturada**: $\geq 6g$
- **Sódio**: $\geq 600mg$


## 4. Arredondamentos e Regras de Exibição
- **Nutrientes**: Exibidos com 1 casa decimal.
- **%VD**: Arredondado para o número inteiro mais próximo.
- **Valores Zero**: Itens com valor < 0.1 são exibidos como "0" seguindo diretrizes de rotulagem.
