import { Router, Request, Response } from 'express';
import { UserProfile } from '../models/UserProfile';

// NOTE: assumes UserProfile.ts exports an interface roughly like
//   { id: string; email: string; preferredLanguage?: string }
// Adjust the field names below if your actual model differs.

const router = Router();

// Stand-in for a real datastore during the demo
const users: Map<string, UserProfile> = new Map();

/**
 * GET /users/:id
 * Returns a user profile. preferredLanguage falls back to 'en-US'
 * when unset, per requirements_v3.docx (PROJ-8821).
 */
router.get('/users/:id', (req: Request, res: Response) => {
  const user = users.get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json({
    ...user,
    preferredLanguage: user.preferredLanguage ?? 'en-US',
  });
});

/**
 * PATCH /users/:id/language
 * Updates preferredLanguage. It's optional per the PRD contract, so
 * omitting the field is a no-op rather than an error.
 */
router.patch('/users/:id/language', (req: Request, res: Response) => {
  const user = users.get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { preferredLanguage } = req.body as { preferredLanguage?: string };
  if (preferredLanguage !== undefined) {
    user.preferredLanguage = preferredLanguage;
    users.set(req.params.id, user);
  }

  return res.json({
    ...user,
    preferredLanguage: user.preferredLanguage ?? 'en-US',
  });
});

/**
 * POST /users — demo seed helper only, not part of the feature contract.
 */
router.post('/users', (req: Request, res: Response) => {
  const { id, email, preferredLanguage } = req.body as Partial<UserProfile> & { id: string };
  const profile: UserProfile = { id, email, preferredLanguage } as UserProfile;
  users.set(id, profile);
  return res.status(201).json(profile);
});

export default router;