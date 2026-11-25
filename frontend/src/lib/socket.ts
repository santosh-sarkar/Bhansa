'use client'

import React from 'react'
import { io, Socket, SocketOptions } from 'socket.io-client'
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

// Socket connection states
export type SocketConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed'

interface SocketContextValue {
  socket: Socket | null
  connectionState: SocketConnectionState
  connect: () => void
  disconnect: () => void
}

const SocketContext = createContext<SocketContextValue | null>(null)

// Configuration
const RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY_BASE = 1000 // 1 second base delay
const RECONNECT_DELAY_MAX = 30000 // 30 seconds max delay

let socketInstance: Socket | null = null
let reconnectAttempt = 0
let reconnectTimeout: NodeJS.Timeout | null = null
let isIntentionalDisconnect = false

function getSocketUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:4000'
}

function createSocketInstance(): Socket {
  const url = getSocketUrl()
  
  const options = {
    transports: ['websocket', 'polling'] as string[],
    withCredentials: true,
    autoConnect: false,
    reconnection: false, // We handle reconnection manually
    timeout: 10000,
  }

  const socket = io(url, options)

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id)
    reconnectAttempt = 0
  })

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason)
    if (!isIntentionalDisconnect && reason !== 'io client disconnect') {
      scheduleReconnect()
    }
  })

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error.message)
  })

  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log('[Socket] Reconnection attempt:', attemptNumber)
  })

  socket.on('reconnect', (attemptNumber) => {
    console.log('[Socket] Reconnected after', attemptNumber, 'attempts')
    reconnectAttempt = 0
  })

  socket.on('reconnect_failed', () => {
    console.error('[Socket] Reconnection failed after max attempts')
  })

  return socket
}

function scheduleReconnect() {
  if (reconnectAttempt >= RECONNECT_ATTEMPTS) {
    console.error('[Socket] Max reconnection attempts reached')
    return
  }

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
  }

  // Exponential backoff with jitter
  const delay = Math.min(
    RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttempt) + Math.random() * 1000,
    RECONNECT_DELAY_MAX
  )

  reconnectAttempt++
  console.log(`[Socket] Scheduling reconnect attempt ${reconnectAttempt} in ${Math.round(delay)}ms`)

  reconnectTimeout = setTimeout(() => {
    if (socketInstance && !socketInstance.connected && !isIntentionalDisconnect) {
      socketInstance.connect()
    }
  }, delay)
}

export function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = createSocketInstance()
  }
  return socketInstance
}

export function connectSocket() {
  isIntentionalDisconnect = false
  const socket = getSocket()
  if (!socket.connected) {
    socket.connect()
  }
}

export function disconnectSocket() {
  isIntentionalDisconnect = true
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }
  if (socketInstance) {
    socketInstance.disconnect()
    socketInstance = null
  }
  reconnectAttempt = 0
}

// Event listener helpers with automatic cleanup
export function onSocketEvent<T>(event: string, handler: (data: T) => void): () => void {
  const socket = getSocket()
  socket.on(event, handler)
  return () => socket.off(event, handler)
}

export function onOrderRejected(handler: (data: { orderId: string; reason: string }) => void): () => void {
  return onSocketEvent('order:rejected', handler)
}

export function onOrderStatusChanged(handler: (data: { orderId: string; status: string; previousStatus: string }) => void): () => void {
  return onSocketEvent('order:status_changed', handler)
}

export function onItemCancelled(handler: (data: { orderId: string; itemId: string; itemName: string; quantity: number; reason: string }) => void): () => void {
  return onSocketEvent('item:cancelled', handler)
}

export function onNotification(handler: (data: { notificationId: string; type: string; payload: Record<string, string> }) => void): () => void {
  return onSocketEvent('notification:new', handler)
}

export function joinSession(sessionId: string) {
  const socket = getSocket()
  socket.emit('join:session', sessionId)
}

export function leaveSession(sessionId: string) {
  const socket = getSocket()
  socket.emit('leave:session', sessionId)
}

// React Context Provider for connection state
export function SocketProvider({ children }: { children: ReactNode }) {
  const [connectionState, setConnectionState] = useState<SocketConnectionState>('disconnected')
  const [socket, setSocket] = useState<Socket | null>(null)

  const connect = useCallback(() => {
    isIntentionalDisconnect = false
    const s = getSocket()
    setSocket(s)
    
    const onConnect = () => setConnectionState('connected')
    const onDisconnect = (reason: string) => {
      if (isIntentionalDisconnect || reason === 'io client disconnect') {
        setConnectionState('disconnected')
      } else {
        setConnectionState('reconnecting')
      }
    }
    const onConnectError = () => setConnectionState('failed')
    const onReconnecting = (attempt: number) => setConnectionState('reconnecting')
    const onReconnect = () => setConnectionState('connected')
    const onReconnectFailed = () => setConnectionState('failed')

    s.on('connect', onConnect)
    s.on('disconnect', onDisconnect)
    s.on('connect_error', onConnectError)
    s.on('reconnecting', onReconnecting)
    s.on('reconnect', onReconnect)
    s.on('reconnect_failed', onReconnectFailed)

    if (!s.connected) {
      setConnectionState('connecting')
      s.connect()
    } else {
      setConnectionState('connected')
    }

    return () => {
      s.off('connect', onConnect)
      s.off('disconnect', onDisconnect)
      s.off('connect_error', onConnectError)
      s.off('reconnecting', onReconnecting)
      s.off('reconnect', onReconnect)
      s.off('reconnect_failed', onReconnectFailed)
    }
  }, [])

  const disconnect = useCallback(() => {
    disconnectSocket()
    setConnectionState('disconnected')
    setSocket(null)
  }, [])

  useEffect(() => {
    const cleanup = connect()
    return () => {
      cleanup()
    }
  }, [connect])

  const contextValue = { socket, connectionState, connect, disconnect }
  
  return React.createElement(
    SocketContext.Provider,
    { value: contextValue },
    children
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

// Hook for connection state only (lighter weight)
export function useSocketConnectionState(): SocketConnectionState {
  const context = useContext(SocketContext)
  if (!context) {
    return 'disconnected'
  }
  return context.connectionState
}