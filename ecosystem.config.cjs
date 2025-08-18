/**
 * PM2 생태계 설정 파일 (CommonJS)
 * AI휴먼 플랫폼 개발 서버 관리
 */

module.exports = {
  apps: [
    {
      name: 'aihuman-webapp',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false, // 개발 중에는 false로 설정 (수동 재시작)
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G'
    }
  ]
};