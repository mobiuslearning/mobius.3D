import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseAlbumPages, buildProjectAlbums, isMediaSource } from '../src/lib/markdown-albums.ts';
import { coverSource } from '../src/lib/media.ts';

test('reads mixed pages, signed remote URLs and optional prose captions in order', () => {
  const pages = parseAlbumPages(`## 第一页\n\n![海边](/media/coast.jpg)\n\n留住 **这一刻**。\n\n---\n\n[视频](https://cdn.example.com/play?id=2&token=abc)\n\n![封面](https://cdn.example.com/poster.jpg)\n\n风的声音。\n\n---\n\n![远山](https://cdn.example.com/a%20b.jpg?width=1200)`);
  assert.deepEqual(pages, [
    { type: 'photo', src: '/media/coast.jpg', caption: '留住 这一刻。' },
    { type: 'video', src: 'https://cdn.example.com/play?id=2&token=abc', poster: 'https://cdn.example.com/poster.jpg', caption: '风的声音。' },
    { type: 'photo', src: 'https://cdn.example.com/a%20b.jpg?width=1200', caption: '远山' },
  ]);
});

test('a video may omit its poster and caption, including a signed URL with a fragment', () => {
  assert.deepEqual(parseAlbumPages('[播放](https://cdn.example.com/movie.webm?signature=abc#t=2)'), [
    { type: 'video', src: 'https://cdn.example.com/movie.webm?signature=abc#t=2' },
  ]);
});

test('resolves Markdown references across page boundaries without turning definitions into pages', () => {
  const pages = parseAlbumPages(`![海][photo]\n\n---\n\n[视频][clip]\n\n![封面][photo]\n\n[photo]: https://cdn.example.com/sea.jpg\n[clip]: https://cdn.example.com/play?id=2`);
  assert.equal(pages.length, 2);
  assert.equal(pages[0].src, 'https://cdn.example.com/sea.jpg');
  assert.equal(pages[1].src, 'https://cdn.example.com/play?id=2');
  assert.equal(pages[1].poster, pages[0].src);
  assert.equal(pages[1].caption, undefined);
});

test('reports authoring mistakes with the source filename and page number', () => {
  const cases = [
    ['普通文字，没有媒体', /缺少照片或视频/],
    ['![](/a.jpg)\n\n![](/b.jpg)', /每页只能/],
    ['[视频](/a.mp4)\n\n[视频](/b.mp4)', /每页只能/],
    ['![](../private.jpg)', /媒体地址无效/],
    ['![](javascript:alert)', /媒体地址无效/],
    ['[视频](/a.mp4)\n\n![](data:image/png;base64,abc)', /封面地址无效/],
    ['<video src="/a.mp4"></video>', /不支持嵌入 HTML/],
    ['```markdown\n![](/a.jpg)\n```', /不要将书页放进代码块/],
    ['![照片][missing]', /缺少照片或视频/],
  ];
  for (const [body, expected] of cases) {
    assert.throws(() => parseAlbumPages(body, 'my-trip.md'), error => {
      assert.match(error.message, /^my-trip\.md 第 1 页：/);
      assert.match(error.message, expected);
      return true;
    });
  }
  assert.throws(() => parseAlbumPages('', 'empty.md'), /empty\.md：画册至少需要一页/);
});

test('filters drafts, applies stable ordering, derives covers and lays out new albums', () => {
  const entries = [
    { id: 'draft', body: '', data: { title: '草稿', draft: true } },
    { id: 'b', body: '[视频](https://cdn.example.com/b.mp4)', data: { title: '视频册', order: 2 } },
    { id: 'a', body: '![](https://cdn.example.com/a.jpg)', data: { title: '照片册', order: 1, x: 0, z: 0 } },
  ];
  const albums = buildProjectAlbums(entries);
  assert.deepEqual(albums.map(album => album.id), ['a', 'b']);
  assert.equal(albums[0].cover, 'https://cdn.example.com/a.jpg');
  assert.equal(albums[0].x, 0);
  assert.equal(albums[0].z, 0);
  assert.equal(albums[1].cover, '/media/video-cover.svg');
  assert.equal(albums[1].category, '日常');
  assert.ok(Number.isFinite(albums[1].x));
  assert.ok(Number.isFinite(albums[1].z));
  assert.throws(() => buildProjectAlbums([entries[2], { ...entries[1], data: { title: '重复', id: 'a' } }]), /id「a」重复/);
});

test('accepts only public paths and absolute HTTP(S) media URLs', () => {
  for (const src of ['/media/a.jpg', 'https://cdn.example.com/a.jpg', 'http://localhost:4500/a.mp4']) assert.equal(isMediaSource(src), true, src);
  for (const src of ['', '//example.com/a.jpg', '../a.jpg', 'file:///a.jpg', 'data:text/html,abc', 'https://user:password@example.com/a.jpg', '/\\example.com/a.jpg', '/a b.jpg']) assert.equal(isMediaSource(src), false, src);
  assert.equal(coverSource('coast'), '/media/coast.jpg');
  assert.equal(coverSource('https://cdn.example.com/cover.jpg?a=1'), 'https://cdn.example.com/cover.jpg?a=1');
  assert.equal(coverSource('blob:https://example.com/1'), 'blob:https://example.com/1');
});

test('the copyable Markdown template includes working local, remote photo and remote video syntax', async () => {
  const template = await readFile(new URL('../docs/album-template.md', import.meta.url), 'utf8');
  const body = template.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  const pages = parseAlbumPages(body, 'docs/album-template.md');
  assert.equal(pages.length, 3);
  assert.equal(pages[0].src, '/media/coast.jpg');
  assert.match(pages[1].src, /^https:\/\/images\.pexels\.com\//);
  assert.equal(pages[2].type, 'video');
  assert.equal(pages[2].poster, '/media/flower.jpg');
});
