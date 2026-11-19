import { Router } from 'express';

import { categoryRouter } from '@/routes/menu/category.routes';
import { itemRouter } from '@/routes/menu/item.routes';

const menuRouter = Router();

menuRouter.use('/categories', categoryRouter);
menuRouter.use('/items', itemRouter);

export { menuRouter };
