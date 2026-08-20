// Preload mínimo: expõe apenas o que o app precisa (nada por padrão).
// O SPA roda 100% com APIs da web; sem ponte Node.
'use strict'
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('lifeOrganizer', {
  platform: process.platform,
  isDesktop: true
})