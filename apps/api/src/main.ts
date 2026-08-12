import './instrument';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { json } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '100kb' }));

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", 'https://*.supabase.co', 'https://*.ingest.sentry.io'],
        },
      },
    }),
  );

  const origins: string[] = [
    'https://quedamos-app-mobile.vercel.app',
    'https://localhost', // Capacitor Android (androidScheme: 'https')
  ];
  if (process.env.NODE_ENV !== 'production') {
    origins.push(
      'http://localhost:5173',
      'http://localhost:8100',
      'https://localhost',
      'http://localhost',
    );
  }
  if (process.env.CORS_ORIGIN) {
    origins.push(process.env.CORS_ORIGIN);
  }

  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Quedamos API')
      .setDescription('API para coordinar quedadas entre grupos de amigos')
      .setVersion('0.2.3')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}
bootstrap();
