import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { isMediaSource } from './lib/markdown-albums';

const media = z.string().trim().refine(isMediaSource, '请填写以 / 开头的 public 资源路径，或完整的 http://、https:// 直链');
const color = z.string().regex(/^#[\da-f]{6}$/i, '请使用六位十六进制颜色，例如 #40564b');

const albums = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/albums', deferRender: true }),
  schema: z.object({
    id: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/, 'id 只支持小写字母、数字、短横线和下划线').optional(),
    title: z.string().trim().min(1).max(40),
    subtitle: z.string().default('MY PERSONAL MEMORIES'),
    category: z.enum(['旅途', '日常', '片刻']).default('日常'),
    cover: media.optional(),
    color: color.default('#40564b'),
    ink: color.default('#f8f2df'),
    layout: z.enum(['full', 'inset', 'type', 'split']).default('inset'),
    date: z.string().default(''),
    location: z.string().default('我的独家记忆'),
    order: z.number().int().default(100),
    draft: z.boolean().default(false),
    x: z.number().optional(),
    z: z.number().optional(),
    angle: z.number().default(0),
  }),
});

export const collections = { albums };
