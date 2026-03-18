# CubePath Bun OpenRouter API

Aplicacion con Bun que expone:

- `GET /health` para comprobar el estado del servidor
- `POST /api/chat/stream` para recibir respuestas en streaming desde OpenRouter
- una interfaz web en `/` que muestra el texto en vivo mientras llega

## Requisitos

- Bun instalado
- una clave `OPENROUTER_API_KEY`

## Configuracion

1. Copia `.env.example` a `.env`
2. Rellena `OPENROUTER_API_KEY`

`OPENROUTER_MODEL` usa por defecto `openrouter/free`, el router gratuito de OpenRouter que selecciona modelos gratis compatibles.

## Ejecutar

```bash
bun run dev
```

Abre [http://localhost:3000](http://localhost:3000)

## Probar

```bash
bun test
```

Las pruebas verifican:

- el endpoint `/health`
- que la interfaz principal se sirva correctamente
- que el endpoint SSE entregue eventos de streaming

Nota: las pruebas locales usan un proveedor simulado para validar el flujo SSE sin depender de red ni de una API key real. La integracion real con OpenRouter queda activa al configurar `OPENROUTER_API_KEY`.
