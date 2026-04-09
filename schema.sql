-- schema.sql
DROP TABLE IF EXISTS users;
CREATE TABLE users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    role TEXT NOT NULL
);

-- 插入默认管理员账号 (实际生产中密码应加密，这里先用明文方便你跑通流程)
INSERT INTO users (username, password, role) VALUES ('admin', 'Admin1234', 'admin');
INSERT INTO users (username, password, role) VALUES ('22_同学', '12345678', 'student');

DROP TABLE IF EXISTS tasks;
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    title TEXT,
    date TEXT,
    type TEXT,
    subject TEXT,
    remarks TEXT,
    url TEXT,
    color TEXT,
    completed BOOLEAN,
    createdBy TEXT
);
