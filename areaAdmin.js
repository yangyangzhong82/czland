// areaAdmin.js
const { getDbSession } = require('./database');
const getOfflinePlayerData = ll.import("PlayerData", "getOfflinePlayerData");
const { logDebug, logInfo, logWarning, logError } = require('./logger');
// 存储领地管理员列表
let areaAdmins = {};

// 初始化时加载领地管理员数据
function loadAreaAdmins() {
    try {
        const db = getDbSession();

        // Table creation moved to database.js initDatabase/createTables

        // 查询所有管理员 (Select only needed columns)
        // const results = db.query("SELECT * FROM area_admins");
        const results = db.query("SELECT uuid, name, addTime FROM area_admins"); // <- Optimization: Select specific columns

        if (!results) {
             logger.warn("查询领地管理员表返回 null 或 undefined");
             areaAdmins = {}; // Ensure cache is empty on error
             return {};
        }
        if (results.length <= 1) { // Header only or empty
            logger.info("没有找到领地管理员数据");
            areaAdmins = {}; // Ensure cache is empty
            return {};
        }

        // 转换为对象格式
        const admins = {};
        const headers = results[0].map(h => h.toLowerCase());
        const uuidIndex = headers.indexOf('uuid');
        const nameIndex = headers.indexOf('name');
        const addTimeIndex = headers.indexOf('addtime');

        if (uuidIndex === -1 || nameIndex === -1 || addTimeIndex === -1) {
            logger.error("领地管理员表结构不匹配，缺少必要的列");
            areaAdmins = {};
            return {};
        }

        for (let i = 1; i < results.length; i++) {
            const row = results[i];
            if (row && row.length === headers.length) {
                 admins[row[uuidIndex]] = {
                     name: row[nameIndex],
                     addTime: row[addTimeIndex]
                 };
            } else {
                 logger.warn(`跳过格式不正确的领地管理员行 ${i}`);
            }
        }

        logger.info(`成功加载 ${Object.keys(admins).length} 个领地管理员`);
        areaAdmins = admins; // Update cache
        return admins;
    } catch (e) {
        logger.error(`加载领地管理员数据失败: ${e}`, e.stack);
        areaAdmins = {}; // Ensure cache is empty on error
        return {};
    }
}
// 保存领地管理员数据
function saveAreaAdmins() {
    let db;
    try {
        db = getDbSession();

        // 开始事务
        db.exec("BEGIN TRANSACTION"); // <- Optimization: Use transaction

        // 清空旧数据
        db.exec("DELETE FROM area_admins");

        // 插入新数据 (using prepared statement)
        const stmt = db.prepare("INSERT INTO area_admins (uuid, name, addTime) VALUES (?, ?, ?)"); // <- Optimization: Prepare statement once

        let savedCount = 0;
        for (const uuid in areaAdmins) {
            const admin = areaAdmins[uuid];
            // Add validation if necessary
            if (admin && typeof uuid === 'string' && typeof admin.name === 'string' && typeof admin.addTime === 'number') {
                stmt.bind([uuid, admin.name, admin.addTime]);
                stmt.execute();
                stmt.reset(); // Reset for next iteration
                savedCount++;
            } else {
                logger.warn(`跳过无效的管理员数据 for UUID: ${uuid}`);
                stmt.reset(); // Still reset if continuing
            }
        }

        // 提交事务
        db.exec("COMMIT"); // <- Optimization: Commit transaction

        logger.info(`成功保存 ${savedCount} / ${Object.keys(areaAdmins).length} 个领地管理员数据`);
        return true;
    } catch (e) {
        logger.error(`保存领地管理员数据失败: ${e}`, e.stack);
        // 回滚事务
        if (db && db.isOpen()) {
            try {
                db.exec("ROLLBACK"); // <- Optimization: Rollback on error
                logger.info("管理员保存事务已回滚");
            } catch (rollbackErr) {
                logger.error(`事务回滚失败: ${rollbackErr}`);
            }
        } else {
             logger.error("数据库连接无效，无法回滚事务");
        }
        return false;
    } finally {
        // Finalize/reset statement if needed, though LLSE might handle it
    }
}

// 添加领地管理员
function addAreaAdmin(uuid, name) {
    if (typeof uuid !== 'string' || uuid === '' || typeof name !== 'string' || name === '') {
         logger.warn(`尝试添加无效的管理员: UUID='${uuid}', Name='${name}'`);
         return false;
    }
    if (areaAdmins[uuid]) {
        logger.debug(`玩家 ${name} (${uuid}) 已经是管理员`);
        return false; // Already admin
    }

    areaAdmins[uuid] = {
        name: name,
        addTime: Date.now()
    };
    logger.info(`领地管理员 ${name} (${uuid}) 已添加到缓存`);
    // Consider saving immediately or marking cache as dirty
    // saveAreaAdmins(); // Uncomment if immediate persistence is desired
    return true;
}

function findPlayerByName(playerName) {
    // 先尝试查找在线玩家
    const onlinePlayer = mc.getPlayer(playerName);
    if (onlinePlayer) {
        return {
            uuid: onlinePlayer.uuid,
            name: onlinePlayer.name,
            isOnline: true
        };
    }

    // 如果找不到在线玩家，尝试查找离线玩家
    try {
        const offlinePlayersData = getOfflinePlayerData(); // Call the imported function
        if (!offlinePlayersData || typeof offlinePlayersData !== 'object') {
             logger.warn("getOfflinePlayerData 返回无效数据");
             return null;
        }
        // Assuming offlinePlayersData is an object or array. Adjust based on its actual structure.
        // If it's an array of objects {uuid, name, ...}:
        if (Array.isArray(offlinePlayersData)) {
             const lowerCaseName = playerName.toLowerCase();
             const matchedPlayer = offlinePlayersData.find(p => p && typeof p.name === 'string' && p.name.toLowerCase() === lowerCaseName);

             if (matchedPlayer && typeof matchedPlayer.uuid === 'string') {
                 return {
                     uuid: matchedPlayer.uuid,
                     name: matchedPlayer.name, // Use the name from data
                     isOnline: false
                 };
             }
        } else {
             logger.warn("getOfflinePlayerData 返回的不是预期的数组格式");
        }

    } catch(e) {
         logger.error(`查找离线玩家数据时出错: ${e}`, e.stack);
    }


    logger.debug(`未找到名为 "${playerName}" 的在线或离线玩家`);
    return null;
}

// 移除领地管理员
function removeAreaAdmin(uuid) {
    if (typeof uuid !== 'string' || uuid === '') {
         logger.warn(`尝试移除无效的管理员 UUID: '${uuid}'`);
         return false;
    }
   if (!areaAdmins[uuid]) {
       logger.debug(`UUID ${uuid} 不是管理员，无需移除`);
       return false; // Not an admin
   }

   const adminName = areaAdmins[uuid].name; // Get name for logging before deleting
   delete areaAdmins[uuid];
   logger.info(`领地管理员 ${adminName} (${uuid}) 已从缓存移除`);
   // Consider saving immediately or marking cache as dirty
   // saveAreaAdmins(); // Uncomment if immediate persistence is desired
   return true;
}

// 检查玩家是否是领地管理员
function isAreaAdmin(uuid) {
    return !!areaAdmins[uuid];
}

// 获取所有领地管理员
function getAllAreaAdmins() {
    return {...areaAdmins};
}

// 初始化加载
loadAreaAdmins();

module.exports = {
    addAreaAdmin,
    removeAreaAdmin,
    isAreaAdmin,
    getAllAreaAdmins,
    saveAreaAdmins,
    loadAreaAdmins,
    findPlayerByName
};