// database.js
let dbSession = null;
const {logDebug, logInfo, logWarning, logError } = require('./logger');
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
            create: true,
            // 启用WAL模式通常能提高并发写入性能，但会产生额外的wal和shm文件
            // 可以根据实际测试效果决定是否启用
            // flags: ["WAL"] // 可选优化
        });

        // 创建表结构 (放入事务中确保原子性)
        dbSession.exec("BEGIN TRANSACTION"); // <- Optimization: Use transaction
        try {
            createTables();
            dbSession.exec("COMMIT"); // <- Optimization: Commit transaction
        } catch (tableError) {
            logger.error(`创建表结构失败: ${tableError}, 回滚事务`);
            try {
                dbSession.exec("ROLLBACK"); // <- Optimization: Rollback on error
            } catch (rollbackError) {
                logger.error(`事务回滚失败: ${rollbackError}`);
            }
            throw tableError; // Rethrow original error
        }


        logDebug("区域系统数据库连接成功");
        return true;
    } catch(e) {
        logger.error(`数据库连接失败: ${e}`);
        // 确保即使初始化失败也关闭可能部分打开的连接
        if (dbSession && dbSession.isOpen()) {
             try { dbSession.close(); } catch(closeErr) {/* ignore */}
             dbSession = null;
        }
        return false;
    }
}

// 创建所需的表结构
function createTables() {
    // 注意：在已有的事务中执行
    // 区域表 - 添加索引优化查询
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
    // 为经常用于查找的列创建索引
    dbSession.exec(`CREATE INDEX IF NOT EXISTS idx_areas_coords ON areas (dimid, minX, minY, minZ, maxX, maxY, maxZ);`); // <- Optimization: Index for spatial queries
    dbSession.exec(`CREATE INDEX IF NOT EXISTS idx_areas_parent ON areas (parentAreaId);`); // <- Optimization: Index for parent lookup

    // 权限表 - 复合主键通常自带索引，但可以为单独查询添加索引
    dbSession.exec(`
        CREATE TABLE IF NOT EXISTS permissions (
            playerUuid TEXT NOT NULL,
            areaId TEXT NOT NULL,
            groupName TEXT NOT NULL,
            PRIMARY KEY (playerUuid, areaId),
            FOREIGN KEY (areaId) REFERENCES areas(id) ON DELETE CASCADE
        );
    `);
     dbSession.exec(`CREATE INDEX IF NOT EXISTS idx_permissions_area ON permissions (areaId);`); // <- Optimization: Index for area-based permission lookup

    // 自定义权限组表 - 复合主键自带索引
    dbSession.exec(`
        CREATE TABLE IF NOT EXISTS custom_groups (
            uuid TEXT NOT NULL,
            groupName TEXT NOT NULL,
            displayName TEXT NOT NULL,
            permissions TEXT NOT NULL,
            PRIMARY KEY (uuid, groupName)
        );
    `);
    dbSession.exec(`CREATE INDEX IF NOT EXISTS idx_custom_groups_uuid ON custom_groups (uuid);`); // <- Optimization: Index for player-specific group lookup


    // 默认权限组配置表 - 主键自带索引
    dbSession.exec(`
        CREATE TABLE IF NOT EXISTS default_groups (
            areaId TEXT PRIMARY KEY,
            groupName TEXT NOT NULL,
            FOREIGN KEY (areaId) REFERENCES areas(id) ON DELETE CASCADE
        );
    `);

    // 玩家设置表 - 主键自带索引
    dbSession.exec(`
        CREATE TABLE IF NOT EXISTS player_settings (
            uuid TEXT PRIMARY KEY,
            displayActionBar INTEGER DEFAULT 1,
            displayTitle INTEGER DEFAULT 1,
            displayCooldown INTEGER DEFAULT 2000
        );
    `);

    // 全局配置表 - 主键自带索引
    dbSession.exec(`
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `);

    // 领地管理员表 - 主键自带索引
    dbSession.exec(`
        CREATE TABLE IF NOT EXISTS area_admins (
            uuid TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            addTime INTEGER NOT NULL
        );
    `);
}

// 获取数据库会话
function getDbSession() {
    // 增加重连逻辑的健壮性
    if (!dbSession || !dbSession.isOpen()) {
        logWarning("数据库连接丢失或未初始化，尝试重新连接...");
        if (!initDatabase()) {
            logError("数据库重连失败！");
            // 可以考虑抛出错误或返回null，取决于上层如何处理
            throw new Error("无法获取数据库连接");
        }
    }
    return dbSession;
}

// 关闭数据库连接
function closeDatabase() {
    if (dbSession && dbSession.isOpen()) {
        try { // <- Add try-catch for closing
            const success = dbSession.close();
            if (success) {
                logDebug("数据库连接已关闭");
            } else {
                logWarning("尝试关闭数据库连接失败");
            }
            dbSession = null;
            return success;
        } catch (e) {
            logError(`关闭数据库时发生错误: ${e}`);
            dbSession = null; // Ensure session is nulled even on error
            return false;
        }
    }
    logDebug("数据库连接已经关闭或不存在，无需操作");
    return false; // Or true, depending on desired semantics (idempotency)
}

// 检查数据库连接状态
function isConnected() {
    // More robust check
    try {
        return dbSession && dbSession.isOpen();
    } catch (e) {
        // If isOpen() itself throws an error, connection is likely bad
        logWarning(`检查数据库连接状态时出错: ${e}`);
        return false;
    }
}

module.exports = {
    initDatabase,
    getDbSession,
    closeDatabase,
    isConnected
};