export const number = (value: number) => value.toLocaleString('ja-JP');
export const seconds = (ticks: number) => `${(ticks / 10).toFixed(1)}秒`;
