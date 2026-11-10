// ===================================================================
// MySQL 연결 풀 (connection pool)
// 서버의 모든 파일은 이 pool을 가져가서 SQL을 실행합니다.
// "풀"은 DB 연결을 미리 몇 개 만들어 두고 돌려쓰는 방식이라, 요청마다 새로 접속하는 것보다 빠릅니다.
// ===================================================================
const mysql = require('mysql2/promise'); // await로 쓸 수 있는(Promise) 버전의 mysql2

// 배포용 DB(TiDB·Aiven 등)는 암호화 연결(SSL)을 요구함 → 환경변수 DB_SSL=true 일 때만 켬 (내 컴퓨터 MySQL은 끈 채로)
function sslOption() {
  return process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined;
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',          // MySQL 주소 (.env 값, 없으면 localhost)
  port: Number(process.env.DB_PORT || 3306),         // MySQL 포트 (문자열을 숫자로 바꿈)
  user: process.env.DB_USER || 'root',               // 접속 사용자
  password: process.env.DB_PASSWORD || '',           // 접속 비밀번호 (.env의 DB_PASSWORD)
  database: process.env.DB_NAME || 'oneul_geupsik',  // 사용할 DB 이름
  waitForConnections: true,                          // 연결이 모두 사용 중이면 오류 대신 기다림
  connectionLimit: 10,                               // 동시에 열어둘 수 있는 연결 최대 개수
  charset: 'utf8mb4',                                // 한글이 깨지지 않게 문자셋 지정
  ssl: sslOption(),                                  // DB_SSL=true면 암호화 연결, 아니면 일반 연결
});

module.exports = pool;
module.exports.sslOption = sslOption; // init-db.js에서도 같은 SSL 규칙을 쓰려고 함께 내보냄 (require('./db')는 그대로 pool) // 다른 파일에서 require('../db')로 가져다 씀
