import { Router } from 'express';
import { HttpError } from '../utils/httpError.js';

export function createSimulatorRouter({ simulatorService, analysisJobService }) {
  const router = Router();

  router.post('/simulator/reset', async (request, response, next) => {
    try {
      response.json(await simulatorService.resetScenario(request.body ?? {}));
    } catch (error) {
      next(error);
    }
  });

  router.post('/simulator/turn', async (request, response, next) => {
    try {
      response.json(await simulatorService.submitTurn(request.body ?? {}));
    } catch (error) {
      next(error);
    }
  });

  router.post('/simulator/analyze', async (request, response, next) => {
    try {
      response.json(await simulatorService.analyzeScenario(request.body ?? {}));
    } catch (error) {
      next(error);
    }
  });

  router.post('/simulator/analyze-jobs', (request, response, next) => {
    try {
      const job = analysisJobService.createJob(() =>
        simulatorService.analyzeScenario(request.body ?? {})
      );

      response.status(202).json({
        jobId: job.id,
        status: job.status,
        statusUrl: `/api/simulator/analyze-jobs/${job.id}`,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/simulator/analyze-jobs/:jobId', (request, response, next) => {
    try {
      const job = analysisJobService.getJob(request.params.jobId);

      if (!job) {
        throw new HttpError(404, 'Analysis job not found.');
      }

      response.json({
        jobId: job.id,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        ...(job.result ? { result: job.result } : {}),
        ...(job.error ? { error: job.error } : {})
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/simulator/invent-scenario', async (request, response, next) => {
    try {
      response.json(await simulatorService.inventScenario(request.body ?? {}));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
