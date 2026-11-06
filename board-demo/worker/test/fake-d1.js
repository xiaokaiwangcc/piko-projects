/** 仅测试用的内存版 D1，覆盖 handler 实际用到的三条 SQL。 */
class FakeStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.args = [];
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  async all() {
    if (this.db.throwOnAll) throw new Error('simulated D1 failure');
    const sql = this.sql.replace(/\s+/g, ' ').trim();
    if (!/^SELECT .* FROM notes/i.test(sql)) {
      throw new Error(`FakeD1 未支持的 all() SQL: ${sql}`);
    }
    const limit = sql.includes('LIMIT ?') ? Number(this.args[0]) : Infinity;
    const rows = this.db.notes
      .slice()
      .sort((a, b) => (a.created_at === b.created_at ? b.id - a.id : (a.created_at < b.created_at ? 1 : -1)))
      .slice(0, limit)
      .map((n) => ({ ...n }));
    return { results: rows, success: true, meta: { changes: 0 } };
  }

  async run() {
    const sql = this.sql.replace(/\s+/g, ' ').trim();

    if (/^INSERT INTO notes/i.test(sql)) {
      const record = { id: ++this.db.seq, content: this.args[0], created_at: this.args[1] };
      this.db.notes.push(record);
      return { success: true, results: [], meta: { last_row_id: record.id, changes: 1 } };
    }

    if (/^DELETE FROM notes WHERE id = \?/i.test(sql)) {
      const id = Number(this.args[0]);
      const before = this.db.notes.length;
      this.db.notes = this.db.notes.filter((n) => n.id !== id);
      return { success: true, results: [], meta: { changes: before - this.db.notes.length } };
    }

    throw new Error(`FakeD1 未支持的 run() SQL: ${sql}`);
  }
}

export class FakeD1 {
  constructor() {
    this.notes = [];
    this.seq = 0;
    this.throwOnAll = false;
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }

  seed(records) {
    for (const r of records) {
      this.notes.push({ ...r });
      this.seq = Math.max(this.seq, r.id);
    }
  }
}
