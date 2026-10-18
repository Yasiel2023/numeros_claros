// src/pagos.js
// Cobro de la suscripción premium con Google Play Billing, a través de RevenueCat.
//
// Flujo: la app compra con RevenueCat (que habla con Google Play) → RevenueCat avisa al
// webhook del Worker (ia-worker/, /webhook/revenuecat) → el Worker escribe suscripciones/{uid}
// → la app lee ese nodo (src/suscripcion.js). El cliente nunca se da a sí mismo el premium.
//
// Solo funciona en la app de Android (Capacitor). En la web no hay cobro: se invita a
// suscribirse desde la app. Requiere la clave pública de RevenueCat para Android en la
// variable REACT_APP_RC_ANDROID_KEY (se define al compilar; no es un secreto).
import { Capacitor } from '@capacitor/core';

const CLAVE_ANDROID = process.env.REACT_APP_RC_ANDROID_KEY || '';

export const pagosDisponibles = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' && !!CLAVE_ANDROID;

let configurado = false;

async function sdk() {
  const { Purchases } = await import('@revenuecat/purchases-capacitor');
  return Purchases;
}

// Asocia las compras con el uid de Firebase (así el webhook sabe a quién darle el premium)
export async function iniciarPagos(uid) {
  if (!pagosDisponibles() || !uid) return false;
  const Purchases = await sdk();
  if (!configurado) {
    await Purchases.configure({ apiKey: CLAVE_ANDROID, appUserID: uid });
    configurado = true;
  } else {
    await Purchases.logIn({ appUserID: uid });
  }
  return true;
}

// Planes a la venta (los define el "offering" actual de RevenueCat: mensual, anual…)
export async function obtenerPlanes() {
  const Purchases = await sdk();
  const { current } = await Purchases.getOfferings();
  return (current?.availablePackages || []).map(paquete => ({
    paquete,
    id: paquete.identifier,
    titulo: paquete.product?.title?.replace(/\s*\(.*\)$/, '') || paquete.identifier,
    precio: paquete.product?.priceString || '',
    tipo: paquete.packageType,   // MONTHLY | ANNUAL | …
  }));
}

// Devuelve true si se compró; false si el usuario canceló en la ventana de Google Play
export async function comprar(plan) {
  const Purchases = await sdk();
  try {
    await Purchases.purchasePackage({ aPackage: plan.paquete });
    return true;
  } catch (e) {
    if (e?.userCancelled) return false;
    throw e;
  }
}

// Recupera una suscripción ya pagada (por ejemplo al reinstalar o cambiar de teléfono)
export async function restaurar() {
  const Purchases = await sdk();
  await Purchases.restorePurchases();
}
