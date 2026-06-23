import { PaymentFeesCard } from "./payment-fees-card";
import { TaxConfigCard } from "./tax-config-card";

export function FeesTaxTab({
  storeId,
  canEdit,
}: {
  storeId: string;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-6">
      <PaymentFeesCard storeId={storeId} canEdit={canEdit} />
      <TaxConfigCard storeId={storeId} canEdit={canEdit} />
    </div>
  );
}
