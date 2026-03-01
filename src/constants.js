// src/constants.js — Datos base extraídos de la planilla

export const BASICOS_DEFAULT = [
  { nombre: 'Internet',        previsto: 2056 },
  { nombre: 'Electricidad',    previsto: 4000 },
  { nombre: 'GYM',             previsto: 1290 },
  { nombre: 'Renta',           previsto: 26500 },
  { nombre: 'Mobiles',         previsto: 1220 },
  { nombre: 'Cole mily 35907', previsto: 22189 },
  { nombre: 'GASSI',           previsto: 1100 },
  { nombre: 'Gasolina',        previsto: 4000 },
  { nombre: 'Envio Cuba',      previsto: 5000 },
  { nombre: 'credito zapatos', previsto: 2253 },
];

export const IMPUESTOS_DEFAULT = [
  { nombre: 'Gastos Comunes',          previsto: 4260,  frecuencia: 'mensual' },
  { nombre: 'Tributos Domiciliarios',  previsto: 1170,  frecuencia: 'bimestral' },  // mes sí mes no
  { nombre: 'Fonasa yasiel',           previsto: 7000,  frecuencia: 'mensual' },
  { nombre: 'Contable yasiel',         previsto: 3000,  frecuencia: 'mensual' },
  { nombre: 'IVA yasiel',              previsto: 27418, frecuencia: 'mensual' },
  { nombre: 'BPS yasiel',              previsto: 4500,  frecuencia: 'mensual' },
  { nombre: 'Saneamiento SI',          previsto: 750,   frecuencia: 'bimestral' },  // mes sí mes no
  { nombre: 'Gas',                     previsto: 6500,  frecuencia: 'trimestral' }, // cada 3-4 meses
  { nombre: 'Contable aylin',          previsto: 2000,  frecuencia: 'mensual' },
  { nombre: 'IVA aylin',               previsto: 22000, frecuencia: 'mensual' },
  { nombre: 'BPS aylin',               previsto: 4336,  frecuencia: 'mensual' },
];

export const ASCEO_DEFAULT = [
  { nombre: 'papel higienico',        previsto: 135 },
  { nombre: 'pasta de diente',        previsto: 220 },
  { nombre: 'desodorante',            previsto: 230 },
  { nombre: 'shampoo',                previsto: 700 },
  { nombre: 'jabón',                  previsto: 180 },
  { nombre: 'detergente de fregar',   previsto: 75 },
  { nombre: 'esponja de fregar',      previsto: 75 },
  { nombre: 'pastillas para el baño', previsto: 130 },
  { nombre: 'Ambientador spray',      previsto: 400 },
  { nombre: 'Tohallita Milan',        previsto: 200 },
  { nombre: 'intimas',                previsto: 100 },
  { nombre: 'papel cocina reciclable',previsto: 180 },
  { nombre: 'detergente lavar',       previsto: 215 },
  { nombre: 'gel de mano',            previsto: 200 },
  { nombre: 'suavisante de ropa',     previsto: 300 },
  { nombre: 'bolsa de basura',        previsto: 150 },
  { nombre: 'detergente lavar',       previsto: 215 },
];

// Lista de compras semanal base (supermercado)
export const COMPRAS_SEMANA_DEFAULT = [
  { nombre: 'naranja+manzana+frutilla', previsto: 300, frecuencia: 'semanal' },
  { nombre: 'ajo+aji+cebolla',          previsto: 200, frecuencia: 'semanal' },
  { nombre: 'Col + tomate',             previsto: 200, frecuencia: 'semanal' },
  { nombre: 'limon+lechuga+zanahoria',  previsto: 200, frecuencia: 'semanal' },
  { nombre: 'mani + almendras',         previsto: 350, frecuencia: 'semanal' },
  { nombre: 'queso + jamón',            previsto: 400, frecuencia: 'semanal' },
  { nombre: 'pescado o nuggets milan',  previsto: 400, frecuencia: 'semanal' },
  { nombre: 'ensalada congelada',       previsto: 300, frecuencia: 'semanal' },
  { nombre: 'huevo',                    previsto: 300, frecuencia: 'semanal' },
  { nombre: 'leche',                    previsto: 80,  frecuencia: 'semanal' },
  { nombre: 'Galletitas Milan',         previsto: 200, frecuencia: 'semanal' },
  { nombre: 'pan',                      previsto: 125, frecuencia: 'semanal' },
  { nombre: 'sazon',                    previsto: 100, frecuencia: 'semanal' },
  { nombre: 'Aceite girasol',           previsto: 150, frecuencia: 'quincenal' },
  { nombre: 'Aceite oliva 1',           previsto: 400, frecuencia: 'quincenal' },
  { nombre: 'Arroz',                    previsto: 120, frecuencia: 'quincenal' },
  { nombre: 'Azúcar 1',                 previsto: 60,  frecuencia: 'quincenal' },
  { nombre: 'Sal 1',                    previsto: 60,  frecuencia: 'mensual' },
  { nombre: 'pan rallado 1',            previsto: 100, frecuencia: 'mensual' },
  { nombre: 'vino 1',                   previsto: 200, frecuencia: 'quincenal' },
  { nombre: 'merienda Milan',           previsto: 360, frecuencia: 'semanal' },
  { nombre: 'puré de tomate 1',         previsto: 85,  frecuencia: 'mensual' },
  { nombre: 'papa frita milan',         previsto: 250, frecuencia: 'semanal' },
  { nombre: 'merienda Aylin+Yasiel',    previsto: 200, frecuencia: 'semanal' },
  { nombre: 'Mantequilla de Mani',      previsto: 170, frecuencia: 'mensual' },
  { nombre: 'pollo 3Kg',               previsto: 300, frecuencia: 'semanal' },
  { nombre: 'atun',                     previsto: 320, frecuencia: 'quincenal' },
  { nombre: 'bondiola 2Kg',            previsto: 400, frecuencia: 'quincenal' },
  { nombre: 'res 2Kg',                  previsto: 600, frecuencia: 'quincenal' },
];

export const INGRESOS_FIJOS = [
  { nombre: 'Aplica YASIEL', esFijo: true },
  { nombre: 'Practia AYLIN', esFijo: true },
];

export const MESES_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

// Calcula los viernes/sábados de un mes (días de compra)
// Regla: si quedan <= 3 días hasta fin de mes después del último viernes/sábado, no cuenta como semana nueva
export function calcularSemanasMes(año, mes) {
  const diasCompra = []; // viernes (5) o sábado (6)
  const daysInMonth = new Date(año, mes + 1, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(año, mes, d).getDay(); // 0=dom,6=sab,5=vie
    if (dow === 5 || dow === 6) {
      // Preferir viernes; si ya hay un viernes esa semana, saltar el sábado
      const last = diasCompra[diasCompra.length - 1];
      if (last && d - last <= 1) continue; // sábado inmediato después de viernes → skip
      diasCompra.push(d);
    }
  }

  // Filtrar: si el último día de compra tiene <= 3 días restantes en el mes
  // Y hay al menos un día de compra anterior → no es semana nueva, se suma a la anterior
  const filtered = diasCompra.filter((dia, i) => {
    const diasRestantes = daysInMonth - dia;
    if (i === diasCompra.length - 1 && diasRestantes <= 3 && diasCompra.length > 1) {
      return false; // Esta "semana" se fusiona con la anterior
    }
    return true;
  });

  return filtered.map((dia, i) => ({
    numero: i + 1,
    dia,
    label: `Semana ${i + 1} (${dia < 10 ? '0' + dia : dia}/${(mes + 1) < 10 ? '0' + (mes + 1) : mes + 1})`,
  }));
}
