import { Router } from 'express';

export function createBootstrapRouter({ simulatorService, legalResearchService }) {
  const router = Router();

  router.get('/bootstrap', (_request, response) => {
    response.json({
      ...simulatorService.getBootstrap(),
      courtlistenerStatus: legalResearchService.getCourtListenerStatus()
    });
  });

  return router;
}
