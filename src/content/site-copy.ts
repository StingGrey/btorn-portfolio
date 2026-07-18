export type SiteSectionId =
  | 'hero'
  | 'profile'
  | 'works'
  | 'garden'
  | 'moon'
  | 'bits'
  | 'materials'
  | 'notes'
  | 'gallery'
  | 'about'
  | 'contact';

export type EditorField = {
  key: string;
  label: string;
  multiline?: boolean;
  type?: 'text' | 'url';
};

export type EditorSectionDefinition = {
  id: SiteSectionId;
  label: string;
  hint: string;
  fields: EditorField[];
};

export const DEFAULT_SECTION_ORDER: SiteSectionId[] = [
  'hero',
  'profile',
  'works',
  'garden',
  'moon',
  'bits',
  'materials',
  'notes',
  'gallery',
  'about',
  'contact',
];

export const defaultSiteText: Record<string, string> = {
  'hero.code': "const BTORN = composeBits('anime', 'webgl')",
  'hero.core': 'BTORN.init()',
  'hero.tagline': 'curiosity builds worlds',
  'hero.meta.tech': 'THREE.JS / GSAP',
  'hero.meta.interface': 'ANIME INTERFACE',
  'hero.meta.version': 'VERSION 04.30',
  'hero.scroll': 'Scroll to reveal',

  'profile.index': '02 / 看板娘登场',
  'profile.title': '她从光里飘出来的那一瞬，连星星都屏住了呼吸。',
  'profile.body': '她不喜欢正面打招呼，总是先从光里探出半边头。耳朵会跟着风动一下，影子也跟着晃。靠近一点，就能听见她在偷偷哼今天最喜欢的歌。',
  'profile.signal.1': '今日心动',
  'profile.signal.2': '甜甜的风',
  'profile.signal.3': '悄悄上线',
  'profile.chip.1': '心动 ON',
  'profile.chip.2': '闪光 92%',

  'works.heading': '梦境分类',
  'works.item.1.label': 'CANDY HEART',
  'works.item.1.title': '糖心绘卷',
  'works.item.1.desc': '粉粉的箭头是她最喜欢的方向，每次画到这里她都会偷偷脸红，假装是因为今天阳光太亮。',
  'works.item.1.cta': '翻翻心动册',
  'works.item.2.label': 'DREAMY FRAMES',
  'works.item.2.title': '一格一格的梦',
  'works.item.2.desc': '梦里有一格一格的小窗，每打开一扇都会飘出不一样的甜味。她说最想推开的那扇还没找到。',
  'works.item.2.cta': '看看梦境',
  'works.item.3.label': 'TINY EVENT',
  'works.item.3.title': '小心心活动',
  'works.item.3.desc': '今天的小活动是去给路边的猫猫挠下巴，记得带一点小鱼干，还要带上心情最好的那一份。',
  'works.item.3.cta': '看看日程',
  'works.item.4.label': 'TREASURE BOX',
  'works.item.4.title': '我的小宝物',
  'works.item.4.desc': '贴纸盒里住着星星、彩虹、还有一只迷路的小兔子。她每天都会数一遍，怕谁悄悄跑掉。',
  'works.item.4.cta': '看看宝物',

  'garden.index': '04 / 花园午后',
  'garden.title': '下午三点，花瓣轻得像一句没说出口的喜欢。',
  'garden.body': '风把花瓣吹到她的睫毛上，她也没舍得拨开。她说这种小事不要紧，反正今天的猫已经睡饱了。',

  'moon.index': '05 / 月亮档案',
  'moon.title': '月亮今晚有点害羞，只敢露半张脸。',
  'moon.body': '她说没关系，她也是。所以两个人就这样隔着窗户看了好久，谁也没先说一句晚安。',
  'moon.card.1.tag': '月亮',
  'moon.card.1.title': '月亮小剧场',
  'moon.card.2.tag': '台阶',
  'moon.card.2.title': '小天台风声',
  'moon.card.3.tag': '糖糖',
  'moon.card.3.title': '糖果天空',
  'moon.card.4.tag': '靠近',
  'moon.card.4.title': '近距离心跳',

  'bits.index': '06 / 小玩具陈列室',
  'bits.title.1': '今天的糖糖们都拿出来啦~',
  'bits.title.2': '它们也会偷偷醒过来哦。',
  'bits.body': '今天捡到的小宝物：半颗星星、一朵会眨眼的云、还有一阵忘了名字的甜甜的风。她说没关系，反正没记住的就当做明天再认识一次。',
  'bits.kicker': '小窝の七颗心情',
  'bits.command.title': '糖盒里住着七颗小心情，每天醒来都会自己排好队。',
  'bits.command.body': '她说她每天都要数一遍这些糖糖，怕漏掉哪一颗会委屈地哭出来，那样今晚就睡不着啦。',
  'bits.pixel.tag': '不要看啦',
  'bits.pixel.title': '她现在不太好看（其实超好看）',
  'bits.tilt.caption': '今天也想被你偷偷喜欢',
  'bits.tilt.overlay': '摸摸我嘛',

  'materials.index': '07 / 闪光宝物柜',
  'materials.title': '宝物柜的钥匙藏在第三层。',
  'materials.body': '旁边躺着一片去年的樱花瓣，一颗忘了名字的小石头，还有一封她想了很久但没寄出去的信。她说不寄了，反正风也会替她送过去。',
  'materials.item.1.title': '玻璃糖屋',
  'materials.item.1.tag': '小窝 01',
  'materials.item.1.copy': '这是她最喜欢的发呆角落，玻璃外面的世界都被柔成了糖渍味。',
  'materials.item.2.title': '粉粉长廊',
  'materials.item.2.tag': '小窝 02',
  'materials.item.2.copy': '走到长廊尽头就能拐进她的心里，但她不会告诉你密码是什么。',
  'materials.item.3.title': '紫色梦境',
  'materials.item.3.tag': '小窝 03',
  'materials.item.3.copy': '紫色的傍晚最适合躺平，她说她偷偷想把每天都过成这样。',
  'materials.item.4.title': '远空天幕',
  'materials.item.4.tag': '小窝 04',
  'materials.item.4.copy': '远远的天空里有一颗只属于她的小星星，她说它叫「秘密」。',

  'notes.index': '08 / 创作日记',
  'notes.title': '她有一本小日记，里面记满了今天又喜欢了谁。',
  'notes.body': '每一页都被偷偷折了角，那是她准备明天再看一遍的暗号。她说没人知道也没关系，反正记住的人是自己。',
  'notes.item.1.date': '梦境 01',
  'notes.item.1.text': '今天梦见自己变成了一颗会发光的糖，被偷偷藏在最喜欢的人口袋里。',
  'notes.item.2.date': '梦境 02',
  'notes.item.2.text': '梦里下了一场糖果雨，她伸出舌头接到一颗草莓味的小星星。',
  'notes.item.3.date': '梦境 03',
  'notes.item.3.text': '和一只猫坐在云上看日落，云软软的，日落甜甜的，她什么都没说。',
  'notes.item.4.date': '梦境 04',
  'notes.item.4.text': '醒来时枕头上躺着一颗发亮的小石头，她悄悄把它收进糖罐里了。',

  'gallery.index': '09 / 心动小档案',
  'gallery.title': '今天又收集到一些让人心跳加速的瞬间。',
  'gallery.body': '看完之后请记得把心跳借她一下，就一下下哦。她说她会还的，可能会忘记还，但一定会还。',
  'gallery.item.1.title': '粉粉的箭头',
  'gallery.item.1.tag': '一见钟情',
  'gallery.item.2.title': '翻到一半的书',
  'gallery.item.2.tag': '新拣到的',
  'gallery.item.3.title': '蓝色小窗',
  'gallery.item.3.tag': '新拣到的',
  'gallery.item.4.title': '撕下的海报',
  'gallery.item.4.tag': '新拣到的',
  'gallery.item.5.title': '学习小角落',
  'gallery.item.5.tag': '偶尔用功',
  'gallery.item.6.title': '藏起来的宝物',
  'gallery.item.6.tag': '偷偷藏好',

  'about.index': '10 / 设计的小心思',
  'about.title': '可爱不是装出来的。',
  'about.body': '她说她不擅长正经事，但很擅长把每一天都过得像糖纸一样亮亮的。早上醒来先发会儿呆，傍晚等晚霞，深夜数星星。这样的日子也挺好的呀。',

  'contact.index': '11 / 悄悄话',
  'contact.title': 'BTORN',
  'contact.body': '如果你也喜欢这里，那我们一定会成为朋友的呀。',
  'contact.link.1.label': 'GitHub',
  'contact.link.1.href': 'https://github.com/',
  'contact.link.2.label': 'X / Twitter',
  'contact.link.2.href': 'https://x.com/',
  'contact.link.3.label': 'Telegram',
  'contact.link.3.href': 'https://telegram.org/',
  'contact.link.4.label': 'Mail',
  'contact.link.4.href': 'mailto:hello@btorn.dev',
  'contact.terminal': '今日の小心情\n风轻轻的，月亮淡淡的，\n口袋里有半颗化掉的糖。\n今天也想悄悄喜欢你哦 ✦',
};

const field = (key: string, label: string, multiline = false, type: EditorField['type'] = 'text'): EditorField => ({
  key,
  label,
  multiline,
  type,
});

export const editorSections: EditorSectionDefinition[] = [
  {
    id: 'hero',
    label: '首页星球',
    hint: '首页技术标签和引导文字',
    fields: [
      field('hero.code', '代码标签'),
      field('hero.core', '中心文字'),
      field('hero.tagline', '中心副标题'),
      field('hero.meta.tech', '左侧技术标签'),
      field('hero.meta.interface', '中间风格标签'),
      field('hero.meta.version', '右侧版本标签'),
      field('hero.scroll', '下滑提示'),
    ],
  },
  {
    id: 'profile',
    label: '看板娘登场',
    hint: '人物登场章节的标题、正文与状态标签',
    fields: [
      field('profile.index', '章节编号'),
      field('profile.title', '标题', true),
      field('profile.body', '正文', true),
      field('profile.signal.1', '状态一'),
      field('profile.signal.2', '状态二'),
      field('profile.signal.3', '状态三'),
      field('profile.chip.1', '画面标签一'),
      field('profile.chip.2', '画面标签二'),
    ],
  },
  {
    id: 'works',
    label: '梦境分类',
    hint: '作品分类、标题、介绍和按钮文字',
    fields: [
      field('works.heading', '区块标题'),
      ...Array.from({ length: 4 }, (_, index) => {
        const item = index + 1;
        return [
          field(`works.item.${item}.label`, `分类 ${item} 英文名`),
          field(`works.item.${item}.title`, `分类 ${item} 标题`),
          field(`works.item.${item}.desc`, `分类 ${item} 介绍`, true),
          field(`works.item.${item}.cta`, `分类 ${item} 按钮`),
        ];
      }).flat(),
    ],
  },
  {
    id: 'garden',
    label: '花园午后',
    hint: '花园章节文字',
    fields: [field('garden.index', '章节编号'), field('garden.title', '标题', true), field('garden.body', '正文', true)],
  },
  {
    id: 'moon',
    label: '月亮档案',
    hint: '月亮章节和四张场景卡片',
    fields: [
      field('moon.index', '章节编号'),
      field('moon.title', '标题', true),
      field('moon.body', '正文', true),
      ...Array.from({ length: 4 }, (_, index) => {
        const item = index + 1;
        return [field(`moon.card.${item}.tag`, `卡片 ${item} 标签`), field(`moon.card.${item}.title`, `卡片 ${item} 标题`)];
      }).flat(),
    ],
  },
  {
    id: 'bits',
    label: '小玩具陈列室',
    hint: '玩具章节、糖盒和图片卡片文案',
    fields: [
      field('bits.index', '章节编号'),
      field('bits.title.1', '轮播标题一'),
      field('bits.title.2', '轮播标题二'),
      field('bits.body', '正文', true),
      field('bits.kicker', '糖盒标签'),
      field('bits.command.title', '糖盒标题', true),
      field('bits.command.body', '糖盒正文', true),
      field('bits.pixel.tag', '像素卡标签'),
      field('bits.pixel.title', '像素卡标题'),
      field('bits.tilt.caption', '倾斜卡提示'),
      field('bits.tilt.overlay', '倾斜卡悬浮文字'),
    ],
  },
  {
    id: 'materials',
    label: '闪光宝物柜',
    hint: '素材章节和四组收藏内容',
    fields: [
      field('materials.index', '章节编号'),
      field('materials.title', '标题', true),
      field('materials.body', '正文', true),
      ...Array.from({ length: 4 }, (_, index) => {
        const item = index + 1;
        return [
          field(`materials.item.${item}.title`, `宝物 ${item} 标题`),
          field(`materials.item.${item}.tag`, `宝物 ${item} 标签`),
          field(`materials.item.${item}.copy`, `宝物 ${item} 介绍`, true),
        ];
      }).flat(),
    ],
  },
  {
    id: 'notes',
    label: '创作日记',
    hint: '日记章节和四条梦境记录',
    fields: [
      field('notes.index', '章节编号'),
      field('notes.title', '标题', true),
      field('notes.body', '正文', true),
      ...Array.from({ length: 4 }, (_, index) => {
        const item = index + 1;
        return [field(`notes.item.${item}.date`, `日记 ${item} 日期`), field(`notes.item.${item}.text`, `日记 ${item} 内容`, true)];
      }).flat(),
    ],
  },
  {
    id: 'gallery',
    label: '心动小档案',
    hint: '画廊章节和六张作品卡片',
    fields: [
      field('gallery.index', '章节编号'),
      field('gallery.title', '标题', true),
      field('gallery.body', '正文', true),
      ...Array.from({ length: 6 }, (_, index) => {
        const item = index + 1;
        return [field(`gallery.item.${item}.tag`, `卡片 ${item} 标签`), field(`gallery.item.${item}.title`, `卡片 ${item} 标题`)];
      }).flat(),
    ],
  },
  {
    id: 'about',
    label: '设计的小心思',
    hint: '设计理念章节文字',
    fields: [field('about.index', '章节编号'), field('about.title', '标题'), field('about.body', '正文', true)],
  },
  {
    id: 'contact',
    label: '悄悄话',
    hint: '页脚文案、联系方式和终端小纸条',
    fields: [
      field('contact.index', '章节编号'),
      field('contact.title', '标题'),
      field('contact.body', '正文', true),
      ...Array.from({ length: 4 }, (_, index) => {
        const item = index + 1;
        return [
          field(`contact.link.${item}.label`, `链接 ${item} 名称`),
          field(`contact.link.${item}.href`, `链接 ${item} 地址`, false, 'url'),
        ];
      }).flat(),
      field('contact.terminal', '终端小纸条', true),
    ],
  },
];

export const editorSectionById = Object.fromEntries(editorSections.map((section) => [section.id, section])) as Record<SiteSectionId, EditorSectionDefinition>;
