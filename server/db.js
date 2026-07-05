import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// Настройка путей для ES-модулей
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, 'database.sqlite');

// Инициализация подключения к БД
const db = new sqlite3.Database(dbPath);

// Создание таблицы, если она не существует. 
// Используем простую структуру key-value для хранения JSON-данных, 
// чтобы легко интегрироваться с вашей текущей логикой
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS state (
    key TEXT PRIMARY KEY,
    data TEXT
  )`);
});

// Вспомогательная функция для получения данных
export const getDbState = (key) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT data FROM state WHERE key = ?`, [key], (err, row) => {
      if (err) reject(err);
      else resolve(row ? JSON.parse(row.data) : null);
    });
  });
};

// Вспомогательная функция для сохранения данных
export const saveDbState = (key, data) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO state (key, data) VALUES (?, ?) 
       ON CONFLICT(key) DO UPDATE SET data = excluded.data`,
      [key, JSON.stringify(data)],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};