import crypto from 'node:crypto';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import pinoHttp from 'pino-http';

const allowedContentTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedContentTypes.has(file.mimetype)) {
      const error = new Error('Only PDF, JPEG, and PNG evidence files are accepted');
      error.status = 400;
      return callback(error);
    }
    return callback(null, true);
  }
});

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function createApp({ repository, objectStorage, disputeClient, authenticate, logger }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use(pinoHttp({ logger }));
  app.get('/health', (_req, res) => res.json({ service: 'evidence-service', status: 'ok' }));
  app.use('/api/v1', authenticate);

  app.post('/api/v1/disputes/:disputeId/evidence', upload.single('file'), asyncRoute(async (req, res) => {
    if (!validUuid(req.params.disputeId)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid dispute identifier' } });
    }
    if (!req.file) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'A file field is required' } });
    }
    const dispute = await disputeClient.getDispute(req.params.disputeId, req.accessToken);
    if (!dispute) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Dispute not found' } });
    if (['RESOLVED', 'REJECTED'].includes(dispute.status)) {
      return res.status(409).json({ error: { code: 'DISPUTE_CLOSED', message: 'Evidence cannot be added to a closed dispute' } });
    }

    const extension = path.extname(req.file.originalname).toLowerCase().slice(0, 10);
    const objectName = `disputes/${req.params.disputeId}/${crypto.randomUUID()}${extension}`;
    const checksum = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    await objectStorage.upload(objectName, req.file.buffer, req.file.mimetype, {
      disputeId: req.params.disputeId,
      uploaderId: req.user.id,
      checksum
    });
    try {
      const evidence = await repository.create({
        disputeId: req.params.disputeId,
        uploaderId: req.user.id,
        filename: req.file.originalname,
        objectName,
        contentType: req.file.mimetype,
        sizeBytes: req.file.size,
        checksum
      });
      return res.status(201).json(evidence);
    } catch (error) {
      await objectStorage.remove(objectName);
      throw error;
    }
  }));

  app.get('/api/v1/disputes/:disputeId/evidence', asyncRoute(async (req, res) => {
    const dispute = await disputeClient.getDispute(req.params.disputeId, req.accessToken);
    if (!dispute) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Dispute not found' } });
    return res.json({ items: await repository.list(req.params.disputeId) });
  }));

  app.get('/api/v1/evidence/:id/content', asyncRoute(async (req, res) => {
    const evidence = await repository.findById(req.params.id);
    if (!evidence) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Evidence not found' } });
    const dispute = await disputeClient.getDispute(evidence.disputeId, req.accessToken);
    if (!dispute) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Dispute not found' } });
    const contents = await objectStorage.download(evidence.objectName);
    const safeFilename = evidence.filename.replace(/["\\\r\n]/g, '_');
    res.setHeader('content-type', evidence.contentType);
    res.setHeader('content-length', contents.length);
    res.setHeader('content-disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('x-content-checksum-sha256', evidence.checksum);
    return res.send(contents);
  }));

  app.delete('/api/v1/evidence/:id', asyncRoute(async (req, res) => {
    const evidence = await repository.findById(req.params.id);
    if (!evidence) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Evidence not found' } });
    const dispute = await disputeClient.getDispute(evidence.disputeId, req.accessToken);
    if (!dispute) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Dispute not found' } });
    if (['RESOLVED', 'REJECTED'].includes(dispute.status)) {
      return res.status(409).json({ error: { code: 'DISPUTE_CLOSED', message: 'Evidence cannot be removed from a closed dispute' } });
    }
    await objectStorage.remove(evidence.objectName);
    await repository.remove(evidence.id);
    return res.status(204).send();
  }));

  app.use((req, res) => res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found' } }));
  app.use((error, req, res, _next) => {
    const status = error instanceof multer.MulterError ? 400 : error.status || 500;
    if (status >= 500) req.log.error({ err: error }, 'request failed');
    res.status(status).json({
      error: {
        code: error instanceof multer.MulterError ? 'UPLOAD_ERROR' : status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
        message: error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
          ? 'Evidence files must not exceed 5 MB'
          : error.message
      }
    });
  });
  return app;
}
