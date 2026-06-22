import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import {
  customers,
  orderLineItems,
  orderTransactions,
  orders,
  productVariants,
  products,
  refunds,
} from "../../database/schema/sales";
import type {
  NormalizedCustomer,
  NormalizedOrder,
  NormalizedProduct,
  NormalizedRefund,
} from "./ingestion.types";

/**
 * Normalize edilmiş satış verisini DB'ye idempotent yazar.
 * Tüm yazımlar (store_id, external_id) hedefiyle `onConflictDoUpdate` —
 * tekrarlı webhook/backfill çift kayıt üretmez.
 */
@Injectable()
export class IngestionService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** Sipariş + satırları + hareketleri + iadeleri tek transaction'da yazar. */
  async upsertOrder(storeId: string, o: NormalizedOrder): Promise<string> {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const [row] = await tx
        .insert(orders)
        .values({
          storeId,
          externalId: o.externalId,
          name: o.name,
          email: o.email,
          customerExternalId: o.customerExternalId,
          financialStatus: o.financialStatus,
          fulfillmentStatus: o.fulfillmentStatus,
          currency: o.currency,
          presentmentCurrency: o.presentmentCurrency,
          subtotalPrice: o.subtotalPrice,
          totalPrice: o.totalPrice,
          totalDiscounts: o.totalDiscounts,
          totalTax: o.totalTax,
          totalShipping: o.totalShipping,
          totalRefunded: o.totalRefunded,
          test: o.test,
          processedAt: o.processedAt,
          cancelledAt: o.cancelledAt,
          shopifyCreatedAt: o.shopifyCreatedAt,
          shopifyUpdatedAt: o.shopifyUpdatedAt,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [orders.storeId, orders.externalId],
          set: {
            name: o.name,
            email: o.email,
            customerExternalId: o.customerExternalId,
            financialStatus: o.financialStatus,
            fulfillmentStatus: o.fulfillmentStatus,
            currency: o.currency,
            presentmentCurrency: o.presentmentCurrency,
            subtotalPrice: o.subtotalPrice,
            totalPrice: o.totalPrice,
            totalDiscounts: o.totalDiscounts,
            totalTax: o.totalTax,
            totalShipping: o.totalShipping,
            totalRefunded: o.totalRefunded,
            test: o.test,
            processedAt: o.processedAt,
            cancelledAt: o.cancelledAt,
            shopifyUpdatedAt: o.shopifyUpdatedAt,
            updatedAt: now,
          },
        })
        .returning({ id: orders.id });
      const orderId = row.id;

      // Satırlar sipariş gövdesiyle birlikte gelir → tam değiştir (silinenler de yansısın).
      await tx.delete(orderLineItems).where(eq(orderLineItems.orderId, orderId));
      if (o.lineItems.length > 0) {
        await tx.insert(orderLineItems).values(
          o.lineItems.map((li) => ({
            orderId,
            storeId,
            externalId: li.externalId,
            productExternalId: li.productExternalId,
            variantExternalId: li.variantExternalId,
            sku: li.sku,
            title: li.title,
            quantity: li.quantity,
            price: li.price,
            discountAmount: li.discountAmount,
            totalAmount: li.totalAmount,
          })),
        );
      }

      // Hareket ve iadeler ayrı webhook'larla da gelebilir → tek tek upsert.
      for (const t of o.transactions) {
        await tx
          .insert(orderTransactions)
          .values({
            orderId,
            storeId,
            externalId: t.externalId,
            kind: t.kind,
            status: t.status,
            gateway: t.gateway,
            amount: t.amount,
            fee: t.fee,
            currency: t.currency,
            processedAt: t.processedAt,
          })
          .onConflictDoUpdate({
            target: [orderTransactions.storeId, orderTransactions.externalId],
            set: {
              kind: t.kind,
              status: t.status,
              gateway: t.gateway,
              amount: t.amount,
              fee: t.fee,
              currency: t.currency,
              processedAt: t.processedAt,
            },
          });
      }

      for (const r of o.refunds) {
        await this.insertRefund(tx, storeId, orderId, r);
      }

      return orderId;
    });
  }

  /** Sipariş + ilişkili satır/hareket/iadeleri toplu yazar; yazılan sipariş sayısını döner. */
  async upsertOrders(storeId: string, list: NormalizedOrder[]): Promise<number> {
    let count = 0;
    for (const o of list) {
      await this.upsertOrder(storeId, o);
      count += 1;
    }
    return count;
  }

  /** Bağımsız `refunds/create` webhook'u: ilgili siparişe bağla (yoksa atla). */
  async upsertRefund(
    storeId: string,
    orderExternalId: string | null,
    r: NormalizedRefund,
  ): Promise<boolean> {
    if (!orderExternalId) return false;
    const [order] = await this.db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(eq(orders.storeId, storeId), eq(orders.externalId, orderExternalId)),
      )
      .limit(1);
    if (!order) return false;
    await this.insertRefund(this.db, storeId, order.id, r);
    return true;
  }

  async upsertProduct(storeId: string, p: NormalizedProduct): Promise<void> {
    await this.db.transaction(async (tx) => {
      const now = new Date();
      const [row] = await tx
        .insert(products)
        .values({
          storeId,
          externalId: p.externalId,
          title: p.title,
          handle: p.handle,
          status: p.status,
          vendor: p.vendor,
          productType: p.productType,
          shopifyCreatedAt: p.shopifyCreatedAt,
          shopifyUpdatedAt: p.shopifyUpdatedAt,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [products.storeId, products.externalId],
          set: {
            title: p.title,
            handle: p.handle,
            status: p.status,
            vendor: p.vendor,
            productType: p.productType,
            shopifyUpdatedAt: p.shopifyUpdatedAt,
            updatedAt: now,
          },
        })
        .returning({ id: products.id });

      for (const v of p.variants) {
        await tx
          .insert(productVariants)
          .values({
            storeId,
            productId: row.id,
            externalId: v.externalId,
            externalProductId: v.externalProductId ?? p.externalId,
            sku: v.sku,
            title: v.title,
            price: v.price,
            inventoryQuantity: v.inventoryQuantity,
            shopifyCreatedAt: v.shopifyCreatedAt,
            shopifyUpdatedAt: v.shopifyUpdatedAt,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [productVariants.storeId, productVariants.externalId],
            set: {
              productId: row.id,
              externalProductId: v.externalProductId ?? p.externalId,
              sku: v.sku,
              title: v.title,
              price: v.price,
              inventoryQuantity: v.inventoryQuantity,
              shopifyUpdatedAt: v.shopifyUpdatedAt,
              updatedAt: now,
            },
          });
      }
    });
  }

  async upsertProducts(
    storeId: string,
    list: NormalizedProduct[],
  ): Promise<number> {
    for (const p of list) await this.upsertProduct(storeId, p);
    return list.length;
  }

  async upsertCustomer(storeId: string, c: NormalizedCustomer): Promise<void> {
    const now = new Date();
    await this.db
      .insert(customers)
      .values({
        storeId,
        externalId: c.externalId,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        ordersCount: c.ordersCount,
        totalSpent: c.totalSpent,
        currency: c.currency,
        shopifyCreatedAt: c.shopifyCreatedAt,
        shopifyUpdatedAt: c.shopifyUpdatedAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [customers.storeId, customers.externalId],
        set: {
          email: c.email,
          firstName: c.firstName,
          lastName: c.lastName,
          ordersCount: c.ordersCount,
          totalSpent: c.totalSpent,
          currency: c.currency,
          shopifyUpdatedAt: c.shopifyUpdatedAt,
          updatedAt: now,
        },
      });
  }

  async upsertCustomers(
    storeId: string,
    list: NormalizedCustomer[],
  ): Promise<number> {
    for (const c of list) await this.upsertCustomer(storeId, c);
    return list.length;
  }

  private async insertRefund(
    db: DrizzleDB | Parameters<Parameters<DrizzleDB["transaction"]>[0]>[0],
    storeId: string,
    orderId: string,
    r: NormalizedRefund,
  ): Promise<void> {
    await db
      .insert(refunds)
      .values({
        orderId,
        storeId,
        externalId: r.externalId,
        amount: r.amount,
        shippingRefunded: r.shippingRefunded,
        taxRefunded: r.taxRefunded,
        note: r.note,
        processedAt: r.processedAt,
        shopifyCreatedAt: r.shopifyCreatedAt,
      })
      .onConflictDoUpdate({
        target: [refunds.storeId, refunds.externalId],
        set: {
          amount: r.amount,
          shippingRefunded: r.shippingRefunded,
          taxRefunded: r.taxRefunded,
          note: r.note,
          processedAt: r.processedAt,
        },
      });
  }
}
