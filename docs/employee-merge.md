# Mesclagem de funcionários

Mesclagem é uma operação manual para representar a mesma pessoa em cadastros distintos. O RH escolhe cadastro principal e secundário e informa justificativa. Não há mesclagem automática por nome.

Antes da confirmação, o sistema compara matrícula, CPF, jornadas, vínculos de EnNo, apurações por dia e tags. Conflitos de identidade, vigência ou apuração bloqueiam a operação. Tags duplicadas são apenas avisadas.

Quando compatível, os vínculos, jornadas, apurações, inconsistências, ajustes, exceções e tags não duplicadas são transferidos. `RawPunch` nunca é atualizado ou apagado. O secundário recebe status `MERGED`, `mergedIntoId` e evento de auditoria.
