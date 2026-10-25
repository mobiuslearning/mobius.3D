export type AlbumPage = { type: 'photo' | 'video'; src: string; caption?: string; poster?: string };
export type Album = {
  id: string; title: string; subtitle: string; category: '旅途' | '日常' | '片刻';
  color: string; ink: string; cover: string; layout: 'full' | 'inset' | 'type' | 'split';
  date: string; location: string; x: number; z: number; angle: number; pages: AlbumPage[];
};
