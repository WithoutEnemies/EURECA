import { io } from "socket.io-client";
import { API_BASE } from "../config/api";

export function connectConversationsSocket(token) {
  return io(API_BASE, {
    auth: { token },
    autoConnect: true,
    transports: ["websocket", "polling"],
  });
}
