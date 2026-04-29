import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

export const useSocket = (event, callback) => {
  const socketRef = useRef(null);
  const token = useAuthStore(s => s.accessToken);

  useEffect(() => {
    if (!token) return;

    // Initialize socket connection
    socketRef.current = io(SOCKET_URL, {
      path: '/caltims/api/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
      auth: { token }
    });

    // Listen for the specified event
    if (event && callback) {
      socketRef.current.on(event, callback);
    }

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [event, callback]);

  const emit = (eventName, data) => {
    if (socketRef.current) {
      socketRef.current.emit(eventName, data);
    }
  };

  return { emit, socket: socketRef.current };
};
