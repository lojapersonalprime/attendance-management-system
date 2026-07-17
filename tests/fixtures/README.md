# Fixtures de importação

`attendlog-synthetic.txt` é um fixture pequeno, totalmente fictício e versionado. Ele usa UTF-16 LE com BOM, campos tabulados e a estrutura de um relatório `AttendLog`. Os nomes, identificadores e horários foram criados exclusivamente para testes.

O repositório público não aceita arquivos reais do relógio. Nunca envie nomes, matrículas, `EnNo`, horários, relatórios, backups ou dados pessoais em commits, issues ou pull requests.

Para validar localmente um arquivo real, mantenha uma cópia apenas fora do Git em `tests/fixtures/AGL_001.TXT` ou em outro diretório privado. Esse caminho é ignorado pelo Git. A codificação esperada pelo parser é UTF-16 LE com BOM.

Se for necessário reproduzir um problema, crie um fixture sintético mínimo que preserve somente a estrutura necessária e anonimize todos os campos.
