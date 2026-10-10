/* =========================================================
   音效模块 · 基于 Web Audio API 合成像素风音效（无需音频文件）
   首次用户点击时自动初始化 AudioContext
   ========================================================= */
const Sound = (() => {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* 单个音符：freq 频率 / dur 时长(s) / type 波形 / vol 音量 / delay 延迟 / slide 滑音目标 */
  function tone(freq, dur = 0.08, opts = {}) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const { type = 'square', vol = 0.05, delay = 0, slide = 0 } = opts;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  return {
    /* 在首次用户手势时调用，解锁音频上下文 */
    unlock() { ensure(); },
    setMuted(v) { muted = !!v; },
    isMuted() { return muted; },

    /* 点击按钮 / 日期格子 */
    click() { tone(1150, 0.045, { vol: 0.035 }); },

    /* 打开详情 */
    open() {
      tone(660, 0.06);
      tone(880, 0.07, { delay: 0.06 });
    },

    /* 关闭详情 */
    close() {
      tone(620, 0.06, { vol: 0.04 });
      tone(440, 0.08, { delay: 0.05, vol: 0.04 });
    },

    /* 打勾完成 */
    check() {
      tone(740, 0.07, { type: 'triangle', vol: 0.055 });
      tone(1108, 0.13, { delay: 0.07, type: 'triangle', vol: 0.055 });
    },

    /* 取消打勾 */
    uncheck() {
      tone(700, 0.07, { type: 'triangle', vol: 0.045 });
      tone(466, 0.12, { delay: 0.07, type: 'triangle', vol: 0.045 });
    },

    /* 添加任务 */
    add() {
      tone(520, 0.05);
      tone(780, 0.09, { delay: 0.05 });
    },

    /* 删除任务 */
    remove() {
      tone(360, 0.06, { type: 'sawtooth', vol: 0.03 });
      tone(230, 0.1, { delay: 0.05, type: 'sawtooth', vol: 0.03 });
    },

    /* 边界 / 无效操作 */
    error() { tone(196, 0.13, { type: 'sawtooth', vol: 0.03 }); },

    /* 隐藏任务解锁：上行琶音 fanfare */
    hidden() {
      const seq = [523, 659, 784, 1047, 1319];
      seq.forEach((f, i) => tone(f, 0.13, { delay: i * 0.085, type: 'triangle', vol: 0.06 }));
      tone(1568, 0.42, { delay: seq.length * 0.085, type: 'triangle', vol: 0.05 });
    },

    /* 戳小人 */
    pet() {
      tone(880, 0.05, { type: 'triangle', vol: 0.05 });
      tone(1175, 0.09, { delay: 0.05, type: 'triangle', vol: 0.05 });
    },

    /* 切换主题 */
    theme() {
      tone(440, 0.05, { vol: 0.04 });
      tone(660, 0.08, { delay: 0.05, vol: 0.04 });
    },

    /* 进入专注模式 */
    focusStart() {
      tone(523, 0.09, { type: 'triangle', vol: 0.05 });
      tone(784, 0.16, { delay: 0.1, type: 'triangle', vol: 0.05 });
    },

    /* 离开专注模式 */
    focusEnd() {
      tone(784, 0.09, { type: 'triangle', vol: 0.05 });
      tone(587, 0.12, { delay: 0.09, type: 'triangle', vol: 0.045 });
      tone(392, 0.2, { delay: 0.2, type: 'triangle', vol: 0.045 });
    },

    /* 新伙伴登场 */
    animal() {
      tone(659, 0.08, { type: 'triangle', vol: 0.055 });
      tone(880, 0.08, { delay: 0.08, type: 'triangle', vol: 0.055 });
      tone(1175, 0.18, { delay: 0.16, type: 'triangle', vol: 0.055 });
    },
  };
})();
