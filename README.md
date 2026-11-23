# 学术个人主页

本站通过 GitHub Pages 发布，支持在网页中更新头像、个人资料、教育经历和论文。

- [公开主页](https://mengbieryzj.github.io/)
- [编辑主页](https://mengbieryzj.github.io/edit/)

## 网页编辑与发布

1. 打开编辑页，填写资料。头像支持图片链接或上传 JPEG、PNG、WebP 文件。教育经历按添加顺序显示，论文按年份从新到旧显示。
2. 点击「保存草稿并预览」，查看当前浏览器保存的草稿。通过页脚「编辑主页」返回编辑。
3. 在 GitHub [创建细粒度访问令牌](https://github.com/settings/personal-access-tokens/new?name=Academic%20Homepage&target_name=MengbierYzj&contents=write)，将仓库范围设为仅 `MengbierYzj.github.io`，并给予 `Contents` 的 `Read and write` 权限。
4. 在编辑页填写令牌并点击「发布到 GitHub」。页面把资料提交到 `main` 分支的 `content.json`，GitHub Pages 随后自动部署。令牌仅供当前请求使用。

多人或多设备编辑时，若 GitHub 上的内容已更新，编辑页会停止发布并保留本地草稿。可先复制需要保留的内容，再点击「加载 GitHub 最新版」继续编辑。论文链接可使用完整 DOI 网址，例如 `https://doi.org/…`。

## 本地查看

在项目目录中运行下列命令，然后打开 [本地主页](http://127.0.0.1:8000/) 或 [本地编辑页](http://127.0.0.1:8000/edit/)。

```sh
python -m http.server 8000 --bind 127.0.0.1
```

GitHub Pages 的发布源为 `main` 分支根目录。站点使用原生 HTML、CSS 和 JavaScript，资料保存在 `content.json`。
