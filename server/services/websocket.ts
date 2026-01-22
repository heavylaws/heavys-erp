import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

let wssGlobal: WebSocketServer | null = null;

export function setupWebSocket(server: Server) {
    wssGlobal = new WebSocketServer({
        server,
        path: '/ws'
    });

    console.log('socket.io/ws setup completed for path /ws');

    wssGlobal.on('connection', (ws) => {
        console.log('New WebSocket connection established');

        ws.on('message', (message) => {
            // Echo for keepalive or simple testing
            try {
                const data = JSON.parse(message.toString());
                if (data.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong' }));
                }
            } catch (e) {
                // ignore non-json
            }
        });

        ws.on('close', () => {
            // console.log('Client disconnected');
        });
    });

    return wssGlobal;
}

export function getWebSocketServer() {
    return wssGlobal;
}

export function broadcast(message: any) {
    if (!wssGlobal) return;

    const messageStr = JSON.stringify(message);
    wssGlobal.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

export function broadcastOrderUpdate(order: any) {
    if (!wssGlobal) return;
    const message = JSON.stringify({ type: 'order_update', data: order });
    wssGlobal.clients.forEach((client) => {
        try {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        } catch (e) {
            console.warn('Failed to send ws message', e);
        }
    });
}
