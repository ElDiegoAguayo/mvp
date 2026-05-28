-- Habilitar Supabase Realtime para tablas dinámicas
-- Esto permite que las columnas vinculadas (tipo "linked") se actualicen automáticamente
-- cuando hay cambios en las tablas origen.

-- Agregar dynamic_table_rows a la publicación de realtime
ALTER PUBLICATION supabase_realtime ADD TABLE dynamic_table_rows;

-- Asegurar que se incluyan los datos completos en los eventos
ALTER TABLE dynamic_table_rows REPLICA IDENTITY FULL;
