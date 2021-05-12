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
name: Deploy Hugo # 随意填写

on:
  push:
    branches:
      - master # hugo blog 所在分支

jobs:
  build-deploy:
    runs-on: ubuntu-18.04
    steps:
      - uses: actions/checkout@v1

      - name: Setup Hugo
        uses: peaceiris/actions-hugo@v2
        with:
          hugo-version: latest

      - name: Build 
        run: hugo

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          personal_token: ${{ secrets.personal_token }} # personal_token 这里新建一个 https://github.com/settings/tokens
          EXTERNAL_REPOSITORY: xiaokexiang/xiaokexiang.github.io # 你的github pages的名字
          PUBLISH_BRANCH: master  # 推送到当前 github pages的分支名字
          PUBLISH_DIR: ./public  # hugo 生成到 public 作为跟目录
          commit_message: ${{ github.event.head_commit.message }}
```
