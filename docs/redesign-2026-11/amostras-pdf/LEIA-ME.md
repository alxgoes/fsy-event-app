# Amostras fictícias de autorizações

Os 38 PDFs desta pasta foram gerados exclusivamente de `tests/fixtures/inscricoes-2027-sintetica.xlsx`. Não contêm dados de inscrições reais. O modelo original permanece intacto; os documentos têm uma página.

`conferencia-fixture.png` reúne as páginas renderizadas. `conferencia-julia.png` permite conferir acentos e os campos em tamanho integral, incluindo a marcação de sexo presente na fixture. `conferencia-nome-longo.png` usa apenas repetição dos dados da mesma linha fictícia para verificar um nome extenso e informações médicas em duas linhas, sem corte.

Para regenerar os PDFs: `node tests/helpers/pdf-fixture.cjs`.
Para renderizar a folha de conferência no Windows: `powershell -ExecutionPolicy Bypass -File tests/helpers/pdf-contact-sheet.ps1`.

A suíte `tests/authorization-pdf.test.cjs` extrai o texto dos streams reais de cada PDF, compara os campos e confirma as amostras persistidas. A conferência adicional com `pdftotext -enc UTF-8` também passou para os 38 documentos. Nenhum dos PDFs da fixture apresentou aviso de capacidade. Textos excessivos preservam o conteúdo e emitem aviso de redução de escala para conferência antes da impressão.
