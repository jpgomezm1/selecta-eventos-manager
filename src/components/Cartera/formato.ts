/**
 * Formateo de la cartera.
 *
 * El repo repite `formatCurrency` en cada archivo que muestra plata. Acá va una
 * sola vez porque los seis componentes del módulo tienen que mostrar los mismos
 * números con el mismo formato: si uno redondea distinto, dos pantallas del
 * mismo corte muestran totales que no cuadran y el cliente deja de confiar.
 */

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const money = (n: number) => COP.format(Math.round(n || 0));

/** Para tablas densas: $ 283,1 M en vez de $ 283.070.997. */
export function moneyCorto(n: number): string {
  const v = Math.abs(n || 0);
  if (v >= 1_000_000) return `$ ${(n / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;
  if (v >= 1_000) return `$ ${(n / 1_000).toLocaleString("es-CO", { maximumFractionDigits: 0 })} K`;
  return money(n);
}

export const pct = (n: number) =>
  `${((n || 0) * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`;

/**
 * Fechas de Postgres (`2026-08-07`) sin pasar por `new Date()`, que las
 * interpreta como UTC y las corre un día hacia atrás en Colombia.
 */
export function fechaCorta(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

export const hoyISO = () => {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
};
