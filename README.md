# 拾光 · FOLIO

使用 **Astro + Three.js + Tailwind CSS 4 + TypeScript** 制作的沉浸式 3D 影音画册。页面静态生成，互动直接运行在浏览器。

## 本地运行

需要 Node.js 22.23.4 或更新版本。

```sh
git clone https://github.com/mobiuslearning/mobius.3D.git
cd mobius.3D
npm ci
npm run dev
```

打开终端输出的本地地址。构建使用 `npm run build`，类型检查使用 `npm run check`，静态产物位于 `dist/`，可部署到任何静态托管服务。

如果使用本次任务已有的本地源码，项目目录为 `/Users/mobius/codex/mobius.3D/folio`，进入该目录后直接运行 `npm run dev` 即可。

受限运行环境中可设置 `ASTRO_TELEMETRY_DISABLED=1`，避免 Astro 尝试写入用户配置目录。

## 浏览体验

- 无限桌面：Three.js 实体书、布纹纸感封面、纸张厚度、木纹桌面、实时光照和投影；平移不受画册边界限制。
- 按住空白区域拖动，滚轮缩放；触屏拖动和双指缩放；双击空白或点击复位回到中心。
- 点击封面后镜头靠近，实体封面打开；点击左右书页或使用方向键翻页，弯曲网格模拟纸张翻动。
- 每页支持照片或视频，以及可选文字。视频通过 Three.js VideoTexture 播放在书页内，离开当前页立即停止并释放视频纹理。
- 分类筛选、可通过键盘操作的画册目录、开关翻页音效、全屏和 ESC 返回。
- 支持减少动效设置。WebGL 不可用时降级为照片和视频双页阅读器。

## 用 Markdown 添加画册

**一本画册对应 `src/content/albums/` 中的一个 `.md` 文件。** 现有 12 本示例也已迁移到这个目录，可以直接编辑。开发模式保存文件后会自动更新；正式网站需要重新运行 `npm run build` 并部署。

最快的方式是复制可直接运行的模板：

```sh
cp docs/album-template.md src/content/albums/my-trip.md
npm run dev
```

不需要修改 TypeScript。文件顶部使用 YAML 配置画册信息，正文按先后顺序生成书页，用前后留有空行的 `---` 分页：

```markdown
---
title: "和你一起的夏天"
category: "旅途"
date: "2026 · SUMMER"
color: "#40564b"
---

## 第一页

![海边的早晨](https://your-cdn.example.com/summer/photo.jpg)

这一页的文字介绍，可以省略。

---

## 第二页

[视频](https://your-cdn.example.com/summer/movie.mp4)

![视频封面](https://your-cdn.example.com/summer/poster.jpg)

这一页是一段影像。视频封面也可以省略。

---

## 第三页

![山间的光](/media/mountain.jpg)
```

示例中的 `your-cdn.example.com` 需替换为自己的媒体地址；`docs/album-template.md` 包含真实可用的示例直链。

### 书页写法

- 照片：`![说明](图片地址)`。每页一张，支持 JPG、PNG、WebP 等浏览器可解码的图片。
- 视频：`[视频](视频地址)`。支持 MP4、WebM 等浏览器可播放的直链，也可以用 `[video](地址)`，包括不带扩展名的带签名 URL。
- 视频封面：在同一页追加 `![视频封面](图片地址)`；不写时使用默认播放封面。
- 文字：在媒体下方写普通 Markdown 段落；粗体、斜体和普通链接的文字会提取成纯文本显示。如果照片页没有正文，则使用图片的说明文字。
- 每页仅放一张照片，或一段视频和一张封面。`## 标题` 只用于组织源文件，不显示在画面中。
- 可混用本地路径和外部 URL。本地文件放在 `public/` 下，例如 `public/media/photo.jpg` 对应 `/media/photo.jpg`，不使用相对于 `.md` 文件的路径。

### 可选配置

只有 `title` 必填，其余字段均有默认值：

| 字段 | 说明 |
| --- | --- |
| `subtitle` | 封面副标题 |
| `category` | `旅途`、`日常`、`片刻`，默认 `日常` |
| `cover` | 封面图片本地路径或 URL；默认使用第一页照片或视频封面 |
| `layout` | `inset`（默认留白照片）、`full`（满版）、`split`（图文分区）、`type`（文字主导） |
| `color` / `ink` | 封面底色、文字色，使用带引号的六位十六进制颜色 |
| `date` / `location` | 时间与地点，日期请写成带引号的字符串 |
| `order` | 排序数字，越小越靠前，默认 `100` |
| `draft` | 设为 `true` 时不在桌面展示 |
| `id` | 默认使用文件名；手动设置时必须唯一，仅支持小写字母、数字、短横线和下划线 |
| `x` / `z` / `angle` | 可选的桌面位置和旋转弧度；不填写时自动按四列排列 |

新画册自动加入分类、目录和总数；桌面超出首屏的内容可通过拖动或画册目录访问。格式或地址写错时，构建会报告具体文件和页码。

### URL 媒体要求

请使用可直接打开图片或视频文件的 **HTTPS 直链**，例如图床或对象存储地址。视频网站的观看页面（如 B 站、YouTube 分享链接）不能作为书页视频。

因为媒体需要作为 Canvas / WebGL 纹理，外部图片、视频和视频封面所在服务器必须允许当前站点的跨域读取（`Access-Control-Allow-Origin` 为本站域名或 `*`）。不允许跨域或有防盗链的地址，即使能在新标签页打开，也可能无法用于 3D 书页。遇到此情况，可将文件放进 `public/media/`，或使用已配置 CORS 的对象存储。签名 URL 到期后需在 Markdown 中更新。

Markdown 中的媒体会随网站构建发布，所有访问者可见；这与浏览器内新建画册的本机保存方式不同。

## 浏览器内新建画册

右上角「新建画册」可选择 JPG、PNG、WebP 照片和 MP4、WebM 视频。支持名称、分类、封面颜色和首张介绍；最多 20 页、总计 200 MB。

上传内容使用 **IndexedDB 仅保存在当前浏览器**，刷新可恢复，不会传到网站服务器。不同设备或域名之间不会同步；清除站点数据会移除自建画册。当前版本不包含账号、云端存储或后台管理。

## 源码结构

```text
src/pages/index.astro   页面与无障碍操作界面
src/styles/global.css  Tailwind CSS 与响应式样式
src/content/albums/     Markdown 画册内容，一本一个文件
src/content.config.ts  画册配置校验与 Astro 内容集合
src/lib/albums.ts       画册类型
src/lib/markdown-albums.ts  Markdown 书页解析与自动布局
src/lib/media.ts        本地与 URL 封面地址处理
src/lib/scene.ts        3D 场景、镜头、手势、开合与翻页
src/lib/textures.ts     封面、内页、木纹和纸边纹理
src/lib/app.ts          交互控制、视频、音效与本地导入
src/lib/storage.ts      IndexedDB 持久化
public/media/          本地示例照片与视频
docs/album-template.md 可复制的 Markdown 画册模板
tests/                 Markdown 解析与内容校验测试
```

运行 `npm test` 验证 Markdown 解析，运行 `npm run check` 检查类型，运行 `npm run build` 校验所有画册并生成网站。

示例照片来自 Pexels；花朵视频与对应封面来自 [MDN CC0 示例视频](https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4)。所有演示内容仅用于展示，可按需替换。
