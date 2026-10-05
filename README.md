# Menu

PWA que lista automaticamente os PWAs públicos publicados em `viniciusnevesdev`.

Um app aparece no menu sem edição manual quando:
- o repositório é público;
- GitHub Pages está ativado;
- há um manifesto PWA (`manifest.webmanifest`, `manifest.json` ou `site.webmanifest`) com `display` standalone, minimal-ui ou fullscreen.

A listagem é buscada do GitHub sempre que o Menu abre ou quando se toca em **Atualizar**. O menu lê o nome, o ícone e a URL inicial diretamente do manifesto de cada app.
