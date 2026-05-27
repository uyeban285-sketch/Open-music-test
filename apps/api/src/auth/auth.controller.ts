import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const RefreshSchema = z.object({
  refreshToken: z.string(),
});

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: unknown) {
    const { email, password } = RegisterSchema.parse(body);
    const tokens = await this.authService.register(email, password);
    return { status: 'success', data: tokens };
  }

  @Post('login')
  async login(@Body() body: unknown) {
    const { email, password } = LoginSchema.parse(body);
    const tokens = await this.authService.login(email, password);
    return { status: 'success', data: tokens };
  }

  @Post('refresh')
  async refresh(@Body() body: unknown) {
    const { refreshToken } = RefreshSchema.parse(body);
    const tokens = await this.authService.refresh(refreshToken);
    return { status: 'success', data: tokens };
  }

  @Post('logout')
  async logout(@Body() body: unknown) {
    const { refreshToken } = RefreshSchema.parse(body);
    await this.authService.logout(refreshToken);
    return { status: 'success', message: 'Logged out' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: any) {
    const user = await this.authService.getMe(req.userId);
    return { status: 'success', data: user };
  }
}
