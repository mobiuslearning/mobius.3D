/** Retain short names in existing browser albums while accepting absolute media URLs. */
export function coverSource(cover: string): string {
  return /^(?:https?:\/\/|blob:|\/)/i.test(cover) ? cover : `/media/${cover}.jpg`;
}
