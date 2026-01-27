import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

let wssGlobal: WebSocketServer | null = null;

export function setupWebSocket(server: Server) {
    wssGlobal = new WebSocketServer({
        noServer: true,
        path: '/ws/app'
    });

    console.log('[WS] WebSocket setup completed for path /ws/app');

    server.on('upgrade', (request, socket, head) => {
        const pathname = request.url;
        // Only handle our app's WebSocket path, let Vite HMR handle the rest
        if (pathname === '/ws/app' || pathname?.startsWith('/ws/app?')) {
            wssGlobal?.handleUpgrade(request, socket, head, (ws) => {
                wssGlobal?.emit('connection', ws, request);
            });
        }
        // Other upgrade requests (like Vite HMR) will be handled by their own listeners
    });

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
