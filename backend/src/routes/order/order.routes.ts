import { Router } from 'express';

import {
  cancelOrderController,
  closeSessionController,
  confirmOrderController,
  createStaffOrderController,
  getKitchenBoardController,
  getOrderController,
  listOrdersController,
  listSessionsController,
  rejectOrderController,
  requestBillController,
  updateOrderItemStatusController,
  updateOrderStatusController,
} from '@/controllers/order/order.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';
import {
  cancelOrderSchema,
  createStaffOrderSchema,
  kitchenBoardSchema,
  listOrdersSchema,
  listSessionsSchema,
  orderIdSchema,
  rejectOrderSchema,
  sessionIdSchema,
  updateOrderItemStatusSchema,
  updateOrderStatusSchema,
} from '@/validations/order/order.schema';

const orderRouter = Router();

orderRouter.use(authMiddleware);

orderRouter.get('/', requireOrgPermission('order.create'), validate({ query: listOrdersSchema.shape.query }), listOrdersController);

orderRouter.post('/', requireOrgPermission('order.create'), validate({ body: createStaffOrderSchema.shape.body }), createStaffOrderController);

orderRouter.get('/:id', requireOrgPermission('order.create'), validate({ params: orderIdSchema.shape.params }), getOrderController);

orderRouter.patch('/:id/confirm', requireOrgPermission('order.update_status'), validate({ params: orderIdSchema.shape.params }), confirmOrderController);

orderRouter.patch('/:id/reject', requireOrgPermission('order.update_status'), validate({ params: orderIdSchema.shape.params, body: rejectOrderSchema.shape.body }), rejectOrderController);

orderRouter.patch('/:id/status', requireOrgPermission('order.update_status'), validate({ params: orderIdSchema.shape.params, body: updateOrderStatusSchema.shape.body }), updateOrderStatusController);

orderRouter.patch('/items/:id/status', requireOrgPermission('order.update_status'), validate({ params: orderIdSchema.shape.params, body: updateOrderItemStatusSchema.shape.body }), updateOrderItemStatusController);

orderRouter.delete('/:id', requireOrgPermission('order.cancel'), validate({ params: orderIdSchema.shape.params, body: cancelOrderSchema.shape.body }), cancelOrderController);

orderRouter.get('/kitchen/board', requireOrgPermission('order.create'), validate({ query: kitchenBoardSchema.shape.query }), getKitchenBoardController);

orderRouter.post('/sessions/:id/request-bill', validate({ params: sessionIdSchema.shape.params }), requestBillController);

orderRouter.post('/sessions/:id/close', requireOrgPermission('order.create'), validate({ params: sessionIdSchema.shape.params }), closeSessionController);

orderRouter.get('/sessions', requireOrgPermission('order.create'), validate({ query: listSessionsSchema.shape.query }), listSessionsController);

export { orderRouter };