'use client'

import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:4000'
    socket = io(url, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    })
  }
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

interface OrderRejectedData { orderId: string; reason: string }
interface OrderStatusChangedData { orderId: string; status: string; previousStatus: string }
interface ItemCancelledData { orderId: string; itemId: string; itemName: string; quantity: number; reason: string }

export function onOrderRejected(handler: (data: OrderRejectedData) => void): () => void {
  const s = getSocket()
  s.on('order:rejected', handler)
  return () => s.off('order:rejected', handler)
}

export function onOrderStatusChanged(handler: (data: OrderStatusChangedData) => void): () => void {
  const s = getSocket()
  s.on('order:status_changed', handler)
  return () => s.off('order:status_changed', handler)
}

export function onItemCancelled(handler: (data: ItemCancelledData) => void): () => void {
  const s = getSocket()
  s.on('item:cancelled', handler)
  return () => s.off('item:cancelled', handler)
}

export function joinSession(sessionId: string) {
  const s = getSocket()
  s.emit('join:session', sessionId)
}

export function leaveSession(sessionId: string) {
  const s = getSocket()
  s.emit('leave:session', sessionId)
}