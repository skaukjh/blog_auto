/**
 * Electron 메인 프로세스
 *
 * 화면(renderer)에서 받은 글을 Playwright로 네이버에 순차 입력합니다.
 * 계정 정보는 디스크에 저장하지 않고 이 프로세스 메모리에만 잠깐 머뭅니다.
 */
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const { typePost } = require('../lib/naver-typer.cjs');

/** 실행 중인 작업의 중단 플래그 */
let stopRequested = false;
let running = false;

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 860,
    minWidth: 720,
    minHeight: 640,
    title: '네이버 블로그 순차입력기',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // 외부 링크는 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

app.whenReady().then(() => {
  const win = createWindow();

  ipcMain.handle('typer:start', async (_event, options) => {
    if (running) {
      return { success: false, error: '이미 입력이 진행 중입니다.' };
    }

    running = true;
    stopRequested = false;

    try {
      return await typePost({
        ...options,
        onProgress: (payload) => {
          if (!win.isDestroyed()) win.webContents.send('typer:progress', payload);
        },
        shouldStop: () => stopRequested,
      });
    } finally {
      running = false;
    }
  });

  ipcMain.handle('typer:stop', () => {
    stopRequested = true;
    return { ok: true };
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

// 입력 도중 창을 닫으려 하면 한 번 물어봅니다.
app.on('before-quit', (event) => {
  if (!running) return;

  const choice = dialog.showMessageBoxSync({
    type: 'question',
    buttons: ['계속 진행', '종료'],
    defaultId: 0,
    cancelId: 0,
    title: '입력이 진행 중입니다',
    message: '아직 글을 입력하는 중입니다. 지금 종료하면 입력이 중단됩니다.',
  });

  if (choice === 0) {
    event.preventDefault();
  } else {
    stopRequested = true;
  }
});
