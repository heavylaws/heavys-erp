import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    printReceipt: (data: any) => ipcRenderer.invoke('print-receipt', data)
});
