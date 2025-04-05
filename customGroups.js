// customGroups.js

const CUSTOM_GROUPS_PATH = './plugins/area/customGroups.json';
// const { DEFAULT_GROUPS } = require('./permission'); // Removed to break circular dependency
const { getDbSession } = require('./database');
const {logDebug, logInfo, logWarning, logError } = require('./logger');


// 加载自定义权限组数据
function loadCustomGroups() {
    try {
        const db = getDbSession();
        // Select specific columns
        const results = db.query("SELECT uuid, groupName, displayName, permissions FROM custom_groups");

        // 添加检查，确保results有效
        if (!results) {
            logger.warn("查询自定义权限组表返回 null 或 undefined");
            return {}; // Return empty object on failure
        }

        if (results.length <= 1) { // Header only or empty
             logDebug("自定义权限组表中没有数据");
             return {};
        }

        // 转换为旧格式的对象结构 { uuid: { groupName: { name, permissions, inherit } } }
        const customGroups = {};
        const headers = results[0].map(h => h.toLowerCase());
        const uuidIndex = headers.indexOf('uuid');
        const groupNameIndex = headers.indexOf('groupname');
        const displayNameIndex = headers.indexOf('displayname');
        const permissionsIndex = headers.indexOf('permissions');

        if (uuidIndex === -1 || groupNameIndex === -1 || displayNameIndex === -1 || permissionsIndex === -1) {
            logger.error("自定义权限组表结构不匹配，缺少必要的列");
            return {};
        }


        for(let i = 1; i < results.length; i++) { // 跳过表头
            const row = results[i];
             if (!row || row.length !== headers.length) {
                  logger.warn(`跳过格式不正确的自定义权限组行 ${i}`);
                  continue;
             }
            const [uuid, groupName, displayName, permissionsJson] = [
                row[uuidIndex], row[groupNameIndex], row[displayNameIndex], row[permissionsIndex]
            ];

            if (!uuid || !groupName) {
                 logger.warn(`跳过缺少 UUID 或 GroupName 的自定义权限组行 ${i}`);
                 continue;
            }

            if(!customGroups[uuid]) {
                customGroups[uuid] = {};
            }

            // 解析权限JSON
            let permissions = [];
            try {
                 // Ensure permissionsJson is a string before parsing
                 if (typeof permissionsJson === 'string' && permissionsJson.trim() !== '') {
                      permissions = JSON.parse(permissionsJson);
                      if (!Array.isArray(permissions)) {
                           logger.warn(`权限组 ${groupName} (UUID: ${uuid}) 的权限数据不是有效的数组格式, 使用空数组代替`);
                           permissions = [];
                      }
                 } else {
                      permissions = []; // Handle null, empty string, or non-string data
                 }
            } catch(e) {
                logger.warn(`权限组 ${groupName} (UUID: ${uuid}) 的权限数据 JSON 解析失败: ${e.message || e}, 使用空数组代替`);
                permissions = []; // Use empty array on parse failure
            }

            customGroups[uuid][groupName] = {
                name: displayName || groupName, // Use groupName as fallback for display name
                permissions: permissions,
                inherit: null // Keep inherit null for compatibility if required by other code
            };
        }
        logDebug(`成功加载 ${results.length - 1} 条自定义权限组记录`);
        return customGroups;
    } catch(e) {
        logger.error(`读取自定义权限组数据失败: ${e}`, e.stack);
        return {}; // Return empty object on failure
    }
}

// 保存自定义权限组数据
function saveCustomGroups(data) {
    let db;
    try {
        db = getDbSession();

        // 开始一个事务
        db.exec("BEGIN TRANSACTION"); // <- Optimization: Use transaction

        // 清空旧数据
        db.exec("DELETE FROM custom_groups");

        // Prepare statement outside the loop
        const stmt = db.prepare("INSERT INTO custom_groups (uuid, groupName, displayName, permissions) VALUES (?, ?, ?, ?)"); // <- Optimization: Prepare statement once

        // 插入新数据
        let count = 0;
        for(const uuid in data) {
             if (!data.hasOwnProperty(uuid) || !data[uuid] || typeof data[uuid] !== 'object') continue; // Skip invalid UUID entries

            for(const groupName in data[uuid]) {
                 if (!data[uuid].hasOwnProperty(groupName) || !data[uuid][groupName]) continue; // Skip invalid group entries

                const group = data[uuid][groupName];

                 // Basic validation
                 if (typeof uuid !== 'string' || typeof groupName !== 'string' || !group || typeof group.name !== 'string') {
                      logger.warn(`跳过无效的自定义权限组数据: UUID=${uuid}, GroupName=${groupName}`);
                      continue;
                 }

                 const permissionsArray = Array.isArray(group.permissions) ? group.permissions : [];

                stmt.bind([
                    uuid,
                    groupName,
                    group.name, // Use the display name
                    JSON.stringify(permissionsArray) // Ensure permissions are saved as JSON array string
                ]);

                stmt.execute();
                stmt.reset(); // Reset for next iteration
                count++;
            }
        }

        // 提交事务
        db.exec("COMMIT"); // <- Optimization: Commit transaction

        logDebug(`成功保存 ${count} 个自定义权限组到数据库`);
        return true;
    } catch(e) {
        logger.error(`保存自定义权限组数据失败: ${e}`, e.stack);
        // 发生错误时回滚事务
        if (db && db.isOpen()) {
            try {
                db.exec("ROLLBACK"); // <- Optimization: Rollback on error
                logger.info("自定义权限组保存事务已回滚");
            } catch(rollbackErr) {
                logger.error(`事务回滚失败: ${rollbackErr}`);
            }
        } else {
             logger.error("数据库连接无效，无法回滚事务");
        }
        return false;
    } finally {
         // Finalize/reset statement if needed
    }
}
// 获取玩家的所有自定义权限组
function getPlayerCustomGroups(uuid) {
    if (typeof uuid !== 'string' || uuid === '') {
         logger.warn(`尝试获取无效 UUID 的自定义权限组: '${uuid}'`);
         return {};
    }
    try {
        const db = getDbSession();
        // Prepare statement for targeted query
        const stmt = db.prepare("SELECT groupName, displayName, permissions FROM custom_groups WHERE uuid = ?");
        stmt.bind(uuid); // Bind the player's UUID
        // No need to call stmt.execute() explicitly before step() for SELECT with LLSE API usually
        // stmt.execute(); // This might be needed depending on exact API behavior, docs are ambiguous for SELECT

        const groups = {};
        // Use do...while or check first step if execute() is needed and positions cursor
        // Assuming step() moves to the first row if data exists, and returns false otherwise
        while(stmt.step()) { // Iterate through results
            const row = stmt.fetch(); // Get current row data {colName: value}
            if (row && row.groupName) { // Basic validation
                 let permissions = [];
                 try {
                      if (typeof row.permissions === 'string' && row.permissions.trim() !== '') {
                           permissions = JSON.parse(row.permissions);
                           if (!Array.isArray(permissions)) {
                                logger.warn(`玩家 ${uuid} 的权限组 ${row.groupName} 权限数据不是数组, 使用空数组`);
                                permissions = [];
                           }
                      }
                 } catch (e) {
                      logger.warn(`玩家 ${uuid} 的权限组 ${row.groupName} 权限 JSON 解析失败: ${e.message || e}`);
                      permissions = [];
                 }
                 groups[row.groupName] = {
                    name: row.displayName || row.groupName,
                    permissions: permissions,
                    inherit: null // Maintain structure
                 };
            }
        }
        // stmt.reset(); // Good practice to reset after use, especially if reusing statement object elsewhere

        logDebug(`为玩家 ${uuid} 加载了 ${Object.keys(groups).length} 个自定义权限组`);
        return groups;
    } catch(e) {
        logger.error(`获取玩家 ${uuid} 自定义权限组失败: ${e}`, e.stack);
        return {}; // Return empty object on error
    } finally {
        // Finalize/reset statement if needed
    }
}


// 创建自定义权限组
function createCustomGroup(uuid, groupName, displayName, permissions, inheritFrom = null /* unused? */) {
    // Validation
    if (typeof uuid !== 'string' || !uuid ||
        typeof groupName !== 'string' || !groupName ||
        typeof displayName !== 'string' || !displayName) {
        logger.error(`创建自定义权限组失败：无效的参数 (UUID: ${uuid}, GroupName: ${groupName}, DisplayName: ${displayName})`);
        return false;
    }
     const permissionsArray = Array.isArray(permissions) ? permissions : [];

   let db; // Declare db outside try block for finally/rollback
   try {
       db = getDbSession();
       // Use INSERT OR REPLACE to handle creation or update semantics

       // --- 开始事务 ---
       db.exec("BEGIN TRANSACTION");

       const stmt = db.prepare(`
           INSERT OR REPLACE INTO custom_groups (uuid, groupName, displayName, permissions)
           VALUES (?, ?, ?, ?)
       `);

       stmt.bind([
           uuid,
           groupName,
           displayName,
           JSON.stringify(permissionsArray)
       ]);

       stmt.execute();
       // stmt.reset(); // Reset if the stmt object is reused

       // --- 提交事务 ---
       db.exec("COMMIT");

       logInfo(`成功创建/替换权限组: ${displayName} (${groupName}) for UUID: ${uuid}`);
       return true;
   } catch(e) {
       logger.error(`创建/替换自定义权限组 ${groupName} (UUID: ${uuid}) 失败: ${e}`, e.stack);
       // --- 发生错误时回滚事务 ---
       if (db && db.isOpen()) {
           try {
               db.exec("ROLLBACK");
               logger.info(`自定义权限组创建/替换事务 (UUID: ${uuid}, Group: ${groupName}) 已回滚`);
           } catch(rollbackErr) {
               logger.error(`事务回滚失败: ${rollbackErr}`);
           }
       } else {
            logger.error("数据库连接无效，无法回滚事务");
       }
       return false;
   } finally {
        // Finalize/reset statement if needed, though typically not required if not reused
        // if (stmt) stmt.finalize(); // Or reset depending on API
   }
}



// 编辑自定义权限组
function editCustomGroup(uuid, groupName, newDisplayName, newPermissions, inheritFrom = null /* unused? */) {
    // Validation
     if (typeof uuid !== 'string' || !uuid ||
         typeof groupName !== 'string' || !groupName ||
         typeof newDisplayName !== 'string' || !newDisplayName) {
         logger.error(`编辑自定义权限组失败：无效的参数 (UUID: ${uuid}, GroupName: ${groupName}, NewDisplayName: ${newDisplayName})`);
         return false;
     }
     const permissionsArray = Array.isArray(newPermissions) ? newPermissions : [];

    let db;
    try {
        db = getDbSession();

        // Update statement
        const stmt = db.prepare(`
            UPDATE custom_groups
            SET displayName = ?, permissions = ?
            WHERE uuid = ? AND groupName = ?
        `);

        stmt.bind([
            newDisplayName,
            JSON.stringify(permissionsArray),
            uuid,
            groupName
        ]);

        stmt.execute();

        // Check affected rows using changes() function which is standard SQL for last statement
        let affectedRows = 0;
        const result = db.query("SELECT changes()"); // Execute changes() query
        if (result && result.length > 1 && result[1] && typeof result[1][0] === 'number') {
            affectedRows = result[1][0];
        } else {
            // Fallback or alternative if DBSession provides property:
            // affectedRows = stmt.affectedRows; // Check if this property exists and works for UPDATE
        }

        // stmt.reset(); // Reset if reusing

        if (affectedRows > 0) {
            logInfo(`成功编辑权限组: ${newDisplayName} (${groupName}) for UUID: ${uuid}`);
            return true;
        } else {
            // Check if the group actually exists if affectedRows is 0
            const checkStmt = db.prepare("SELECT 1 FROM custom_groups WHERE uuid = ? AND groupName = ?");
            checkStmt.bind([uuid, groupName]);
            // checkStmt.execute(); // Might not be needed
            const exists = checkStmt.step(); // Check if any row matches
            // checkStmt.reset();

            if (exists) {
                 logger.warn(`编辑权限组 ${groupName} (UUID: ${uuid}) 未产生变更 (数据可能已是最新)`);
                 return true; // Or false, depending on desired behavior for no-op update
            } else {
                 logger.error(`编辑失败：找不到权限组 ${groupName} (UUID: ${uuid})`);
                 return false;
            }
        }
    } catch(e) {
        logger.error(`编辑自定义权限组 ${groupName} (UUID: ${uuid}) 失败: ${e}`, e.stack);
        return false;
    }
}

// 删除自定义权限组
function deleteCustomGroup(uuid, groupName) {
    // Validation
    if (typeof uuid !== 'string' || !uuid || typeof groupName !== 'string' || !groupName) {
         logger.error(`删除自定义权限组失败：无效的参数 (UUID: ${uuid}, GroupName: ${groupName})`);
         return false;
    }

    let db;
   try {
        db = getDbSession();
        const stmt = db.prepare("DELETE FROM custom_groups WHERE uuid = ? AND groupName = ?");
        stmt.bind([uuid, groupName]);
        stmt.execute();

        // Check affected rows
        let affectedRows = 0;
        const result = db.query("SELECT changes()");
        if (result && result.length > 1 && result[1] && typeof result[1][0] === 'number') {
            affectedRows = result[1][0];
        }
        // stmt.reset();

        if (affectedRows > 0) {
             logInfo(`成功删除权限组 ${groupName} (UUID: ${uuid})`);
             return true;
        } else {
             logger.warn(`尝试删除权限组 ${groupName} (UUID: ${uuid})，但未找到或删除失败`);
             return false; // Group didn't exist or deletion failed
        }

   /* // Old logic based on load/save cache, replaced with direct DB operation
   const groupsData = loadCustomGroups(); // This loads ALL groups, inefficient for delete
   if(!groupsData[uuid] || !groupsData[uuid][groupName]) {
       logger.warn(`尝试删除不存在的权限组: UUID=${uuid}, GroupName=${groupName}`);
       return false;
   }

   delete groupsData[uuid][groupName];
   // If the uuid now has no groups, remove the uuid entry?
   if (Object.keys(groupsData[uuid]).length === 0) {
        delete groupsData[uuid];
   }
   return saveCustomGroups(groupsData); // This saves ALL groups, inefficient for delete
   */
   } catch(e) {
        logger.error(`删除自定义权限组 ${groupName} (UUID: ${uuid}) 失败: ${e}`, e.stack);
        return false;
   }
}

module.exports = {
    loadCustomGroups,
    saveCustomGroups,
    getPlayerCustomGroups,
    createCustomGroup,
    editCustomGroup,
    deleteCustomGroup
};
