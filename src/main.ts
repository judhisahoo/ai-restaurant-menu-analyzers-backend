import "dotenv/config";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
const {
  buildSwaggerInitJS,
} = require("@nestjs/swagger/dist/swagger-ui/swagger-ui");

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  /*app.enableCors({
    origin: true,
    credentials: true,
  });*/
  app.enableCors({
    origin: "*",
  });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Restaurant Menu AI Backend")
    .setDescription(
      "REST API for the restaurant menu scan thesis workflow: scan menu, process AI menu items, view dish components, and open ingredient details.",
    )
    .setVersion("1.0.0")
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  app.getHttpAdapter().get("/api/docs-json", (_request: any, response: any) => {
    response.json(swaggerDocument);
  });

  app
    .getHttpAdapter()
    .get("/api/docs/swagger-ui-init.js", (_request: any, response: any) => {
      response.type("application/javascript");
      const swaggerInitJs = buildSwaggerInitJS(swaggerDocument, {
        swaggerOptions: {
          url: "/api/docs-json",
        },
      });
      response.send(swaggerInitJs);
    });

  const swaggerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Restaurant Menu AI Backend</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-standalone-preset.js"></script>
  <script src="/api/docs/swagger-ui-init.js"></script>
  <style>
    .swagger-ui .topbar .download-url-wrapper { display: none }
  </style>
</body>
</html>`;

  app.getHttpAdapter().get("/api/docs", (_request: any, response: any) => {
    response.type("text/html");
    response.send(swaggerHtml);
  });

  app.getHttpAdapter().get("/api/docs/", (_request: any, response: any) => {
    response.type("text/html");
    response.send(swaggerHtml);
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

bootstrap();
