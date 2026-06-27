import { Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { BillingService } from "../billing/billing.service";
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
 * Tüm yazımlar (channel_id, external_id) hedefiyle `onConflictDoUpdate` —
 * tekrarlı webhook/backfill çift kayıt üretmez.
 */
@Injectable()
export class IngestionService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly billing: BillingService,
  ) {}

  /** Sipariş + satırları + hareketleri + iadeleri tek transaction'da yazar. */
  async upsertOrder(channelId: string, o: NormalizedOrder): Promise<string> {
    const { orderId, inserted } = await this.db.transaction(async (tx) => {
      const now = new Date();
      const [row] = await tx
        .insert(orders)
        .values({
          channelId,
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
          target: [orders.channelId, orders.externalId],
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
        // `(xmax = 0)` Postgres upsert deyimi: yeni INSERT'te true, conflict-UPDATE'te false.
        .returning({ id: orders.id, inserted: sql<boolean>`(xmax = 0)` });
      const orderId = row.id;

      // Satırlar sipariş gövdesiyle birlikte gelir → tam değiştir (silinenler de yansısın).
      await tx.delete(orderLineItems).where(eq(orderLineItems.orderId, orderId));
      if (o.lineItems.length > 0) {
        await tx.insert(orderLineItems).values(
          o.lineItems.map((li) => ({
            orderId,
            channelId,
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
            channelId,
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
            target: [orderTransactions.channelId, orderTransactions.externalId],
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
        await this.insertRefund(tx, channelId, orderId, r);
      }

      return { orderId, inserted: row.inserted };
    });

    // Soft cap: yalnız YENİ sipariş aylık kullanım sayacını artırır (commit sonrası,
    // best-effort; sayım hatası sipariş yazımını bozmaz, veri asla düşmez).
    if (inserted) await this.billing.recordOrderIngested(channelId);
    return orderId;
  }

  /** Sipariş + ilişkili satır/hareket/iadeleri toplu yazar; yazılan sipariş sayısını döner. */
  async upsertOrders(channelId: string, list: NormalizedOrder[]): Promise<number> {
    let count = 0;
    for (const o of list) {
      await this.upsertOrder(channelId, o);
      count += 1;
    }
    return count;
  }

  /** Bağımsız `refunds/create` webhook'u: ilgili siparişe bağla (yoksa atla). */
  async upsertRefund(
    channelId: string,
    orderExternalId: string | null,
    r: NormalizedRefund,
  ): Promise<boolean> {
    if (!orderExternalId) return false;
    const [order] = await this.db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(eq(orders.channelId, channelId), eq(orders.externalId, orderExternalId)),
      )
      .limit(1);
    if (!order) return false;
    await this.insertRefund(this.db, channelId, order.id, r);
    return true;
  }

  async upsertProduct(channelId: string, p: NormalizedProduct): Promise<void> {
    await this.db.transaction(async (tx) => {
      const now = new Date();
      const [row] = await tx
        .insert(products)
        .values({
          channelId,
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
          target: [products.channelId, products.externalId],
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
            channelId,
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
            target: [productVariants.channelId, productVariants.externalId],
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
    channelId: string,
    list: NormalizedProduct[],
  ): Promise<number> {
    for (const p of list) await this.upsertProduct(channelId, p);
    return list.length;
  }

  async upsertCustomer(channelId: string, c: NormalizedCustomer): Promise<void> {
    const now = new Date();
    await this.db
      .insert(customers)
      .values({
        channelId,
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
        target: [customers.channelId, customers.externalId],
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
    channelId: string,
    list: NormalizedCustomer[],
  ): Promise<number> {
    for (const c of list) await this.upsertCustomer(channelId, c);
    return list.length;
  }

  private async insertRefund(
    db: DrizzleDB | Parameters<Parameters<DrizzleDB["transaction"]>[0]>[0],
    channelId: string,
    orderId: string,
    r: NormalizedRefund,
  ): Promise<void> {
    await db
      .insert(refunds)
      .values({
        orderId,
        channelId,
        externalId: r.externalId,
        amount: r.amount,
        shippingRefunded: r.shippingRefunded,
        taxRefunded: r.taxRefunded,
        note: r.note,
        processedAt: r.processedAt,
        shopifyCreatedAt: r.shopifyCreatedAt,
      })
      .onConflictDoUpdate({
        target: [refunds.channelId, refunds.externalId],
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
