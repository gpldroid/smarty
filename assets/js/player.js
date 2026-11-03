import { isSafeMediaUrl } from "./m3u.js";

export class StreamPlayer {
  constructor(video, onStatus = () => {}) {
    this.video = video;
    this.onStatus = onStatus;
    this.hls = null;
    this.currentUrl = "";
    this.video.addEventListener("error", () => this.onStatus("تعذر تشغيل هذا المصدر في المتصفح."));
  }
  stop() {
    if (this.hls) { this.hls.destroy(); this.hls = null; }
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.load();
    this.currentUrl = "";
  }
  async play(url) {
    if (!isSafeMediaUrl(url)) throw new Error("رابط البث غير صالح أو يستخدم بروتوكولاً غير مدعوم.");
    this.stop();
    this.currentUrl = url;
    this.onStatus("جارٍ الاتصال بمصدر البث…");
    const HlsCtor = window.Hls;
    if (HlsCtor && HlsCtor.isSupported()) {
      const hls = new HlsCtor({ enableWorker: true, lowLatencyMode: true });
      this.hls = hls;
      hls.on(HlsCtor.Events.ERROR, (_event, data) => {
        if (!data.fatal || this.hls !== hls) return;
        this.onStatus(data.type === HlsCtor.ErrorTypes.NETWORK_ERROR ? "تعذر الوصول إلى مصدر البث." : "حدث خطأ في تشغيل الفيديو. جرّب مصدراً آخر أو VLC.");
        hls.destroy();
        this.hls = null;
      });
      hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
        if (this.hls !== hls) return;
        this.video.play().then(() => {
          if (this.hls === hls) this.onStatus("يعمل الآن");
        }).catch(() => {
          if (this.hls === hls) this.onStatus("اضغط تشغيل لبدء المشاهدة.");
        });
      });
      hls.attachMedia(this.video);
      hls.loadSource(url);
      return;
    }
    if (this.video.canPlayType("application/vnd.apple.mpegurl")) {
      this.video.src = url;
      try { await this.video.play(); this.onStatus("يعمل الآن"); }
      catch { this.onStatus("اضغط تشغيل لبدء المشاهدة."); }
      return;
    }
    this.onStatus("هذا المتصفح لا يدعم تشغيل HLS مباشرة. جرّب فتح القناة في VLC.");
  }
  openExternal() {
    if (!this.currentUrl) return;
    window.location.href = "vlc://" + this.currentUrl;
  }
}