// database.js
let dbSession = null;

// 初始化数据库连接
function initDatabase() {
    try {
        // 确保插件目录存在
        if (!File.exists("plugins/area")) {
            File.mkdir("plugins/area");
        }
        
        // 创建SQLite数据库连接
        dbSession = new DBSession("sqlite", {
            path: "./plugins/area/data.db",
            create: true
        });
        
        // 创建表结构
        createTables();
        
        logger.info("区域系统数据库连接成功");
        return true;
    } catch(e) {
        logger.error(`数据库连接失败: ${e}`);
        return false;
    }
}

// 创建所需的表结构
function createTables() {
    // 区域表
    dbSession.exec(`
        CREATE TABLE IF NOT EXISTS areas (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            xuid TEXT NOT NULL,
            dimid INTEGER NOT NULL,
            minX INTEGER NOT NULL,
            minY INTEGER NOT NULL,
            minZ INTEGER NOT NULL,
            maxX INTEGER NOT NULL,
            maxY INTEGER NOT NULL,
            maxZ INTEGER NOT NULL,
            isSubarea INTEGER DEFAULT 0,
            parentAreaId TEXT DEFAULT NULL,
            priority INTEGER DEFAULT 0,
            createdTime INTEGER NOT NULL,
            additionalData TEXT DEFAULT NULL
        );
    `);
    
    // 权限表
    dbSession.exec(`
        CREATE TABLE IF NOT EXISTS permissions (
            playerUuid TEXT NOT NULL,
            areaId TEXT NOT NULL,
            groupName TEXT NOT NULL,
            PRIMARY KEY (playerUuid, areaId),
            FOREIGN KEY (areaId) REFERENCES areas(id) ON DELETE CASCADE
        );
    `);
    
    // 自定义权限组表
    dbSession.exec(`
        CREATE TABLE IF NOT EXISTS custom_groups (
            uuid TEXT NOT NULL,
            groupName TEXT NOT NULL,
            displayName TEXT NOT NULL,
            permissions TEXT NOT NULL,
            PRIMARY KEY (uuid, groupName)
        );
    `);
    
    // 默认权限组配置表
    dbSession.exec(`
        CREATE TABLE IF NOT EXISTS default_groups (
            areaId TEXT PRIMARY KEY,
            groupName TEXT NOT NULL,
            FOREIGN KEY (areaId) REFERENCES areas(id) ON DELETE CASCADE
        );
    `);
    
    // 玩家设置表
    dbSession.exec(`
        CREATE TABLE IF NOT EXISTS player_settings (
            uuid TEXT PRIMARY KEY,
            displayActionBar INTEGER DEFAULT 1,
            displayTitle INTEGER DEFAULT 1,
            displayCooldown INTEGER DEFAULT 2000
        );
    `);
    
    // 全局配置表
    dbSession.exec(`
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `);
}

// 获取数据库会话
function getDbSession() {
    if (!dbSession || !dbSession.isOpen()) {
        initDatabase();
    }
    return dbSession;
}

// 关闭数据库连接
function closeDatabase() {
    if (dbSession && dbSession.isOpen()) {
        dbSession.close();
        dbSession = null;
        return true;
    }
    return false;
}

// 检查数据库连接状态
function isConnected() {
    return dbSession && dbSession.isOpen();
}

module.exports = {
    initDatabase,
    getDbSession,
    closeDatabase,
    isConnected
};