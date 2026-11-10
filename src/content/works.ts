import { assets } from './assets';

export const worksHeading = '梦境分类';

export type WorkCategory = {
  id: string;
  file: string;
  label: string;
  title: string;
  desc: string;
  cta: string;
  href: string;
  src: string;
};

export const workCategories: WorkCategory[] = [
  {
    id: '01',
    file: 'dream_01',
    label: 'CANDY HEART',
    title: '糖心绘卷',
    desc: '粉粉的箭头是她最喜欢的方向，每次画到这里她都会偷偷脸红，假装是因为今天阳光太亮。',
    cta: '翻翻心动册',
    href: '#works',
    src: assets.worksCandyHeart,
  },
  {
    id: '02',
    file: 'dream_02',
    label: 'DREAMY FRAMES',
    title: '一格一格的梦',
    desc: '梦里有一格一格的小窗，每打开一扇都会飘出不一样的甜味。她说最想推开的那扇还没找到。',
    cta: '看看梦境',
    href: '#works',
    src: assets.worksDreamyFrames,
  },
  {
    id: '03',
    file: 'dream_03',
    label: 'TINY EVENT',
    title: '小心心活动',
    desc: '今天的小活动是去给路边的猫猫挠下巴，记得带一点小鱼干，还要带上心情最好的那一份。',
    cta: '看看日程',
    href: '#works',
    src: assets.worksTinyEvent,
  },
  {
    id: '04',
    file: 'dream_04',
    label: 'TREASURE BOX',
    title: '我的小宝物',
    desc: '贴纸盒里住着星星、彩虹、还有一只迷路的小兔子。她每天都会数一遍，怕谁悄悄跑掉。',
    cta: '看看宝物',
    href: '#works',
    src: assets.worksTreasureBox,
  },
];
