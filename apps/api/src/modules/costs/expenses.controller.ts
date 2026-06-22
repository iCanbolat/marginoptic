import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  customExpenseInputSchema,
  customExpenseUpdateSchema,
  expenseMaterializeSchema,
  type CustomExpenseInput,
  type CustomExpenseSummary,
  type CustomExpenseUpdate,
  type ExpenseAllocationRow,
  type ExpenseMaterializeInput,
} from "@churnify/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  type ActiveOrg,
  CurrentOrg,
} from "../auth/decorators/current-org.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { ExpensesService } from "./expenses.service";

const EDIT_ROLES = ["owner", "admin", "analyst"] as const;

@ApiTags("costs")
@ApiBearerAuth()
@Controller("costs/expenses")
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  list(
    @CurrentOrg() org: ActiveOrg,
    @Query("storeId") storeId?: string,
  ): Promise<CustomExpenseSummary[]> {
    return this.expenses.list(org.id, storeId);
  }

  @Post()
  @Roles(...EDIT_ROLES)
  create(
    @CurrentOrg() org: ActiveOrg,
    @Body(new ZodValidationPipe(customExpenseInputSchema))
    dto: CustomExpenseInput,
  ): Promise<CustomExpenseSummary> {
    return this.expenses.create(org.id, dto);
  }

  @Patch(":id")
  @Roles(...EDIT_ROLES)
  update(
    @CurrentOrg() org: ActiveOrg,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(customExpenseUpdateSchema))
    dto: CustomExpenseUpdate,
  ): Promise<CustomExpenseSummary> {
    return this.expenses.update(org.id, id, dto);
  }

  @Delete(":id")
  @Roles(...EDIT_ROLES)
  @HttpCode(204)
  remove(
    @CurrentOrg() org: ActiveOrg,
    @Param("id") id: string,
  ): Promise<void> {
    return this.expenses.remove(org.id, id);
  }

  /** Materialize edilmiş gün+mağaza dağılımını döner (job doğrulaması için). */
  @Get(":id/allocations")
  allocations(
    @CurrentOrg() org: ActiveOrg,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(expenseMaterializeSchema))
    range: ExpenseMaterializeInput,
  ): Promise<ExpenseAllocationRow[]> {
    return this.expenses.listAllocations(org.id, id, range.from, range.to);
  }

  /** Gideri belirli aralıkta yeniden materialize etmeyi kuyruğa alır. */
  @Post(":id/materialize")
  @Roles(...EDIT_ROLES)
  @HttpCode(202)
  async materialize(
    @CurrentOrg() org: ActiveOrg,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(expenseMaterializeSchema))
    range: ExpenseMaterializeInput,
  ): Promise<{ queued: true }> {
    await this.expenses.assertOwned(org.id, id);
    await this.expenses.enqueueMaterialize(id, range.from, range.to);
    return { queued: true };
  }
}
