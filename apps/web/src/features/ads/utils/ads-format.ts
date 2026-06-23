/** ROAS/POAS gibi oranları `2.40×` biçiminde gösterir (null → "—"). */
export function ratio(n: number | null): string {
  return n == null ? "—" : `${n.toFixed(2)}×`;
}
