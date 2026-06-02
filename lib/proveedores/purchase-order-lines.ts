/** Total línea = cantidad × precio unitario (2 decimales). */
export function computePurchaseLineTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100
}

export interface PurchaseOrderLineItemInput {
  line_id: string
  quantity: number
}

export interface PurchaseOrderLineDraft {
  id: string
  description: string
  quotedQuantity: number
  unit: string
  unitPrice: number
  orderQuantity: number
  selected: boolean
}

export function draftLineTotal(line: Pick<PurchaseOrderLineDraft, 'orderQuantity' | 'unitPrice' | 'selected'>): number {
  if (line.selected === false) return 0
  return computePurchaseLineTotal(line.orderQuantity, line.unitPrice)
}

export function sumOrderDraftTotal(lines: PurchaseOrderLineDraft[]): number {
  return Math.round(
    lines
      .filter(l => l.selected && l.orderQuantity > 0)
      .reduce((s, l) => s + computePurchaseLineTotal(l.orderQuantity, l.unitPrice), 0) * 100,
  ) / 100
}
