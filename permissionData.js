// permissionData.js

const PERMISSION_DATA_PATH = './plugins/area/permissions.json';
const { getDbSession } = require('./database');
const {logDebug, logInfo, logWarning, logError } = require('./logger');

// 加载权限组数据
function loadPermissionData() {
    try {
        const db = getDbSession();
        // Select specific columns
        const results = db.query("SELECT playerUuid, areaId, groupName FROM permissions");

        // 检查results是否有效
        if (!results) {
            logger.warn("查询权限表返回 null 或 undefined");
            return {};
        }

        if (results.length <= 1) { // Header only or empty
             logDebug("权限表中没有数据记录");
             return {};
        }

        // 转换为旧格式的对象结构 { playerUuid: { areaId: groupName } }
        const permissionData = {};
        const headers = results[0].map(h => h.toLowerCase());
        const uuidIndex = headers.indexOf('playeruuid');
        const areaIdIndex = headers.indexOf('areaid');
        const groupNameIndex = headers.indexOf('groupname');

        if (uuidIndex === -1 || areaIdIndex === -1 || groupNameIndex === -1) {
             logger.error("权限表结构不匹配，缺少必要的列");
             return {};
        }

        for(let i = 1; i < results.length; i++) { // 跳过表头
            const row = results[i];
            if (!row || row.length !== headers.length) {
                 logger.warn(`跳过格式不正确的权限行 ${i}`);
                 continue;
            }
            const [playerUuid, areaId, groupName] = [
                 row[uuidIndex], row[areaIdIndex], row[groupNameIndex]
            ];

            if (!playerUuid || !areaId || !groupName) {
                 logger.warn(`跳过缺少 UUID, AreaID 或 GroupName 的权限行 ${i}`);
                 continue;
            }

            if(!permissionData[playerUuid]) {
                permissionData[playerUuid] = {};
            }

            permissionData[playerUuid][areaId] = groupName;
        }

        logInfo(`成功加载 ${results.length - 1} 条玩家区域权限记录到缓存`); // Be mindful of log level
        return permissionData;
    } catch(e) {
        logger.error(`读取权限数据失败: ${e}`, e.stack);
        return {}; // Return empty object on error
    }
}

// 保存权限组数据
// 保存权限组数据
function savePermissionData(data) {
    if (!data || typeof data !== 'object') {
         logger.error("保存权限数据失败：无效的数据对象提供");
         return false;
    }
   let db;
   try {
       db = getDbSession();

       // 开始一个事务
       db.exec("BEGIN TRANSACTION"); // <- Optimization: Transaction

       // 清空旧数据 (!!! potentially dangerous if data object is incomplete !!!)
       // Consider if this should be an update/insert strategy instead of wipe+rewrite
       db.exec("DELETE FROM permissions");

       // 使用问号占位符的预准备语句
       const stmt = db.prepare("INSERT INTO permissions (playerUuid, areaId, groupName) VALUES (?, ?, ?)"); // <- Optimization: Prepare statement

       // 插入新数据
       let count = 0;
       for(const playerUuid in data) {
            if (!data.hasOwnProperty(playerUuid) || !data[playerUuid] || typeof data[playerUuid] !== 'object') continue;

           for(const areaId in data[playerUuid]) {
                if (!data[playerUuid].hasOwnProperty(areaId)) continue;

               const groupName = data[playerUuid][areaId];

               // 添加参数验证
               if (!playerUuid || !areaId || typeof groupName !== 'string' || !groupName) {
                   logger.warn(`跳过无效权限数据: playerUuid=${playerUuid}, areaId=${areaId}, groupName=${groupName}`);
                   continue; // Skip this entry
               }

               // 绑定新参数并执行
               stmt.bind([playerUuid, areaId, groupName]);
               stmt.execute(); // 执行语句
               stmt.reset();   // 重置语句状态，准备下一次绑定/执行

               count++;
           }
       }

       // 提交事务
       db.exec("COMMIT"); // <- Optimization: Commit transaction

       logDebug(`成功保存 ${count} 条权限数据到数据库`);
       return true;
   } catch(e) {
       logger.error(`保存权限数据失败: ${e}`, e.stack);
       // 发生错误时回滚事务
       if (db && db.isOpen()) {
           try {
               db.exec("ROLLBACK"); // <- Optimization: Rollback on error
               logger.info("权限数据保存事务已回滚");
           } catch(rollbackErr) {
               logger.error(`事务回滚失败: ${rollbackErr}`);
           }
       }
       return false;
   } finally {
        // Finalize/reset stmt if needed
   }
}

module.exports = {
    loadPermissionData,
    savePermissionData
};