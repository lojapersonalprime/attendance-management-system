# Reconciliação de inconsistências

Inconsistências produzidas pelo motor possuem chave lógica determinística: funcionário, data, tipo, contexto relevante e versão do motor. Um novo recálculo atualiza a mesma ocorrência em vez de criar duplicatas.

Quando a causa deixa de existir, uma ocorrência aberta vira `AUTO_RESOLVED`; se reaparecer, vira `REOPENED`. Estados deliberadamente `RESOLVED` ou `DISMISSED` não são apagados pelo motor. O histórico e o motivo continuam preservados.
