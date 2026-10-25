import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { toString } from 'mdast-util-to-string';
import type { RootContent, Nodes, Image, Link, Definition } from 'mdast';
import type { Album, AlbumPage } from './albums';

/** Public paths are relative to public/, never to the Markdown file's directory. */
export function isMediaSource(value: string): boolean {
  if (!value || /[\u0000-\u0020\\]/.test(value)) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password;
  } catch { return false; }
}

function walk(node: Nodes, visit: (node: Nodes) => void) {
  visit(node);
  if ('children' in node) node.children.forEach(child => walk(child, visit));
}

export function parseAlbumPages(body: string, source = '画册'): AlbumPage[] {
  const tree = unified().use(remarkParse).parse(body);
  const definitions = new Map<string, Definition>();
  tree.children.forEach(node => {
    if (node.type === 'definition') definitions.set(node.identifier.toLowerCase(), node);
  });
  const sections: RootContent[][] = [[]];
  for (const node of tree.children) {
    if (node.type === 'thematicBreak') sections.push([]);
    else if (node.type !== 'definition') sections[sections.length - 1].push(node);
  }

  const pages: AlbumPage[] = [];
  for (const section of sections) {
    if (!section.length) continue;
    const label = `${source} 第 ${pages.length + 1} 页`;
    const fail = (message: string): never => { throw new Error(`${label}：${message}`); };
    const images: Image[] = [];
    const videos: Link[] = [];
    const videoLink = (node: Link) => /^(?:视频|video)$/i.test(toString(node).trim()) || /\.(?:mp4|webm|ogv)(?:[?#]|$)/i.test(node.url);

    for (const node of section) walk(node, child => {
      if (child.type === 'html') fail('请使用 ![说明](图片地址) 或 [视频](视频地址)，不支持嵌入 HTML。');
      if (child.type === 'code') fail('请直接填写 Markdown 媒体，不要将书页放进代码块。');
      if (child.type === 'image') images.push(child);
      if (child.type === 'link' && videoLink(child)) videos.push(child);
      if (child.type === 'imageReference' || child.type === 'linkReference') {
        const definition = definitions.get(child.identifier.toLowerCase());
        if (!definition) return fail(`没有找到引用地址 [${child.identifier}]。`);
        if (child.type === 'imageReference') images.push({ type: 'image', url: definition.url, alt: child.alt });
        else {
          const link: Link = { type: 'link', url: definition.url, children: child.children };
          if (videoLink(link)) videos.push(link);
        }
      }
    });

    if (videos.length > 1 || images.length > 1) fail('每页只能放一张照片，或一段视频和一张封面；请用独立一行的 --- 分页。');
    if (!videos.length && !images.length) fail('缺少照片或视频，请添加 ![说明](图片地址) 或 [视频](视频地址)。');
    const src = videos[0]?.url || images[0].url;
    if (!isMediaSource(src)) fail(`媒体地址无效：请使用 /media/... 或完整的 http://、https:// 直链。`);
    const poster = videos.length ? images[0]?.url : undefined;
    if (poster && !isMediaSource(poster)) fail('视频封面地址无效，请使用 /media/... 或完整的 http://、https:// 直链。');

    // Only prose is used as the caption; images and video labels remain media.
    const prose = section.filter(node => node.type !== 'heading' && node.type !== 'html').map(node => {
      const clean = (child: Nodes): Nodes => {
        if (child.type === 'image' || child.type === 'imageReference' || (child.type === 'link' && videoLink(child))) return { type: 'text', value: '' };
        if (child.type === 'linkReference') {
          const def = definitions.get(child.identifier.toLowerCase());
          if (def && videoLink({ type: 'link', url: def.url, children: child.children })) return { type: 'text', value: '' };
        }
        if ('children' in child) return { ...child, children: child.children.map(clean) } as Nodes;
        return child;
      };
      return toString(clean(node)).trim();
    }).filter(Boolean).join('\n\n');
    const alt = images[0]?.alt?.trim();
    const caption = prose || (!videos.length && alt && alt !== '照片' ? alt : undefined);
    pages.push({ type: videos.length ? 'video' : 'photo', src, ...(poster ? { poster } : {}), ...(caption ? { caption } : {}) });
  }
  if (!pages.length) throw new Error(`${source}：画册至少需要一页照片或视频。`);
  return pages;
}

export type AlbumMetadata = Partial<Omit<Album, 'pages' | 'title'>> & {
  title: string; order?: number; draft?: boolean;
};
export type AlbumEntry = { id: string; body?: string; data: AlbumMetadata; filePath?: string };

export function buildProjectAlbums(entries: AlbumEntry[]): Album[] {
  const ids = new Set<string>();
  return entries.filter(entry => !entry.data.draft)
    .sort((a, b) => (a.data.order ?? 100) - (b.data.order ?? 100) || a.id.localeCompare(b.id, 'en'))
    .map((entry, index) => {
      const data = entry.data;
      const id = data.id || entry.id;
      const source = entry.filePath || `${entry.id}.md`;
      if (ids.has(id)) throw new Error(`${source}：画册 id「${id}」重复，请修改文件名或 id。`);
      ids.add(id);
      const pages = parseAlbumPages(entry.body || '', source);
      return {
        id, title: data.title, subtitle: data.subtitle ?? 'MY PERSONAL MEMORIES',
        category: data.category ?? '日常', color: data.color ?? '#40564b', ink: data.ink ?? '#f8f2df',
        cover: data.cover || (pages[0].type === 'photo' ? pages[0].src : pages[0].poster || '/media/video-cover.svg'),
        layout: data.layout ?? 'inset', date: data.date ?? '', location: data.location ?? '我的独家记忆',
        x: data.x ?? -5.6 + (index % 4) * 3.95,
        z: data.z ?? -4.6 + Math.floor(index / 4) * 5.1,
        angle: data.angle ?? 0, pages,
      };
    });
}
