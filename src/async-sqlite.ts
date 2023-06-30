import {RunResult, Database as SQLite3Database} from "sqlite3";

const sqlite3 = (process.env.NODE_ENV !== undefined || process.env.NODE_ENV !== 'production')
  ? require('sqlite3').verbose()
  : require('sqlite3')

export class AsyncSQLite3 {
  protected notAsyncDb: SQLite3Database | undefined;
  protected path: string;
  protected mode: string;

  constructor(path: string, mode: 'read' | 'write') {
      this.notAsyncDb;
      this.path = path;
      this.mode = mode;
  }

  async open(): Promise<string> {
    const dbMode = this.mode === 'read'
      ? sqlite3.OPEN_READONLY
      : sqlite3.OPEN_READWRITE

    const self = this;
    return new Promise((resolve, reject) => {
      this.notAsyncDb = new sqlite3.Database(this.path, dbMode, function (err: Error | null) {
        if (err) reject(err)
        else resolve(self.path + " opened");
      })
    })
  }

  /** выполняет sql запрос */
  async run(sql: string, ...params: any): Promise<RunResult> {
    const db = this.getDatabase();
    return new Promise((resolve, reject) => {
      db.run(sql, ...params, function (err: Error | null) {
        if (err) {console.log(err); reject(err)}
        // @ts-ignore: this тут передается специально с контекста текущей функции
        else resolve(this)
      })
    })
  }

  /** возвращает запись, если не найдено то вернетсы undefined */
  async get<T>(sql: string, ...params: any): Promise<T> {
    const db = this.getDatabase();
    return new Promise((resolve, reject) => {
      db.get(sql, ...params, function (err: Error | null, row: T) {
        if (err) reject(err)
        else resolve(row)
      })
    })
  }

  /** возвращает массив записей, если не найдено то вернетсы пустой массив */
  async all<T>(sql: string, ...params: any): Promise<T[]> {
    const db = this.getDatabase();
    return new Promise((resolve, reject) => {
      db.all(sql, ...params, function (err: Error | null, rows: T[]) {
        if (err) reject(err)
        else resolve(rows)
      })
    })
  }

  async each<R>(sql: string, action: (row: R) => void): Promise<number>
  async each<R>(sql: string, params: any[], action: (row: R) => void): Promise<number>
  async each<R>(sql: string, ...params: any[]): Promise<number> {
    const db = this.getDatabase();
    const action = params.pop();
    if (typeof action !== 'function') throw Error('not valid action');

    return new Promise((resolve, reject) => {
      function processRowCallback (err: Error | null, row: R) {
        if (err) reject(err);
        else { if (row) action(row); }
      }

      function completeCallback (err: Error | null, counts: number) {
        if (err) reject(err);
        else resolve(counts);
      }

      db.serialize(function() {
        db.each(sql, ...params, processRowCallback, completeCallback);
      });
    });
  }

  async close(): Promise<string> {
    const db = this.getDatabase();
    const self = this;
    return new Promise((resolve, reject) => {
      db.close(function (err) {
        if (err) reject(err)
        else {
          self.notAsyncDb = undefined;
          resolve(self.path + " closed");
        }
      })
    })
  }

  getDatabase(): SQLite3Database {
    if (this.notAsyncDb === undefined) throw Error('database is not opened');
    return this.notAsyncDb;
  }
}
