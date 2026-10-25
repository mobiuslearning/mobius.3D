# 拾光 · FOLIO

使用 **Astro + Three.js + Tailwind CSS 4 + TypeScript** 制作的沉浸式 3D 影音画册。页面静态生成，互动直接运行在浏览器。

## 本地运行

```sh
cd /Users/mobius/codex/mobius.3D/folio
npm ci
npm run dev
```

打开终端输出的本地地址。构建使用 `npm run build`，类型检查使用 `npm run check`，静态产物位于 `dist/`，可部署到任何静态托管服务。

受限运行环境中可设置 `ASTRO_TELEMETRY_DISABLED=1`，避免 Astro 尝试写入用户配置目录。

## 浏览体验

- 无限桌面：Three.js 实体书、布纹纸感封面、纸张厚度、木纹桌面、实时光照和投影；平移不受画册边界限制。
- 按住空白区域拖动，滚轮缩放；触屏拖动和双指缩放；双击空白或点击复位回到中心。
- 点击封面后镜头靠近，实体封面打开；点击左右书页或使用方向键翻页，弯曲网格模拟纸张翻动。
- 每页支持照片或视频，以及可选文字。视频通过 Three.js VideoTexture 播放在书页内，离开当前页立即停止并释放视频纹理。
- 分类筛选、可通过键盘操作的画册目录、开关翻页音效、全屏和 ESC 返回。
- 支持减少动效设置。WebGL 不可用时降级为照片和视频双页阅读器。

## 替换正式内容

示例画册定义在 `src/lib/albums.ts`，媒体放在 `public/media/`。每册配置名称、封面布局、颜色、桌面位置、分类和页数组：

```ts
pages: [
  { type: 'photo', src: '/media/photo.jpg', caption: '可选的文字介绍' },
  { type: 'video', src: '/media/video.mp4', poster: '/media/poster.jpg', caption: '可选' },
]
```

封面布局支持 `full`（满版照片）、`inset`（留白照片）、`split`（图文分区）、`type`（文字主导）。封面和内页由 Canvas 生成纹理，书本、封面铰链、纸张翻动均在 Three.js 场景内实现。

## 浏览器内新建画册

右上角「新建画册」可选择 JPG、PNG、WebP 照片和 MP4、WebM 视频。支持名称、分类、封面颜色和首张介绍；最多 20 页、总计 200 MB。

上传内容使用 **IndexedDB 仅保存在当前浏览器**，刷新可恢复，不会传到网站服务器。不同设备或域名之间不会同步；清除站点数据会移除自建画册。当前版本不包含账号、云端存储或后台管理。

## 源码结构

```text
src/pages/index.astro   页面与无障碍操作界面
src/styles/global.css  Tailwind CSS 与响应式样式
src/lib/albums.ts       示例画册数据与类型
src/lib/scene.ts        3D 场景、镜头、手势、开合与翻页
src/lib/textures.ts     封面、内页、木纹和纸边纹理
src/lib/app.ts          交互控制、视频、音效与本地导入
src/lib/storage.ts      IndexedDB 持久化
public/media/          本地示例照片与视频
```

示例照片来自 Pexels；花朵视频与对应封面来自 [MDN CC0 示例视频](https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4)。所有演示内容仅用于展示，可按需替换。
