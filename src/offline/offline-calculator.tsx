/** In the offline package the 离线使用 panel needs no caching: this file already is the offline edition. */
export function OfflineCalculator({ zh }: { zh: boolean; panel?: boolean; run?: boolean }) {
  return <p className="text-sm">{zh ? '这就是离线版：不需要网络，数据只保存在这台电脑的浏览器里。' : 'This is the offline edition: no network needed, and data stays in this browser.'}</p>;
}
