// Chilean business expense taxonomy — three-level hierarchy
// Level 1: Cuenta Madre  →  Level 2: Sub-Cuenta  →  Level 3: Detalle

export const TAXONOMY: Record<string, Record<string, string[]>> = {
  'Gasto Administrativo': {
    'Remuneraciones': [
      'Sueldos y Salarios', 'Gratificaciones', 'Horas Extra',
      'Finiquitos', 'Otras Remuneraciones',
    ],
    'Honorarios': [
      'Asesoría Legal', 'Asesoría Contable', 'Consultoría Estratégica',
      'Servicios TI', 'Otros Honorarios',
    ],
    'Arriendo': [
      'Oficina', 'Bodega', 'Estacionamiento', 'Equipos', 'Otros Arriendos',
    ],
    'Servicios Básicos': [
      'Electricidad', 'Agua', 'Gas', 'Internet', 'Telefonía', 'Otros Servicios',
    ],
    'Material de Oficina': [
      'Papelería', 'Equipos Computacionales', 'Mobiliario', 'Otros Materiales',
    ],
    'Seguros': [
      'Seguro de Vida', 'Seguro Vehículo', 'Seguro Local', 'Otros Seguros',
    ],
    'Asesorías': [
      'Auditoría Externa', 'Asesoría RRHH', 'Consultoría Financiera', 'Otras Asesorías',
    ],
    'Otros Administrativos': [
      'Suscripciones', 'Comunicaciones', 'Viáticos Administrativos', 'Otros',
    ],
  },

  'Costo de Venta': {
    'Materias Primas': [
      'Insumos de Producción', 'Embalaje', 'Materia Prima Nacional', 'Materia Prima Importada',
    ],
    'Logística': [
      'Flete Nacional', 'Flete Internacional', 'Aduana', 'Bodegaje', 'Distribución',
    ],
    'Mano de Obra Directa': [
      'Operarios Planta', 'Subcontrato Producción', 'Horas Extra Producción',
    ],
    'Equipos y Mantenimiento': [
      'Arriendo Maquinaria', 'Mantención Preventiva', 'Reparaciones', 'Repuestos',
    ],
    'Servicios de Producción': [
      'Maquila', 'Procesamiento Industrial', 'Control de Calidad', 'Laboratorio',
    ],
    'Otros Costos de Venta': [
      'Garantías', 'Devoluciones', 'Otros',
    ],
  },

  'Gasto de Venta': {
    'Marketing y Publicidad': [
      'Publicidad Digital', 'Redes Sociales', 'Medios Tradicionales', 'Eventos', 'Material Impreso',
    ],
    'Comisiones': [
      'Comisión Fuerza de Venta', 'Comisión Agentes', 'Bonos de Venta',
    ],
    'Viáticos Comerciales': [
      'Transporte', 'Alojamiento', 'Alimentación', 'Representación',
    ],
    'Materiales de Venta': [
      'Muestras', 'Catálogos', 'Merchandising', 'Packaging Comercial',
    ],
    'Otros Gastos de Venta': [
      'Ferias y Exposiciones', 'Investigación de Mercado', 'Otros',
    ],
  },

  'Gasto Financiero': {
    'Intereses': [
      'Interés Préstamo Bancario', 'Interés Tarjeta de Crédito', 'Interés Línea de Crédito',
    ],
    'Comisiones Bancarias': [
      'Mantención de Cuenta', 'Transferencias', 'Cobranza', 'Otros Cargos Banco',
    ],
    'Diferencia de Cambio': [
      'USD', 'EUR', 'BRL', 'Otras Monedas',
    ],
    'Otros Financieros': [
      'Factoring', 'Leasing', 'Otros',
    ],
  },

  'Inversión / Activo Fijo': {
    'Equipos Tecnológicos': [
      'Computadores y Accesorios', 'Servidores', 'Redes y Comunicaciones', 'Otros Equipos TI',
    ],
    'Maquinaria y Equipos': [
      'Maquinaria Productiva', 'Equipos de Medición', 'Herramientas Industriales',
    ],
    'Muebles y Útiles': [
      'Mobiliario Oficina', 'Decoración', 'Otros Muebles',
    ],
    'Vehículos': [
      'Automóvil', 'Camión', 'Van', 'Otros Vehículos',
    ],
    'Software y Licencias': [
      'ERP / CRM', 'Herramientas SaaS', 'Licencias de Software', 'Desarrollo a Medida',
    ],
    'Mejoras e Instalaciones': [
      'Remodelación', 'Obras Civiles', 'Instalaciones Eléctricas', 'Otras Mejoras',
    ],
  },

  'Otros Gastos': {
    'Impuestos y Contribuciones': [
      'Patente Municipal', 'Contribuciones de Bienes Raíces', 'Otros Impuestos',
    ],
    'Donaciones': [
      'ONGs', 'Fundaciones', 'Otras Donaciones',
    ],
    'Multas y Sanciones': [
      'SII', 'Inspección del Trabajo', 'Tránsito', 'Otras Multas',
    ],
    'Sin Clasificar': [
      'Pendiente de Revisión', 'Gasto No Identificado',
    ],
  },
}

export const CUENTA_MADRE_OPTIONS = Object.keys(TAXONOMY)

export function getSubCuentaOptions(cuentaMadre: string): string[] {
  return Object.keys(TAXONOMY[cuentaMadre] ?? {})
}

export function getDetalleOptions(cuentaMadre: string, subCuenta: string): string[] {
  return TAXONOMY[cuentaMadre]?.[subCuenta] ?? []
}
