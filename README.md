# MenuDePWAs PWA v2

Catálogo estático em `/Menu/`, sem servidor, banco ou login. Interface em português, busca, aparência clara/escura e suporte a instalação pelo Safari (Compartilhar > Adicionar à Tela de Início). Sem fontes, scripts ou dependências de CDN.

## Uso e dados locais

O botão `+` adiciona um app com nome e URL http/https. Grupo e ícone são opcionais. Os links abrem diretamente em outra aba; o comportamento final de abertura depende do iOS e do app de destino. Apps manuais podem ser editados, ocultados e excluídos com confirmação. Apps automáticos só podem ser ocultados. `Ocultos`, no final da página, permite restaurar cada item. Um grupo inteiramente oculto desaparece da lista principal.

A identidade automática é repositório + caminho do manifesto, independente de nome ou URL. O manifesto principal e subapps normais ficam visíveis; arquivos de versões e testes ficam em `Versões e testes (N)`. A entrada duplicada e comprovadamente indisponível Controle-financeiro/source/public (HTTP 404) foi removida; as outras 40 entradas GitHub foram preservadas; as 14 entradas de cronometro-oficial continuam acessíveis, com 13 recolhidas. A busca também encontra versões recolhidas.

Apps manuais, IDs ocultos, preferências e contador de alterações ficam em `localStorage` (`menu-pwa-local-v2`), separados do cache do catálogo. Atualizar a lista não altera esses dados nem incrementa o contador. Adicionar, editar, ocultar, restaurar, excluir e mudar a aparência incrementam o contador. Abrir gaveta ou expandir versões não incrementa. Navegadores, dispositivos e outros caminhos/origens não sincronizam esses dados. Limpar os dados do Safari, usar navegação privada ou remover o armazenamento pode apagá-los. Falhas ao gravar são avisadas; exporte antes de sair.

## Backup JSON

No menu lateral, `Exportar backup JSON` usa Web Share com arquivo quando suportado e download como alternativa. O formato é `{format:"menu-pwa-backup", version:2, exportedAt, manual, hiddenIds, settings}`. Não contém senhas nem o catálogo remoto. Exportar inclui apps manuais ocultos. Uma confirmação do compartilhamento ou o início do download zera o contador e registra a exportação; cancelar o compartilhamento não zera. Isso **não garante que o arquivo foi salvo**: confira em Arquivos. Se os dados mudarem enquanto a folha está aberta, o contador é conservado.

Importar valida versão, campos, URLs, tamanho (5 MB), preferências e duplicatas manuais antes de mostrar a prévia. Nada é alterado antes de `Confirmar importação`. A opção padrão mescla: mantém apps locais e ignora duplicatas por URL, ajustando IDs ocultos quando necessário. Ocultos são unidos. `Substituir meus dados locais` substitui apps, ocultos e preferências explicitamente. A aparência do arquivo é aplicada nos dois modos. Depois de importar, o contador fica zerado porque o arquivo é o backup de origem; a data da última exportação permanece separada da importação.

URLs de apps privados adicionadas manualmente permanecem somente no aparelho e nos arquivos exportados. Proteja seus backups: podem revelar links e nomes pessoais. Não inclua credenciais em URLs. Nenhum backup é enviado pelo Menu a um serviço; o destino do compartilhamento é escolhido por você. Abrir apps e carregar seus ícones faz solicitações aos respectivos sites, que recebem os dados normais de conexão. Ícones externos usam política sem referrer; falhas tentam apple-touch-icon/favicon e terminam em monograma, sem imagem quebrada.

## Catálogo público

`.github/workflows/atualizar-catalogo-pwas.yml` mantém a agenda horária (`17 * * * *`), execução manual e atualização em main. `scripts/build-catalog.cjs` usa a API apenas na Action, com as credenciais do ambiente GitHub. Só repositórios públicos enumerados podem aparecer, inclusive em falhas. Repositórios sem Pages ou manifesto válido aparecem em `Sem publicação`, com link para o GitHub. Manifestos válidos de arquivos e betas são preservados individualmente. Falhas transitórias na árvore/manifesto conservam os itens anteriores daquele repositório público; árvores truncadas são tratadas como falha. Razões de falha são códigos fixos, sem mensagens que possam incluir segredos. Repositórios que deixam de ser públicos não são conservados.

O gerador publica `{schema:2,generatedAt,apps,repositories,failures}`. O navegador aceita schema 1 e 2, carrega `./apps.json` ao abrir e ao tocar em `Atualizar lista`, usando rede primeiro e fallback local/offline. Não consulta a API do GitHub. A data exibida é a geração do catálogo; o agendamento pode atrasar e as informações não são verificadas ao vivo pelo aparelho. O arquivo inicial inclui 40 entradas GitHub válidas e a entrada pública Cloudflare. A lista completa de repositórios sem publicação será preenchida na próxima execução autorizada da Action.

`public-cloudflare-apps.json` é um registro público opt-in, inicialmente apenas `bibliopromptos.pages.dev`, ligado ao repositório público bibliopromptos. O gerador exige repositório público e HTTPS em pages.dev; evita duplicar URL ou repo já descoberto. Não enumera projetos Cloudflare privados e não usa token Cloudflare. Outros projetos só entram após revisão explícita do registro ou como adição manual local. Domínios de afazeres-pwa, painel-simulacro e gerenciador-matrizes não são publicados automaticamente.

## Offline e segurança do cache

`sw.js` usa `menu-pwas-v10`, registrado uma única vez, e limpa **apenas** caches antigos com prefixo `menu-pwas-`. Nunca apaga caches de outros apps da origem compartilhada GitHub Pages. Intercepta somente os próprios arquivos e navegação exata do Menu, sem cache de URLs externas. Rede primeiro, fallback local para navegação e catálogo; respostas HTTP com erro não substituem a cópia offline. A primeira abertura precisa de rede para instalar o cache; apps externos não ganham modo offline por estarem neste Menu. A correção impede novas exclusões indevidas, mas não recupera caches apagados pelo worker antigo.

## Validação local

Sem dependências para os testes de regras e service worker:

```sh
node --test tests/*.test.cjs
node --check app.js
node --check lib.js
node --check sw.js
node --check scripts/build-catalog.cjs
```

Smoke opcional com Playwright e Chrome já instalados, sem baixar dependências:

```sh
PLAYWRIGHT_MODULE=/caminho/para/playwright CHROME_PATH=/caminho/para/chrome node tests/browser-smoke.cjs
```

O smoke serve somente os arquivos do app em `/Menu/`, usa viewport móvel e verifica catálogo, versões, ocultos, CRUD, persistência, contador, compartilhamento cancelado/concluído, download, importação com prévia, preservação de cache alheio e navegação offline. Chrome não substitui uma validação em iPhone real, principalmente da folha Compartilhar e da instalação PWA. Para inspecionar manualmente, sirva este diretório com um servidor estático local.

## Rollback

Ponto anterior preservado na tag remota `menu-pre-redesign-2026-11-04`. Nenhum histórico foi removido. Um responsável pode restaurar os arquivos revisados dessa tag em um novo commit e publicar pelo fluxo normal, sem reset ou force push. **Não republicar o `sw.js` antigo sem manter a limpeza restrita ao prefixo**: a tag contém o defeito de exclusão de caches. Antes de rollback ou limpeza de dados, exporte o backup local; a versão antiga não entende os dados v2. Esta implementação não faz push nem deploy.
\n## Identidade e ícones (04/11/2026)\nNome oficial: **MenuDePWAs**. Repositório e URL existentes preservados. Controles usam somente os SVGs originais da biblioteca oficial MMU v0.0.12 em assets/icons/. Um olho riscado oculta; um olho aberto reexibe; a divulgação de detalhes usa chevron SVG. Logos próprios dos PWAs e logotipo já existente do aplicativo permanecem como identidade visual, não como ícones de controles. Os direitos de redistribuição dos SVGs derivados de SF Symbols ainda precisam ser verificados.\n