import { Router } from 'express';

import { authRouter } from '@/routes/auth/auth.routes';
import { healthRouter } from '@/routes/health/health.routes';
import { docsRouter } from '@/routes/docs/docs.routes';
import { staffRouter } from '@/routes/staff/staff.routes';
import { plansRouter } from '@/routes/plans/plans.routes';
import { outletsRouter } from '@/routes/outlets/outlets.routes';
import { publicTableRouter } from '@/routes/public/public-table.routes';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(docsRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/staff', staffRouter);
apiRouter.use('/plans', plansRouter);
apiRouter.use('/outlets', outletsRouter);
apiRouter.use('/public', publicTableRouter);
