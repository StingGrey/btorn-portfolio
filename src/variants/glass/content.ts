import type { ConsoleCopy } from '../../components/DreamConsole';
import { assets } from '../../content/assets';

export const tagline = 'a tiny universe of soft things';

export type Channel = {
  id: string;
  number: string;
  title: string;
  osd: string;
  desc: string;
  src: string;
  /** 竖图在 4:3 屏幕上取景时，往上偏一点，留住脸 */
  focusY: number;
};

export const channels: Channel[] = [
  {
    id: 'candy',
    number: '01',
    title: 'Candy Heart',
    osd: 'CANDY HEART',
    desc: 'Pink arrows are her favorite direction. She blushes every time she draws one and blames the sunlight.',
    src: assets.worksCandyHeart,
    focusY: 0.5,
  },
  {
    id: 'dreamy',
    number: '02',
    title: 'Dreamy Frames',
    osd: 'DREAMY FRAMES',
    desc: 'A dream made of little windows. Each one she opens smells a little sweeter, and the one she wants most is still out there.',
    src: assets.worksDreamyFrames,
    focusY: 0.7,
  },
  {
    id: 'tiny',
    number: '03',
    title: 'Tiny Event',
    osd: 'TINY EVENT',
    desc: "Today's tiny event: chin scratches for the street cat. Bring fish snacks and your best mood.",
    src: assets.worksTinyEvent,
    focusY: 0.62,
  },
  {
    id: 'treasure',
    number: '04',
    title: 'Treasure Box',
    osd: 'TREASURE BOX',
    desc: 'A sticker box of stars, rainbows and one lost bunny. She counts them every day in case someone sneaks away.',
    src: assets.worksTreasureBox,
    focusY: 0.68,
  },
];

/** 方案 D 里「梦境分类」控制台的英文版文案 */
export const consoleCopy: ConsoleCopy = {
  heading: 'Dream Index',
  playing: 'PLAYING',
  paused: 'PAUSED',
  items: channels.map((channel, index) => ({
    id: channel.number,
    file: `dream_${channel.number}`,
    label: channel.osd,
    title: channel.title,
    desc: channel.desc,
    cta: ['Flip the sketchbook', 'Peek inside', 'See the plan', 'Open the box'][index],
    href: '#signal',
    src: channel.src,
  })),
};
