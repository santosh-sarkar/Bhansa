import { Router } from 'express';

import { categoryRouter } from '@/routes/menu/category.routes';
import { itemRouter } from '@/routes/menu/item.routes';
import { optionRouter } from '@/routes/menu/option.routes';
import { uploadRouter } from '@/routes/menu/upload.routes';
import { outletOverrideRouter } from '@/routes/menu/outlet-override.routes';

const menuRouter = Router();

menuRouter.use('/categories', categoryRouter);
menuRouter.use('/items', itemRouter);
menuRouter.use('/items', optionRouter);
menuRouter.use('/items', uploadRouter);
menuRouter.use('/items', outletOverrideRouter);

export { menuRouter };
