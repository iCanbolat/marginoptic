import {
  type ArgumentMetadata,
  BadRequestException,
  Injectable,
  type PipeTransform,
} from "@nestjs/common";
import type { ZodSchema } from "zod";

/**
 * Zod şemasına göre body/query doğrular. Paylaşılan (@churnify/shared) şemalar
 * hem API hem web tarafında tek kaynaktan kullanılır.
 *
 * `safeParse` kullanılır; böylece şema farklı bir zod kopyasından gelse bile
 * (monorepo'da olası) `instanceof` sorunundan etkilenmeyiz.
 *
 * Kullanım: `@Body(new ZodValidationPipe(loginSchema)) dto: LoginInput`
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: "Doğrulama hatası",
        issues: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
    return result.data;
  }
}
