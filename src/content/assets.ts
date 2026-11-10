// 重构时保留下来的图片，文件都在 public/assets/ 下。
export const assets = {
  /**
   * 看板娘抠图：粉发天使，透明底（1148×1800）。
   * 页面加载的是近无损 WebP（和原图每个通道最多差 2 级，571 KB）；同名的 PNG 是原稿（1.2 MB），留着不加载
   */
  characterCutout: 'assets/character-orbit-cutout.webp',
  /** 梦境分类 01：CANDY HEART */
  worksCandyHeart: 'assets/gallery-pink-arrow.webp',
  /** 梦境分类 02：DREAMY FRAMES */
  worksDreamyFrames: 'assets/character-tech.webp',
  /** 梦境分类 03：TINY EVENT */
  worksTinyEvent: 'assets/gallery-team.webp',
  /** 梦境分类 04：TREASURE BOX */
  worksTreasureBox: 'assets/gallery-night.webp',
};
