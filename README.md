### Design By Hugo

- Frame: <a href="https://github.com/gohugoio/hugo">**Hugo**</a>

- Theme: <a href="https://github.com/panr/hugo-theme-hello-friend">**hugo-theme-hello-friend**</a>

- Code style: <a href="https://github.com/PrismJS/prism">**prism.js**</a>

### Command

```bash
hugo server --theme=${theme name} -D
```

### workflow
```yaml
name: github pages

on:
  push:
    branches:
      - main # your branch

jobs:
  deploy:
    runs-on: ubuntu-18.04
    steps:
      - uses: actions/checkout@v2
        with:
          submodules: true  # Fetch Hugo themes (true OR recursive)
          fetch-depth: 0    # Fetch all history for .GitInfo and .Lastmod

      - name: Setup Hugo
        uses: peaceiris/actions-hugo@v2
        with:
          hugo-version: '0.74.2'
          # extended: true

      - name: Build
        run: hugo --minify

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./public
```