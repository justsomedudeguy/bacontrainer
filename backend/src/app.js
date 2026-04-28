import cors from 'cors';
import express from 'express';
import env from './config/env.js';
import { createChatRouter } from './routes/chat.js';
import { createBootstrapRouter } from './routes/bootstrap.js';
import { createHealthRouter } from './routes/health.js';
import { createSimulatorRouter } from './routes/simulator.js';
import { CourtListenerClient } from './services/CourtListenerClient.js';
import { CourtListenerService } from './services/CourtListenerService.js';
import { LegalResearchService } from './services/LegalResearchService.js';
import { SimulatorService } from './services/SimulatorService.js';
import { UsageLoggerService } from './services/UsageLoggerService.js';
import { AnalysisJobService } from './services/AnalysisJobService.js';
import { HttpError } from './utils/httpError.js';

export function createApp({ config = env, usageLogger = null } = {}) {
  const app = express();
  const logger =
    usageLogger ||
    new UsageLoggerService({
      logDirectory: config.usageLogDirectory
    });
  const courtListenerClient = new CourtListenerClient({
    baseUrl: config.courtlistener.baseUrl,
    apiToken: config.courtlistener.apiToken
  });
  const courtListenerService = new CourtListenerService({
    client: courtListenerClient,
    config,
    usageLogger: logger
  });
  const simulatorService = new SimulatorService({
    config,
    courtListenerService,
    usageLogger: logger
  });
  const legalResearchService = new LegalResearchService({
    config,
    courtListenerService,
    usageLogger: logger
  });
  const analysisJobService = new AnalysisJobService();

  app.use(
    cors({
      origin: config.frontendOrigin,
      credentials: false
    })
  );
  app.use(express.json());

  app.use('/api', createHealthRouter({ config }));
  app.use('/api', createBootstrapRouter({ simulatorService, legalResearchService }));
  app.use('/api', createSimulatorRouter({ simulatorService, analysisJobService }));
  app.use('/api', createChatRouter({ legalResearchService }));

  app.use((error, _request, response, _next) => {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;

    response.status(statusCode).json({
      error: error.message || 'Unexpected server error.',
      ...(error.details ? { details: error.details } : {})
    });
  });

  return app;
}
