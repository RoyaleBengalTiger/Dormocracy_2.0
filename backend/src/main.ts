import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';

import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  // 🍪 Cookies (must be registered early)
  await app.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET || 'jkdfsaajs;akdjlkhgahsfl',
  });

  // 🌍 CORS — REQUIRED for Lovable + cookies
  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      // Allow non-browser clients (Postman, curl)
      if (!origin) return cb(null, true);

      // Allow localhost
      if (
        origin === 'http://localhost:8080' ||
        origin === 'http://localhost:3000'
      ) {
        return cb(null, true);
      }

      // Allow ANY Lovable preview domain
      if (/^https:\/\/.*\.lovableproject\.com$/.test(origin)) {
        return cb(null, true);
      }

      // Otherwise block
      cb(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'ngrok-skip-browser-warning',
    ],
  });

  // 🧹 Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(
    process.env.PORT ? Number(process.env.PORT) : 3000,
    '0.0.0.0',
  );
}

bootstrap();
