import { Router } from 'express';

import { categoryRouter } from '@/routes/menu/category.routes';
import { effectiveMenuRouter } from '@/routes/menu/effective-menu.routes';
import { itemRouter } from '@/routes/menu/item.routes';
import { optionRouter } from '@/routes/menu/option.routes';
import { uploadRouter } from '@/routes/menu/upload.routes';
import { outletOverrideRouter } from '@/routes/menu/outlet-override.routes';
import { recipeRouter } from '@/routes/menu/recipe.routes';

const menuRouter = Router();

menuRouter.use('/categories', categoryRouter);
menuRouter.use('/items', recipeRouter);
menuRouter.use('/items', itemRouter);
menuRouter.use('/items', optionRouter);
menuRouter.use('/items', uploadRouter);
menuRouter.use('/items', outletOverrideRouter);
menuRouter.use('/effective', effectiveMenuRouter);

export { menuRouter };
