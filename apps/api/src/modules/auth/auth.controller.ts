import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import {
  loginSchema,
  registerSchema,
  switchOrgSchema,
  type LoginInput,
  type RegisterInput,
  type SessionResponse,
  type SwitchOrgInput,
} from "@churnify/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";
import type { AuthContext } from "./auth.types";
import { CurrentUser } from "./decorators/current-user.decorator";
import { Public } from "./decorators/public.decorator";

const REFRESH_COOKIE = "churnify_rt";
const REFRESH_PATH = "/api/auth";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post("register")
  async register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    const { session, refreshToken } = await this.auth.register(dto);
    this.setRefreshCookie(res, refreshToken);
    return session;
  }

  @Public()
  @HttpCode(200)
  @Post("login")
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    const { session, refreshToken } = await this.auth.login(dto);
    this.setRefreshCookie(res, refreshToken);
    return session;
  }

  @Public()
  @HttpCode(200)
  @Post("refresh")
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    const { session, refreshToken } = await this.auth.refresh(
      this.readRefresh(req),
    );
    this.setRefreshCookie(res, refreshToken);
    return session;
  }

  @Public()
  @HttpCode(204)
  @Post("logout")
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (token) await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_PATH });
  }

  @ApiBearerAuth()
  @Get("me")
  me(@CurrentUser() user: AuthContext) {
    return this.auth.me(user.userId);
  }

  @ApiBearerAuth()
  @HttpCode(200)
  @Post("switch-org")
  switchOrg(
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(switchOrgSchema)) dto: SwitchOrgInput,
    @Req() req: Request,
  ) {
    const raw = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? null;
    return this.auth.switchOrg(user.userId, dto.organizationId, raw);
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.config.get("NODE_ENV") === "production",
      path: REFRESH_PATH,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  private readRefresh(req: Request): string {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) throw new UnauthorizedException("Oturum bulunamadı");
    return token;
  }
}
