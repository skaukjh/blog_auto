/**
 * 렌더러에 최소한의 창구만 열어 줍니다.
 * contextIsolation이 켜져 있어 렌더러는 Node API에 직접 접근할 수 없습니다.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('typer', {
  /** 순차 입력을 시작하고 결과를 돌려줍니다 */
  start: (options) => ipcRenderer.invoke('typer:start', options),

  /** 진행 중인 입력을 중단합니다 */
  stop: () => ipcRenderer.invoke('typer:stop'),

  /** 진행 상황 구독. 해제 함수를 돌려줍니다 */
  onProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('typer:progress', listener);
    return () => ipcRenderer.removeListener('typer:progress', listener);
  },
});
