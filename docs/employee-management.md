# Gestão de funcionários

Funcionários podem ser criados manualmente antes de receber marcações ou podem nascer provisórios durante uma importação. O fluxo de conclusão exige nome completo, tipo de vínculo, status, unidade e data de admissão. A jornada é opcional: se estiver ausente, o sistema mantém `MISSING_SCHEDULE` e não inventa horário.

Matrícula e CPF são opcionais e únicos apenas quando preenchidos. Nome não é chave única. CPF aparece mascarado em telas de leitura e é mascarado em `AuditLog` geral.

Unidade, setor e cargo são cadastros estruturados. A inativação conserva funcionários históricos e bloqueia novas associações até reativação. Tags são exclusivamente organizacionais e de filtro.

Vínculos de relógio usam `deviceId`, EnNo e vigência. O nome original do relógio é apenas referência. A tela mascara o DeviceUID e permite encerrar ou criar novo vínculo mantendo o histórico. Ao importar um período que não esteja coberto por um vínculo existente, o sistema cria cadastro provisório para a janela ainda desconhecida sem alterar vínculos antigos.
