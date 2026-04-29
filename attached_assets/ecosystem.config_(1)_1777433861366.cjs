module.exports = {
  apps: [{
    name: "fitro360",
    script: "dist/index.cjs",
    cwd: "/home/fitro360/htdocs/www.fitro360.com/fitro360",
    env: {
      PORT: "5000",
      DATABASE_URL: "postgresql://automystics:automystics@127.0.0.1:5432/fitro360",
      SESSION_SECRET: "fc9cd50a3b62032a0f9f6ffa38574b01e3866d406eb870e2aad3f09ef5a10f5a",
      NODE_ENV: "production"
    }
  }]
};
