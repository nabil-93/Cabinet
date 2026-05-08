export function playSound(type: "call" | "done" | "available" | "busy") {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const tone = (freq: number, start: number, dur: number, vol = 0.28) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.01);
    };

    if (type === "call") {
      // Patient appelé : deux bips montants
      tone(440, 0,    0.14);
      tone(660, 0.18, 0.22);
    } else if (type === "done") {
      // Consultation terminée : trois bips descendants
      tone(660, 0,    0.14);
      tone(550, 0.18, 0.14);
      tone(440, 0.36, 0.26);
    } else if (type === "available") {
      // Médecin libre : bip joyeux montant
      tone(523, 0,    0.14);
      tone(659, 0.17, 0.14);
      tone(784, 0.34, 0.28);
    } else if (type === "busy") {
      // Médecin occupé : bip grave court
      tone(330, 0, 0.25, 0.2);
    }

    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {}
}
