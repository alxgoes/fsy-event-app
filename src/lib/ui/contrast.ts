/** Texto legível mesmo quando a cor da companhia foi escolhida pelo usuário. */
export function contrastText(background: string): string {
  const hex = /^#[\da-f]{6}$/i.test(background) ? background.slice(1) : "007da5";
  const channels = [0, 2, 4].map(offset => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? "#000000" : "#ffffff";
}
