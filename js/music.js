// 本地合成背景音乐；不依赖外部音频服务，也不混入持续的噪声环境音。
const farmTracks = {
  meadow: {
    name: '田园晨光',
    bpm: 64,
    tone: 'sine',
    melody: [
      76,
      79,
      81,
      79,
      76,
      74,
      72,
      null,
      77,
      81,
      84,
      81,
      79,
      77,
      76,
      null,
      76,
      81,
      83,
      81,
      79,
      76,
      74,
      null,
      74,
      79,
      81,
      79,
      74,
      71,
      72,
      null
    ],
    chords: [
      [48, 60, 64, 67],
      [53, 60, 65, 69],
      [45, 57, 60, 64],
      [43, 55, 59, 62]
    ]
  },
  breeze: {
    name: '微风小步舞',
    bpm: 82,
    tone: 'triangle',
    melody: [
      72,
      76,
      79,
      null,
      76,
      74,
      72,
      null,
      74,
      77,
      81,
      null,
      79,
      77,
      74,
      null,
      76,
      79,
      84,
      null,
      81,
      79,
      76,
      null,
      74,
      71,
      67,
      null,
      71,
      74,
      72,
      null
    ],
    chords: [
      [48, 60, 64, 67],
      [50, 62, 65, 69],
      [45, 57, 60, 64],
      [43, 55, 59, 62]
    ]
  },
  moon: {
    name: '月光摇篮曲',
    bpm: 48,
    tone: 'sine',
    melody: [
      69,
      null,
      72,
      76,
      null,
      72,
      69,
      null,
      67,
      null,
      71,
      74,
      null,
      71,
      67,
      null,
      65,
      null,
      69,
      72,
      null,
      69,
      65,
      null,
      67,
      null,
      71,
      74,
      72,
      null,
      69,
      null
    ],
    chords: [
      [45, 57, 60, 64],
      [43, 55, 59, 62],
      [41, 53, 57, 60],
      [43, 55, 59, 62]
    ]
  }
};
class FarmMusic {
  constructor(context) {
    this.context = context;
    this.master = context.createGain();
    this.master.gain.value = 0.38;
    this.master.connect(context.destination);
    this.timer = null;
    this.voices = new Set();
    this.beat = 60 / 64;
    this.outside = true;
    this.step = 0;
    this.nextTime = 0;
    this.melody = farmTracks.meadow.melody;
    this.chords = farmTracks.meadow.chords;
    this.track = 'meadow';
    this.tone = 'sine';
  }

  setTrack(id) {
    const track = farmTracks[id];
    if (!track || id === this.track) return;
    const wasPlaying = this.timer !== null;
    this.stop();
    this.track = id;
    this.tone = track.tone;
    this.beat = 60 / track.bpm;
    this.melody = track.melody;
    this.chords = track.chords;
    this.step = 0;
    if (wasPlaying) this.start();
  }

  note(midi, time, duration, volume, type = 'sine') {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(gain).connect(this.master);
    this.voices.add(oscillator);
    oscillator.onended = () => {
      this.voices.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
  }

  schedule() {
    // Recover from device sleep without scheduling a backlog of notes at once.
    if (this.nextTime < this.context.currentTime - 0.25)
      this.nextTime = this.context.currentTime + 0.04;
    while (this.nextTime < this.context.currentTime + 0.25) {
      const step = this.step % this.melody.length;
      const melody = this.melody[step];
      if (melody !== null) {
        this.note(
          melody - 12,
          this.nextTime,
          this.beat * 1.5,
          this.tone === 'triangle' ? 0.042 : 0.065,
          this.tone
        );
        this.note(melody, this.nextTime, this.beat * 1.2, 0.012);
      }
      const chord = this.chords[Math.floor(step / 8)];
      if (step % 8 === 0) this.note(chord[0], this.nextTime, this.beat * 3, 0.065);
      this.note(chord[1 + (step % 3)], this.nextTime, this.beat * 1.3, 0.035);
      this.nextTime += this.beat / 2;
      this.step++;
    }
  }

  start() {
    if (this.timer !== null) return;
    this.nextTime = this.context.currentTime + 0.04;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 100);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
  }

  setOutside(outside) {
    // 场景状态继续保留；背景只播放旋律，不启动持续的噪声流水循环。
    this.outside = outside;
  }
}
