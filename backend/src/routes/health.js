import { Router } from 'express';

export function createHealthRouter({ config }) {
  const router = Router();

  router.get('/health', (_request, response) => {
    response.json({
      status: 'ok',
      appMode: config.appMode
    });
  });

  return router;
}
