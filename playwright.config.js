import {defineConfig,devices} from '@playwright/test';

export default defineConfig({
  testDir:'./tests/e2e',
  timeout:30000,
  use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure'},
  webServer:{command:'python3 -m http.server 4173',port:4173,reuseExistingServer:true},
  projects:[
    {name:'desktop-chromium',use:{...devices['Desktop Chrome']}},
    {name:'iphone-chromium',use:{...devices['iPhone 15'],browserName:'chromium'}}
  ]
});
