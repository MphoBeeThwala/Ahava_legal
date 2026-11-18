import type { Request, Response } from 'express';
import { sendError } from '../lib/http';
import * as intakeService from '../services/intake.service';

async function createSubmission(req: Request, res: Response) {
  try {
    const submission = await intakeService.createSubmission(req.body, req.auth ?? {});
    res.status(201).json(submission);
  } catch (error) {
    sendError(res, error);
  }
}

async function listSubmissions(req: Request, res: Response) {
  try {
    const submissions = await intakeService.listSubmissions();
    res.status(200).json(submissions);
  } catch (error) {
    sendError(res, error);
  }
}

async function getSubmission(req: Request, res: Response) {
  try {
    const submission = await intakeService.getSubmission(String(req.params.id));
    if (!submission) {
      return res.status(404).json({ message: 'Intake submission not found' });
    }

    res.status(200).json(submission);
  } catch (error) {
    sendError(res, error);
  }
}

async function assessSubmission(req: Request, res: Response) {
  try {
    // ?background=1: start it and answer 202; the client polls the submission.
    // ?force=1: assess again even though the intake already has an assessment.
    const force = req.query.force === '1' || req.query.force === 'true';
    if (req.query.background === '1' || req.query.background === 'true') {
      const started = await intakeService.startAssessment(String(req.params.id), req.auth, {
        force,
      });
      return res.status(started.assessmentJob?.state === 'running' ? 202 : 200).json(started);
    }
    const assessment = await intakeService.assessSubmission(String(req.params.id), req.auth, {
      force,
    });
    res.status(200).json(assessment);
  } catch (error) {
    sendError(res, error);
  }
}

async function listCases(req: Request, res: Response) {
  try {
    const cases = await intakeService.listCases();
    res.status(200).json(cases);
  } catch (error) {
    sendError(res, error);
  }
}

async function getSummary(req: Request, res: Response) {
  try {
    const summary = await intakeService.getSummary();
    res.status(200).json(summary);
  } catch (error) {
    sendError(res, error);
  }
}

export {
  assessSubmission,
  createSubmission,
  getSubmission,
  getSummary,
  listCases,
  listSubmissions,
};
