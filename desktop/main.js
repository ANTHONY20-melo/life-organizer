/* LIFE ORGANIZER — Desktop (Electron)
   Segurança: contextIsolation ON, nodeIntegration OFF, sandbox ON.
   Carrega o MESMO SPA via file:// (zero servidor, 100% offline). */
'use strict'
const { app, BrowserWindow, shell, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '..')

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 360,
    minHeight: 600,
    title: 'Life Organizer',
    backgroundColor: '#0f1620',
    icon: path.join(ROOT, 'icons', 'icon-512.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })
  win.loadFile(path.join(ROOT, 'index.html'))
  // links externos abrem no navegador padrão, nunca dentro do app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  return win
}

app.whenReady().then(() => {
  const win = createWindow()
  // flag de smoke test: valida o load e sai (CI)
  if (process.argv.includes('--smoke')) {
    win.webContents.once('did-finish-load', () => {
      console.log('SMOKE OK — janela carregou')
      app.exit(0)
    })
    win.webContents.once('did-fail-load', (_e, code, desc) => {
      console.error('SMOKE FAIL — ' + code + ' ' + desc)
      app.exit(1)
    })
  }
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })