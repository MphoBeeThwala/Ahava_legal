// Drafting from the standard templates (roadmap 15a). Mounted at /api; each
// route authenticates itself. Drafts live on matters (matter access applies).
import express, { type Request, type Response } from 'express';
import { sendError } from '../lib/http';
import { authenticateRequest, requirePermission } from '../services/auth.service';
import * as drafting from '../services/drafting.service';

const router = express.Router();

const handle =
  (fn: (req: Request) => Promise<unknown>, status = 200) =>
  async (req: Request, res: Response) => {
    try {
      const result = await fn(req);
      if (result === undefined) res.status(204).end();
      else res.status(status).json(result);
    } catch (error) {
      sendError(res, error);
    }
  };

const caseId = (req: Request) => String(req.params.caseId);
const draftId = (req: Request) => String(req.params.draftId);

router.get(
  '/drafting/catalogue',
  authenticateRequest,
  requirePermission('drafting.use'),
  handle(async () => drafting.catalogue()),
);

router.get(
  '/cases/:caseId/drafts',
  authenticateRequest,
  requirePermission('drafting.use', 'matters.read'),
  handle((req) => drafting.listDrafts(caseId(req))),
);

router.post(
  '/cases/:caseId/drafts',
  authenticateRequest,
  requirePermission('drafting.use', 'matters.read'),
  handle((req) => drafting.createDraft(caseId(req), req.body, req.auth ?? {}), 201),
);

router.get(
  '/cases/:caseId/drafts/:draftId',
  authenticateRequest,
  requirePermission('drafting.use', 'matters.read'),
  handle((req) => drafting.getDraft(caseId(req), draftId(req))),
);

router.put(
  '/cases/:caseId/drafts/:draftId',
  authenticateRequest,
  requirePermission('drafting.use', 'matters.read'),
  handle((req) => drafting.updateDraft(caseId(req), draftId(req), req.body, req.auth ?? {})),
);

router.post(
  '/cases/:caseId/drafts/:draftId/submit',
  authenticateRequest,
  requirePermission('drafting.use', 'matters.read'),
  handle((req) => drafting.submitDraft(caseId(req), draftId(req), req.auth ?? {})),
);

router.post(
  '/cases/:caseId/drafts/:draftId/finalise',
  authenticateRequest,
  requirePermission('drafting.approve', 'documents.write', 'matters.read'),
  handle((req) => drafting.finaliseDraft(caseId(req), draftId(req), req.auth ?? {})),
);

router.delete(
  '/cases/:caseId/drafts/:draftId',
  authenticateRequest,
  requirePermission('drafting.use', 'matters.read'),
  handle((req) => drafting.deleteDraft(caseId(req), draftId(req), req.auth ?? {})),
);

router.get(
  '/cases/:caseId/drafts/:draftId/file',
  authenticateRequest,
  requirePermission('drafting.use', 'matters.read'),
  async (req: Request, res: Response) => {
    try {
      const format = req.query.format === 'pdf' ? 'pdf' : 'docx';
      const file = await drafting.renderDraft(caseId(req), draftId(req), format);
      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
      res.setHeader('Cache-Control', 'no-store');
      res.send(file.body);
    } catch (error) {
      sendError(res, error);
    }
  },
);

export default router;
