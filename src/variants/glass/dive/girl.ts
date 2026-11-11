// 芯片顶盖上的小女孩：烘焙好的帧（chip-girl.bin，zlib）第一次要用时再去拿、解压。
// 拿到之前顶盖上只有金属，不会报错。

import binUrl from './chip-girl.bin?url';
import { CHIP_GIRL } from './chipGirl';

let frames: Uint8Array | null = null;
let started = false;

export function girlFrames() {
  if (!started) {
    started = true;
    fetch(binUrl)
      .then((response) => {
        if (!response.ok || !response.body) throw new Error(`chip girl ${response.status}`);
        return new Response(response.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
      })
      .then((buffer) => {
        const data = new Uint8Array(buffer);
        if (data.length === CHIP_GIRL.size * CHIP_GIRL.size * CHIP_GIRL.frames) frames = data;
      })
      .catch((error: unknown) => console.warn(error));
  }
  return frames;
}
