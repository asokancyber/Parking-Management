import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsString, MinLength, MaxLength } from 'class-validator';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDriverDto, LoginDto } from './dto';
import { JwtAuthGuard } from './jwt-auth.guard';

class LoginByPlateDto {
  @IsString() @MinLength(2) @MaxLength(20)
  plate!: string;
  @IsString() @MinLength(1)
  password!: string;
}

class ChangePasswordDto {
  @IsString() @MinLength(1)
  currentPassword!: string;
  @IsString() @MinLength(8)
  newPassword!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDriverDto, @Req() req: Request) {
    return this.auth.registerDriver(dto, req.ip);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, req.ip);
  }

  // Driver portal login by vehicle plate.
  @Post('login-driver')
  loginByPlate(@Body() dto: LoginByPlateDto, @Req() req: Request) {
    return this.auth.loginByPlate(dto.plate, dto.password, req.ip);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(@Body() dto: ChangePasswordDto, @Req() req: Request) {
    const user = req.user as { userId: string };
    return this.auth.changePassword(user.userId, dto.currentPassword, dto.newPassword, req.ip);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request) {
    const user = req.user as { userId: string };
    return this.auth.me(user.userId);
  }
}
