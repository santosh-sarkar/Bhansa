import { Router } from 'express';

import { categoryRouter } from '@/routes/menu/category.routes';
import { itemRouter } from '@/routes/menu/item.routes';
import { optionRouter } from '@/routes/menu/option.routes';

const menuRouter = Router();

menuRouter.use('/categories', categoryRouter);
menuRouter.use('/items', itemRouter);
menuRouter.use('/items', optionRouter);

export { menuRouter };
