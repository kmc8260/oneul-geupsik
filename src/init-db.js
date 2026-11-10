// ===================================================================
// init-db.js — 배포용: 서버가 켜질 때 db/schema.sql을 자동으로 실행해서 테이블을 만들어 줌
//  - 클라우드 서버에는 Workbench로 SQL을 돌리기 어려워서 만든 파일
//  - .env(또는 배포 사이트의 환경변수)에 DB_AUTO_INIT=true 일 때만 실행됨 (내 컴퓨터에서는 기본으로 꺼짐)
//  - schema.sql은 여러 번 실행해도 안전해서(IF NOT EXISTS / INSERT IGNORE) 서버가 다시 켜질 때마다 돌아도 괜찮음
//  - DB_NAME이 oneul_geupsik가 아니면(배포 사이트가 정해 준 이름 등) SQL 안의 DB 이름을 그 이름으로 바꿔서 실행
// ===================================================================
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { sslOption } = require('./db');           // DB_SSL=true 이면 암호화 연결 설정 (db.js와 같은 규칙)

async function initDb() {
  if (process.env.DB_AUTO_INIT !== 'true') return; // 꺼져 있으면 아무것도 안 함

  const dbName = process.env.DB_NAME || 'oneul_geupsik';
  if (!/^\w+$/.test(dbName)) throw new Error('DB_NAME에는 영문·숫자·_ 만 쓸 수 있어요.'); // SQL에 그대로 들어가므로 안전한 이름만 허용

  let sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'); // schema.sql 파일 내용 읽기
  sql = sql.replace(/\boneul_geupsik\b/g, dbName);   // CREATE DATABASE / USE 의 DB 이름 바꾸기

  // DB 이름 없이 접속 (schema.sql이 CREATE DATABASE부터 하기 때문)
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    charset: 'utf8mb4',
    ssl: sslOption(),
    multipleStatements: true,                        // ; 로 나뉜 여러 SQL을 한 번에 실행 (이 파일에서만 켬)
  });
  try {
    await conn.query(sql);                           // schema.sql 전체 실행
    console.log(`DB 준비 완료: ${dbName} (schema.sql 자동 실행)`);
  } finally {
    await conn.end();                                // 성공하든 실패하든 연결 닫기
  }
}

module.exports = initDb;
