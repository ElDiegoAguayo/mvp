-- Nombre del módulo en español (admin y BD usan modules.name directamente)

UPDATE public.modules
SET
  name = 'Proveedores',
  description = 'Empresas proveedoras, cotizaciones y facturas de compra desde cotizaciones aceptadas.'
WHERE slug = 'proveedores';
