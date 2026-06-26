import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
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
  switchStoreSchema,
  type LoginInput,
  type RegisterInput,
  type SessionResponse,
  type SwitchStoreInput,
} from "@churnify/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";
import type { AuthContext } from "./auth.types";
import { CurrentUser } from "./decorators/current-user.decorator";
import { GoogleAuthService } from "./google-auth.service";
import { Public } from "./decorators/public.decorator";

const REFRESH_COOKIE = "churnify_rt";
const REFRESH_PATH = "/api/auth";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleAuthService,
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

  /** Google sosyal-login başlat: state üret, Google onay ekranına yönlendir. */
  @Public()
  @Get("google/start")
  async googleStart(@Res() res: Response): Promise<void> {
    const url = await this.google.createAuthUrl();
    res.redirect(url);
  }

  /**
   * Google callback: state doğrula + oturum kur, refresh cookie set et,
   * web'in /auth/callback rotasına yönlendir (orada refresh ile oturum alınır).
   */
  @Public()
  @Get("google/callback")
  async googleCallback(
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ): Promise<void> {
    const webOrigin = this.config.getOrThrow<string>("WEB_ORIGIN");
    try {
      const { refreshToken } = await this.google.handleCallback(query);
      this.setRefreshCookie(res, refreshToken);
      res.redirect(`${webOrigin}/auth/callback`);
    } catch (err) {
      this.logger.warn(`Google callback başarısız: ${String(err)}`);
      res.redirect(`${webOrigin}/login?error=google`);
    }
  }

  @ApiBearerAuth()
  @Get("me")
  me(@CurrentUser() user: AuthContext) {
    return this.auth.me(user.userId);
  }

  @ApiBearerAuth()
  @HttpCode(200)
  @Post("switch-store")
  switchStore(
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(switchStoreSchema)) dto: SwitchStoreInput,
    @Req() req: Request,
  ) {
    const raw = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? null;
    return this.auth.switchStore(user.userId, dto.storeId, raw);
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
