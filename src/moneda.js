// src/moneda.js
// Monedas del presupuesto. Cada presupuesto tiene una moneda principal (gastos,
// ingresos, tarjetas por defecto) y opcionalmente una secundaria (tarjetas y caja
// de ahorro en otra moneda, ej. USD). Se guardan en _meta.moneda / _meta.moneda2.
// Presupuestos viejos sin esos campos: UYU + USD.
//
// App.js llama a configurarMonedas() al cambiar de presupuesto; los componentes
// usan money()/money2()/moneyDe() al renderizar.

export const MONEDAS = {
  UYU: { nombre: 'Peso uruguayo',     simbolo: '$',   decimales: 0, pais: 'Uruguay' },
  ARS: { nombre: 'Peso argentino',    simbolo: '$',   decimales: 0, pais: 'Argentina' },
  CLP: { nombre: 'Peso chileno',      simbolo: '$',   decimales: 0, pais: 'Chile' },
  MXN: { nombre: 'Peso mexicano',     simbolo: '$',   decimales: 2, pais: 'México' },
  COP: { nombre: 'Peso colombiano',   simbolo: '$',   decimales: 0, pais: 'Colombia' },
  PEN: { nombre: 'Sol peruano',       simbolo: 'S/',  decimales: 2, pais: 'Perú' },
  BRL: { nombre: 'Real brasileño',    simbolo: 'R$',  decimales: 2, pais: 'Brasil' },
  PYG: { nombre: 'Guaraní paraguayo', simbolo: '₲',   decimales: 0, pais: 'Paraguay' },
  BOB: { nombre: 'Boliviano',         simbolo: 'Bs',  decimales: 2, pais: 'Bolivia' },
  USD: { nombre: 'Dólar',             simbolo: 'US$', decimales: 2, pais: 'Estados Unidos' },
  EUR: { nombre: 'Euro',              simbolo: '€',   decimales: 2, pais: 'la zona euro' },
};

export const CODIGOS_MONEDA = Object.keys(MONEDAS);
export const MONEDA_DEFAULT = 'UYU';
export const MONEDA2_DEFAULT = 'USD';

// Monedas del presupuesto activo
let activa = { principal: MONEDA_DEFAULT, secundaria: MONEDA2_DEFAULT };

export function configurarMonedas(principal, secundaria) {
  activa = {
    principal: MONEDAS[principal] ? principal : MONEDA_DEFAULT,
    secundaria: secundaria && MONEDAS[secundaria] && secundaria !== principal ? secundaria : '',
  };
}

export const monedaPrincipal = () => activa.principal;
export const monedaSecundaria = () => activa.secundaria;          // '' = sin segunda moneda
export const monedasDisponibles = () => [activa.principal, activa.secundaria].filter(Boolean);

// Lee las monedas de un _meta (con los valores por defecto de presupuestos viejos)
export function monedasDeMeta(meta) {
  const principal = MONEDAS[meta?.moneda] ? meta.moneda : MONEDA_DEFAULT;
  const secundaria = meta?.moneda2 === '' ? '' : (MONEDAS[meta?.moneda2] ? meta.moneda2 : MONEDA2_DEFAULT);
  return { principal, secundaria: secundaria === principal ? '' : secundaria };
}

// Símbolo a mostrar. Si las dos monedas usan "$" (ej. ARS y USD) la secundaria
// ya usa "US$"; si coinciden los símbolos se antepone el código.
export function simbolo(codigo = activa.principal) {
  return MONEDAS[codigo]?.simbolo ?? codigo;
}

function formatear(n, codigo, decimales) {
  const d = decimales ?? MONEDAS[codigo]?.decimales ?? 0;
  const numero = new Intl.NumberFormat('es-UY', {
    minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: false,
  }).format(n || 0);
  return `${simbolo(codigo)}${numero}`;
}

// Monto en la moneda principal (decimales de la moneda)
export const money = (n) => formatear(n, activa.principal);
// Monto en la moneda principal con 2 decimales (detalles como prorrateos)
export const money2 = (n) => formatear(n, activa.principal, 2);
// Monto en una moneda dada (tarjetas, cuotas, caja). Sin código = principal.
export const moneyDe = (n, codigo) => formatear(n, codigo || activa.principal);

// Una tarjeta/cuota está en la moneda secundaria solo si coincide exactamente;
// cualquier otro código (incluidos datos viejos) se trata como principal.
export const esSecundaria = (codigo) => !!activa.secundaria && codigo === activa.secundaria;

// Moneda efectiva de una tarjeta/cuota según esa regla
export const monedaDe = (codigo) => (esSecundaria(codigo) ? codigo : activa.principal);
// Monto de una tarjeta/cuota en su moneda efectiva
export const moneyTarjeta = (n, codigo) => formatear(n, monedaDe(codigo));
export const decimalesDe = (codigo) => MONEDAS[monedaDe(codigo)]?.decimales ?? 0;
