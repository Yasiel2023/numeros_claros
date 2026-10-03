// src/iconos.js
// Íconos del prototipo de diseño (trazo de 24×24, sin relleno) y el estilo de
// cada categoría de gastos. Reemplazan a los emojis en la web y en la app.
import React from 'react';
import {
  Sofa, Lightbulb, Droplet, Flame, Zap, Wifi, Smartphone, Tv, Laptop, Wrench, Hammer, Bath, Car, Fuel,
  Bus, Bike, Plane, ShoppingBasket, Utensils, Coffee, Pizza, Apple, Wine, Stethoscope, Pill,
  HeartPulse, Dumbbell, GraduationCap, BookOpen, Baby, Users, Dog, Gift, Shirt, Scissors, Sparkles,
  PartyPopper, Music, Gamepad2, Film, Ticket, Landmark, Shield, Briefcase, Package, Wallet, Phone,
  Building2
} from 'lucide-react';

const TRAZOS = {
  casa:         <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>,
  gastos:       <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M7 9h10M7 13h10M7 17h6" /></>,
  tarjeta:      <><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20M6 15h4" /></>,
  debito:       <><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20" /></>,
  efectivo:     <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>,
  ingresos:     <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  recibo:       <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
  documento:    <><path d="M6 3h9l3 3v15H6z" /><path d="M9 11h6M9 15h6" /></>,
  resumen:      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  ahorro:       <path d="M19 9c0-3.3-3.1-6-7-6S5 5.7 5 9c0 2 1 3.6 2.5 4.7L7 19h3l.5-2h3l.5 2h3l-.5-5.3C18 12.6 19 11 19 9z" />,
  chat:         <><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /><path d="M9 10h6M9 14h4" /></>,
  carrito:      <><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2 3h3l2.4 12.2a1.5 1.5 0 0 0 1.5 1.2h9.3a1.5 1.5 0 0 0 1.5-1.1L22 8H6.2" /></>,
  limpieza:     <><path d="M9 3h6v4l2 3v11H7V10l2-3z" /><path d="M7 14h10" /></>,
  ocio:         <><path d="M8 3h8l-1 7a3 3 0 0 1-6 0z" /><path d="M12 13v7M9 21h6" /></>,
  calendario:   <><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 2v4M16 2v4M3 10h18" /></>,
  camara:       <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  galeria:      <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>,
  ajustes:      <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  info:         <><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v5h1" /></>,
  pagar:        <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  check:        <path d="m5 12 5 5 9-10" />,
  mas:          <path d="M12 5v14M5 12h14" />,
  cerrar:       <path d="M6 6l12 12M18 6 6 18" />,
  enviar:       <><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" /></>,
  atras:        <path d="m15 18-6-6 6-6" />,
  adelante:     <path d="m9 18 6-6-6-6" />,
  abajo:        <path d="m6 9 6 6 6-6" />,
  puntos:       <><circle cx="5" cy="12" r="1.8" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.8" fill="currentColor" stroke="none" /></>,
};

// Más variedad para las categorías: íconos de Lucide, del mismo estilo de trazo.
// La clave es lo que se guarda en grupo.icono.
const LUCIDE = {
  sofa: Sofa, luz: Lightbulb, agua: Droplet, gas: Flame, electricidad: Zap, internet: Wifi,
  celular: Smartphone, tv: Tv, computadora: Laptop, arreglos: Wrench, herramientas: Hammer, bano: Bath,
  auto: Car, nafta: Fuel, transporte: Bus, bici: Bike, viajes: Plane,
  canasta: ShoppingBasket, comida: Utensils, cafe: Coffee, pizza: Pizza, frutas: Apple, bebidas: Wine,
  salud: Stethoscope, farmacia: Pill, corazon: HeartPulse, gimnasio: Dumbbell,
  colegio: GraduationCap, libros: BookOpen, bebe: Baby, familia: Users, mascotas: Dog,
  regalos: Gift, ropa: Shirt, peluqueria: Scissors, belleza: Sparkles, fiestas: PartyPopper,
  musica: Music, juegos: Gamepad2, cine: Film, entradas: Ticket,
  banco: Landmark, seguros: Shield, trabajo: Briefcase, paquete: Package, billetera: Wallet,
  telefono: Phone, oficina: Building2,
};

export default function Icono({ nombre, size = 20, color = 'currentColor', grosor = 2, className, style }) {
  const Lucide = !TRAZOS[nombre] && LUCIDE[nombre];
  if (Lucide) {
    return <Lucide size={size} color={color} strokeWidth={grosor} className={className} style={style} aria-hidden="true" />;
  }
  const trazo = TRAZOS[nombre] || TRAZOS.gastos;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={grosor}
      strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true" focusable="false">
      {trazo}
    </svg>
  );
}

// ── Categorías de gastos ──────────────────────────────────────
// Colores del prototipo: [fondo, trazo]
const COLORES = {
  teal:    ['#E6F4F2', '#0D9488'],
  ambar:   ['#FEF3E2', '#B45309'],
  violeta: ['#F3EEFF', '#7C3AED'],
  azul:    ['#E8F1FB', '#1D6FB8'],
  rosa:    ['#FDEDF2', '#BE185D'],
  verde:   ['#ECFDF3', '#15803D'],
};

// Íconos que se pueden elegir para una categoría (se guardan en grupo.icono), agrupados
// para el selector. Las categorías viejas tienen un emoji ahí: esas se reconocen por el nombre.
export const GRUPOS_ICONOS = [
  { titulo: 'Hogar', iconos: [
    ['casa', 'teal'], ['sofa', 'teal'], ['luz', 'ambar'], ['electricidad', 'ambar'], ['agua', 'azul'], ['gas', 'ambar'],
    ['internet', 'azul'], ['celular', 'azul'], ['telefono', 'azul'], ['tv', 'violeta'], ['computadora', 'azul'],
    ['arreglos', 'ambar'], ['herramientas', 'ambar'], ['bano', 'azul'], ['limpieza', 'azul'] ] },
  { titulo: 'Comida y compras', iconos: [
    ['carrito', 'violeta'], ['canasta', 'violeta'], ['comida', 'ambar'], ['cafe', 'ambar'], ['pizza', 'ambar'],
    ['frutas', 'verde'], ['bebidas', 'rosa'], ['ropa', 'violeta'], ['paquete', 'ambar'] ] },
  { titulo: 'Transporte', iconos: [
    ['auto', 'azul'], ['nafta', 'ambar'], ['transporte', 'azul'], ['bici', 'verde'], ['viajes', 'azul'] ] },
  { titulo: 'Salud y familia', iconos: [
    ['salud', 'rosa'], ['farmacia', 'rosa'], ['corazon', 'rosa'], ['gimnasio', 'verde'], ['colegio', 'azul'],
    ['libros', 'azul'], ['bebe', 'rosa'], ['familia', 'teal'], ['mascotas', 'ambar'], ['peluqueria', 'rosa'], ['belleza', 'rosa'] ] },
  { titulo: 'Ocio', iconos: [
    ['ocio', 'rosa'], ['fiestas', 'rosa'], ['regalos', 'rosa'], ['musica', 'violeta'], ['juegos', 'violeta'],
    ['cine', 'violeta'], ['entradas', 'violeta'] ] },
  { titulo: 'Plata y trámites', iconos: [
    ['documento', 'ambar'], ['recibo', 'ambar'], ['tarjeta', 'violeta'], ['efectivo', 'verde'], ['billetera', 'verde'],
    ['banco', 'teal'], ['seguros', 'azul'], ['trabajo', 'teal'], ['oficina', 'teal'], ['calendario', 'azul'],
    ['ahorro', 'rosa'], ['ingresos', 'verde'], ['gastos', 'teal'] ] },
];
export const ICONOS_CATEGORIA = GRUPOS_ICONOS.flatMap(g => g.iconos.map(([icono, color]) => ({ icono, color })));

// Se reconoce la categoría por su id o por palabras de su nombre (de lo más específico a lo más general)
const REGLAS = [
  { claves: ['impuesto', 'tributo', ' iva', 'irpf', ' bps', 'contribu', 'patente'],   icono: 'documento' },
  { claves: ['nafta', 'combustible', 'gasoil'],                                      icono: 'nafta' },
  { claves: ['auto', 'coche', 'moto'],                                               icono: 'auto' },
  { claves: ['transporte', 'omnibus', 'taxi', 'uber'],                               icono: 'transporte' },
  { claves: ['viaje', 'vacacion'],                                                   icono: 'viajes' },
  { claves: ['luz', ' ute', 'electric'],                                              icono: 'luz' },
  { claves: ['agua', ' ose'],                                                         icono: 'agua' },
  { claves: ['internet', 'antel', 'wifi'],                                           icono: 'internet' },
  { claves: ['celular', 'telefon', 'movil'],                                         icono: 'celular' },
  { claves: ['farmacia', 'remedio'],                                                 icono: 'farmacia' },
  { claves: ['salud', 'medic', 'mutualista', 'emergencia', 'dentista'],              icono: 'salud' },
  { claves: ['gimnasio', 'deporte', 'gym'],                                          icono: 'gimnasio' },
  { claves: ['colegio', 'escuela', 'educa', 'facultad', 'curso', 'liceo'],           icono: 'colegio' },
  { claves: ['bebe', 'hijo', 'nino', 'panal'],                                       icono: 'bebe' },
  { claves: ['mascota', 'perro', 'gato', 'veterin'],                                 icono: 'mascotas' },
  { claves: ['ropa', 'vestimenta', 'calzado'],                                       icono: 'ropa' },
  { claves: ['regalo', 'cumple'],                                                    icono: 'regalos' },
  { claves: ['seguro'],                                                              icono: 'seguros' },
  { claves: ['streaming', 'netflix', 'spotify', 'cable'],                            icono: 'tv' },
  { claves: ['restaurant', 'delivery', 'comida', 'almuerzo'],                        icono: 'comida' },
  { claves: ['compra', 'super', 'mercado', 'aliment', 'feria'],                      icono: 'carrito' },
  { claves: ['asceo', 'aseo', 'limpie', 'higiene'],                                  icono: 'limpieza' },
  { claves: ['ocio', 'salida', 'diversi', 'entreten'],                               icono: 'ocio' },
  { claves: ['tarjeta', 'cuota', 'credito', 'prestamo'],                             icono: 'tarjeta' },
  { claves: ['ahorro'],                                                              icono: 'ahorro' },
  { claves: ['ingreso', 'sueldo'],                                                   icono: 'ingresos' },
  { claves: ['basicos', 'fijo', 'hogar', 'casa', 'alquiler', 'renta', 'servicio', 'gastos comunes'], icono: 'casa' },
];
const RESTO = ['teal', 'azul', 'ambar', 'rosa', 'verde', 'violeta'];

const normalizar = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const colorDe = (icono) => ICONOS_CATEGORIA.find(i => i.icono === icono)?.color || 'teal';

export function estiloCategoria(grupo) {
  const elegido = ICONOS_CATEGORIA.find(i => i.icono === grupo?.icono);
  if (elegido) {
    const [fondo, color] = COLORES[elegido.color];
    return { icono: elegido.icono, fondo, color };
  }
  const texto = `${normalizar(grupo?.id)} ${normalizar(grupo?.nombre)}`;
  const regla = REGLAS.find(r => r.claves.some(c => texto.includes(c)));
  if (regla) {
    const [fondo, color] = COLORES[colorDe(regla.icono)];
    return { icono: regla.icono, fondo, color };
  }
  // Categoría sin regla (ej. "Extras"): color estable según el nombre
  const n = [...texto].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const [fondo, color] = COLORES[RESTO[n % RESTO.length]];
  return { icono: 'gastos', fondo, color };
}

// Selector de ícono para una categoría
export function SelectorIconoCategoria({ valor, onChange, disabled }) {
  const actual = ICONOS_CATEGORIA.some(i => i.icono === valor) ? valor : null;
  return (
    <div className="sel-icono-cat" role="radiogroup" aria-label="Ícono de la categoría">
      {GRUPOS_ICONOS.map(({ titulo, iconos }) => (
        <div key={titulo} className="sel-icono-grupo">
          <span className="sel-icono-titulo">{titulo}</span>
          <div className="sel-icono-lista">
            {iconos.map(([icono]) => (
              <button key={icono} type="button" role="radio" aria-checked={actual === icono} aria-label={icono}
                className={actual === icono ? 'sel' : ''} onClick={() => onChange(icono)} disabled={disabled}>
                <IconoCategoria grupo={{ icono }} size={38} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Cuadrado de color con el ícono de la categoría
export function IconoCategoria({ grupo, size = 42, className = '' }) {
  const { icono, fondo, color } = estiloCategoria(grupo);
  return (
    <span className={`icono-cat ${className}`} style={{
      width: size, height: size, borderRadius: Math.round(size * 0.31), background: fondo,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Icono nombre={icono} size={Math.round(size * 0.48)} color={color} />
    </span>
  );
}
