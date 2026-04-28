import { Router } from 'express';

export function createChatRouter({ legalResearchService }) {
  const router = Router();

  router.post('/chat/reset', async (request, response, next) => {
    try {
      response.json(await legalResearchService.resetChat(request.body ?? {}));
    } catch (error) {
      next(error);
    }
  });

  router.post('/chat/turn', async (request, response, next) => {
    try {
      response.json(await legalResearchService.submitTurn(request.body ?? {}));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
