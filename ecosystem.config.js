module.exports = {
  apps: [
    {
      name: "caltims-backend",
      script: "server.js",
      cwd: "./backend",
      env: {
        NODE_ENV: "production",
      },
      env_file: ".env",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G"
    }
  ]
};
