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
            //flags: ["WAL"] // 可选优化
        });

        // 启用 WAL 模式
        try {
            dbSession.exec("PRAGMA journal_mode=WAL;");
            logInfo("数据库 WAL 模式已启用。");
        } catch (walError) {
            logWarning(`启用数据库 WAL 模式失败: ${walError}`);
            // 即使 WAL 失败，也继续尝试创建表
        }


        // 创建基础表结构 (如果不存在)
        try {
            dbSession.exec("BEGIN TRANSACTION");
            createTables();
            dbSession.exec("COMMIT");
        } catch (tableError) {
            logger.error(`创建基础表结构失败: ${tableError}, 回滚事务`);
            try { dbSession.exec("ROLLBACK"); } catch (rollbackError) { logger.error(`事务回滚失败: ${rollbackError}`); }
            throw tableError;
        }

        // 执行数据库结构和数据迁移
        try {
            migrateDatabaseSchema(); // <--- 添加迁移调用
        } catch (migrationError) {
            logger.error(`数据库迁移失败: ${migrationError}`);
            // 根据策略决定是否抛出错误或继续
            // 这里选择继续，但记录严重错误
        }


        logDebug("区域系统数据库连接成功");
        return true;
    } catch(e) {
        logger.error(`数据库初始化或迁移过程中发生严重错误: ${e}`);
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
            defaultGroupName TEXT DEFAULT NULL, -- 添加默认权限组名称列
            inheritDefaultPermissions INTEGER DEFAULT 1, -- 新增：子区域是否继承父区域默认权限 (1=是, 0=否)
            additionalData TEXT DEFAULT NULL
        );
    `);
    // 为经常用于查找的列E创建索引
    dbSession.exec(`CREATE INDEX IF NOT XISTS idx_areas_coords ON areas (dimid, minX, minY, minZ, maxX, maxY, maxZ);`); // <- Optimization: Index for spatial queries
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
     dbSession.exec(`CREATE INDEX IF NOT EXISTS idx_permissions_player ON permissions (playerUuid);`); // <- Optimization: Index for player-based permission lookup

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

// 数据库结构和数据迁移函数
function migrateDatabaseSchema() {
    logInfo("开始检查并执行数据库迁移...");
    try {
        dbSession.exec("BEGIN TRANSACTION");

        // 1. 检查并添加 areas.defaultGroupName 列
        const columns = dbSession.query("PRAGMA table_info(areas)");
        let hasDefaultGroupName = false;
        if (columns && columns.length > 1) { // 检查是否有数据行
             const headers = columns[0].map(h => h.toLowerCase());
             const nameIndex = headers.indexOf('name');
             if (nameIndex !== -1) {
                  for (let i = 1; i < columns.length; i++) {
                       if (columns[i][nameIndex] === 'defaultGroupName') {
                            hasDefaultGroupName = true;
                            break;
                       }
                  }
             } else {
                  logWarning("无法解析 PRAGMA table_info(areas) 的输出格式");
             }
        } else {
             logWarning("无法获取 areas 表的列信息");
        }


        if (!hasDefaultGroupName) {
            logInfo("检测到 areas 表缺少 defaultGroupName 列，正在添加...");
            try {
                dbSession.exec("ALTER TABLE areas ADD COLUMN defaultGroupName TEXT DEFAULT NULL;");
                logInfo("成功添加 defaultGroupName 列到 areas 表。");
            } catch (alterError) {
                logError(`向 areas 表添加 defaultGroupName 列失败: ${alterError}`);
                dbSession.exec("ROLLBACK");
                return; // 添加列失败，无法继续迁移
            }
        } else {
            logDebug("areas.defaultGroupName 列已存在，跳过添加。");
        }

        // 2. 检查 default_groups 表是否存在
        const tablesResult = dbSession.query("SELECT name FROM sqlite_master WHERE type='table' AND name='default_groups';");
        let defaultGroupsExists = false;
        if (tablesResult && tablesResult.length > 1 && tablesResult[1] && tablesResult[1][0] === 'default_groups') {
             defaultGroupsExists = true;
        }


        if (defaultGroupsExists) {
            logInfo("检测到旧的 default_groups 表，开始迁移数据...");
            try {
                // 将数据从 default_groups 迁移到 areas.defaultGroupName
                const updateStmt = dbSession.prepare(`
                    UPDATE areas
                    SET defaultGroupName = (
                        SELECT groupName
                        FROM default_groups
                        WHERE default_groups.areaId = areas.id
                    )
                    WHERE EXISTS (
                        SELECT 1
                        FROM default_groups
                        WHERE default_groups.areaId = areas.id
                    );
                `);
                updateStmt.execute();
                // updateStmt.reset(); // 如果需要检查影响的行数，可以在这里添加逻辑

                logInfo("数据从 default_groups 迁移到 areas.defaultGroupName 完成。");

                // 删除旧的 default_groups 表
                dbSession.exec("DROP TABLE default_groups;");
                logInfo("已成功删除旧的 default_groups 表。");

            } catch (migrationDataError) {
                logError(`从 default_groups 迁移数据或删除表失败: ${migrationDataError}`);
                dbSession.exec("ROLLBACK");
                return; // 数据迁移失败
            }
        } else {
            logDebug("未找到旧的 default_groups 表，跳过数据迁移。");
        }

        // --- 新增开始: 检查并添加 areas.inheritDefaultPermissions 列 ---
        // 复用之前的 columns 变量来检查 areas 表
        let hasInheritDefaultPermsColumn = false;
        if (columns && columns.length > 1) { // 确保 columns 变量有效
             const headers = columns[0].map(h => h.toLowerCase());
             const nameIndex = headers.indexOf('name');
             if (nameIndex !== -1) {
                  for (let i = 1; i < columns.length; i++) {
                       if (columns[i][nameIndex] === 'inheritDefaultPermissions') {
                            hasInheritDefaultPermsColumn = true;
                            break;
                       }
                  }
             } else {
                  // logWarning 已经在前面处理过
             }
        } else {
             // logWarning 已经在前面处理过
        }

        if (!hasInheritDefaultPermsColumn) {
            logInfo("检测到 areas 表缺少 inheritDefaultPermissions 列，正在添加...");
            try {
                // 添加新列，默认值为 1 (继承)
                dbSession.exec("ALTER TABLE areas ADD COLUMN inheritDefaultPermissions INTEGER DEFAULT 1;");
                logInfo("成功添加 inheritDefaultPermissions 列到 areas 表。");
            } catch (alterError) {
                logError(`向 areas 表添加 inheritDefaultPermissions 列失败: ${alterError}`);
                // 考虑是否回滚或继续
                // dbSession.exec("ROLLBACK");
                // return;
            }
        } else {
            logDebug("areas.inheritDefaultPermissions 列已存在，跳过添加。");
        }
        // --- 新增结束 ---


        dbSession.exec("COMMIT");
        logInfo("数据库迁移检查和执行完成。");

    } catch (e) {
        logger.error(`数据库迁移事务处理失败: ${e}`);
        try {
            dbSession.exec("ROLLBACK");
            logger.info("数据库迁移事务已回滚。");
        } catch (rollbackError) {
            logger.error(`迁移事务回滚失败: ${rollbackError}`);
        }
    }
}
