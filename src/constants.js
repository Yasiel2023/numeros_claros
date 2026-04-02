// src/constants.js

export const MESES_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

// Frecuencias disponibles para grupos de gastos
export const FRECUENCIAS_GRUPO = [
  { value: 'mensual',    label: 'Mensual',       desc: '1 periodo por mes',           periodos: 1  },
  { value: 'quincenal',  label: 'Quincenal',      desc: '2 periodos (quincenas)',       periodos: 2  },
  { value: 'cada10dias', label: 'Cada 10 dias',   desc: '3 periodos (decimas del mes)', periodos: 3  },
  { value: 'semanal',    label: 'Semanal',        desc: 'Un periodo por semana',        periodos: -1 },
];

// Multiplicador mensual estimado para una frecuencia
export function multiplicadorFrecuencia(frecuencia) {
  if (frecuencia === 'quincenal')  return 2;
  if (frecuencia === 'cada10dias') return 3;
  if (frecuencia === 'semanal')    return 4;
  return 1; // mensual
}

// Calcula los viernes/sabados de un mes (dias de compra semanal)
export function calcularSemanasMes(anio, mes) {
  const diasCompra = [];
  const daysInMonth = new Date(anio, mes + 1, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(anio, mes, d).getDay(); // 0=dom,6=sab,5=vie
    if (dow === 5 || dow === 6) {
      const last = diasCompra[diasCompra.length - 1];
      if (last && d - last <= 1) continue; // sabado inmediato detras de viernes -> skip
      diasCompra.push(d);
    }
  }

  const filtered = diasCompra.filter((dia, i) => {
    const diasRestantes = daysInMonth - dia;
    if (i === diasCompra.length - 1 && diasRestantes <= 3 && diasCompra.length > 1) return false;
    return true;
  });

  return filtered.map((dia, i) => ({
    numero: i + 1,
    dia,
    label: `Semana ${i + 1} (${dia < 10 ? '0' + dia : dia}/${(mes + 1) < 10 ? '0' + (mes + 1) : mes + 1})`,
  }));
}

// Genera los labels de periodos de un grupo segun su frecuencia y el mes activo
export function getPeriodosLabel(frecuencia, anio, mes) {
  const mesNombre = MESES_ES[mes];
  if (frecuencia === 'quincenal') return [
    { numero: 1, label: `1ra quincena (1-15 ${mesNombre})` },
    { numero: 2, label: `2da quincena (16-fin ${mesNombre})` },
  ];
  if (frecuencia === 'cada10dias') return [
    { numero: 1, label: `Del 1 al 10 (${mesNombre})` },
    { numero: 2, label: `Del 11 al 20 (${mesNombre})` },
    { numero: 3, label: `Del 21 al fin (${mesNombre})` },
  ];
  if (frecuencia === 'semanal') {
    return calcularSemanasMes(anio, mes);
  }
  // mensual (default)
  return [{ numero: 1, label: `${mesNombre} ${anio}` }];
}