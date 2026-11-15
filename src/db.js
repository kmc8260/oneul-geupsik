// ===================================================================
// MySQL 연결 풀 (connection pool)
// 서버의 모든 파일은 이 pool을 가져가서 SQL을 실행합니다.
// "풀"은 DB 연결을 미리 몇 개 만들어 두고 돌려쓰는 방식이라, 요청마다 새로 접속하는 것보다 빠릅니다.
// ===================================================================
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'oneul_geupsik',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
});

module.exports = pool;
