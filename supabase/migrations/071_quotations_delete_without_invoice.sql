-- Permitir eliminar cotizaciones aceptadas si aún no tienen orden de compra.
DROP POLICY IF EXISTS supplier_quotations_delete_open ON public.supplier_quotations;
CREATE POLICY supplier_quotations_delete_open ON public.supplier_quotations
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR (
      user_id = public.effective_user_id()
      AND NOT EXISTS (
        SELECT 1 FROM public.supplier_purchase_invoices i WHERE i.quotation_id = supplier_quotations.id
      )
    )
  );
