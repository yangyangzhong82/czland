const { loadPermissionData, savePermissionData } = require('./permissionData');
const { PERMISSIONS, getAllPermissionIds } = require('./permissionRegistry');
// 默认权限组配置的保存路径
const DEFAULT_GROUP_CONFIG_PATH = './plugins/area/defaultGroups.json';
const { loadConfig, saveConfig } = require('./configManager'); // 导入 saveConfig
const { getDbSession } = require('./database');
const {logDebug, logInfo, logWarning, logError } = require('./logger');
const { loadCustomGroups } = require('./customGroups'); // 确保引入 loadCustomGroups
let permissionCache = {}; // 玩家权限缓存 {playerUuid: {areaId: groupName}}
let customGroupsCache = {}; // 自定义组缓存 {uuid: {groupName: {name, permissions, inherit}}}
let defaultGroupsCache = {}; // 区域默认组缓存 {areaId: groupName}
let systemDefaultPermissionsCache = null; // 系统默认权限缓存
const CACHE_TTL = 5 * 60 * 1000; // 缓存有效期(5分钟)
let lastCacheCleanup = Date.now();
// 加载权限数据
// let permissionData = loadPermissionData(); // 移除，因为现在直接从数据库读取

// 移除 getDefaultGroupConfig 函数

function groupHasAdminPermissions(groupId, groupsData) { // groupsData 现在是自定义组
    // const groups = getAvailableGroups(); // Avoid reloading all groups repeatedly
    const group = groupsData[groupId]; // Assumes groupsData is { groupName: { permissions: [...] } }
    if (!group || !Array.isArray(group.permissions)) return false;

    // Check PERMISSIONS registry (ensure it's loaded/available)
    if (!PERMISSIONS || typeof PERMISSIONS !== 'object') {
        logger.error("PERMISSIONS registry not available for admin check");
        return false;
    }

    // 检查组内是否有"管理"类别的权限
    for (const permId of group.permissions) {
        // Find the permission details in the registry
        const permDetails = Object.values(PERMISSIONS).find(p => p.id === permId);
        if (permDetails && permDetails.category === "管理") {
            return true; // Found an admin permission
        }
    }
    return false; // No admin permission found in the group
}

// 获取所有可用的自定义权限组 (不再包含系统默认组)
function getAvailableGroups() {
    let customGroupsData = {};
    try {
        // 调用从 customGroups.js 引入的函数
        // loadCustomGroups 返回格式为 { uuid: { groupName: groupDetails } }
        // 需要转换格式为 { groupName: { name: '...', permissions: [...] }, ... }
        const allPlayerGroups = loadCustomGroups(); // 使用 loadCustomGroups()
        const uniqueGroups = {};

        for (const uuid in allPlayerGroups) {
            for (const groupName in allPlayerGroups[uuid]) {
                if (!uniqueGroups[groupName]) {
                    // 只添加一次，使用找到的第一个定义（或者可以考虑合并权限，但通常不这么做）
                    uniqueGroups[groupName] = allPlayerGroups[uuid][groupName];
                }
            }
        }
        customGroupsData = uniqueGroups;

        if (typeof customGroupsData !== 'object' || customGroupsData === null) {
            logWarning("getAllCustomGroups() 或处理后的结果不是有效的对象，自定义组可能缺失。");
            customGroupsData = {};
        }
    } catch (error) {
        logError(`获取自定义权限组时出错: ${error}`, error.stack);
        customGroupsData = {}; // 出错时返回空对象
    }

    logDebug(`可用的自定义权限组列表: ${Object.keys(customGroupsData).join(', ')}`);
    return customGroupsData; // 只返回自定义组
}


// 保存默认权限组配置
function saveDefaultGroupConfig(data) {
    let db;
    try {
        db = getDbSession();

        // 开始一个事务
        db.exec("BEGIN TRANSACTION"); // <- Optimization: Transaction

        // 清空旧数据
        db.exec("DELETE FROM default_groups");

        // Prepare statement
        const stmt = db.prepare("INSERT INTO default_groups (areaId, groupName) VALUES (?, ?)"); // <- Optimization: Prepare statement

        // 插入新数据
        let count = 0;
        for(const areaId in data) {
            if (data.hasOwnProperty(areaId) && typeof areaId === 'string' && typeof data[areaId] === 'string') {
                stmt.bind([areaId, data[areaId]]);
                stmt.execute();
                stmt.reset(); // Reset for next iteration
                count++;
            } else {
                logger.warn(`跳过无效的默认权限组配置: AreaID=${areaId}, GroupName=${data[areaId]}`);
                stmt.reset(); // Still reset
            }
        }

        // 提交事务
        db.exec("COMMIT"); // <- Optimization: Commit transaction

        logDebug(`成功保存 ${count} 条默认权限组配置到数据库`);
        return true;
    } catch(e) {
        logger.error(`保存默认权限组配置失败: ${e}`, e.stack);
        // 发生错误时回滚事务
        if (db && db.isOpen()) {
            try {
                db.exec("ROLLBACK"); // <- Optimization: Rollback on error
                logger.info("默认权限组配置保存事务已回滚");
            } catch(rollbackErr) {
                logger.error(`事务回滚失败: ${rollbackErr}`);
            }
        }
        return false;
    } finally {
         // Finalize/reset stmt if needed
    }
}

// 为区域设置默认权限组 (groupName 为 null 表示使用系统默认)
function setAreaDefaultGroup(areaId, groupName) {
    // Validate areaId
    if (typeof areaId !== 'string' || !areaId) {
         logger.error(`设置区域默认权限组失败：无效 AreaID (${areaId})`);
         return false;
    }
    // Validate groupName (allow null)
    if (groupName !== null && (typeof groupName !== 'string' || !groupName)) {
         logger.error(`设置区域默认权限组失败：无效 GroupName (${groupName}) for AreaID (${areaId})`);
         return false;
    }
    defaultGroupsCache[areaId] = groupName;
    defaultGroupsCache._timestamps = defaultGroupsCache._timestamps || {};
    defaultGroupsCache._timestamps[areaId] = Date.now();
    try {
        const db = getDbSession();

        if (groupName === null) {
            // Delete the entry to signify using system default
            const stmt = db.prepare("DELETE FROM default_groups WHERE areaId = ?");
            stmt.bind(areaId);
            stmt.execute();
            // Check affected rows if needed
            logInfo(`已将区域 ${areaId} 的默认权限设置为系统默认`);
        } else {
            // Insert or replace the custom default group
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO default_groups (areaId, groupName)
                VALUES (?, ?)
            `);
            stmt.bind([areaId, groupName]);
            stmt.execute();
            logInfo(`成功为区域 ${areaId} 设置默认权限组: ${groupName}`);
        }
        // stmt.reset(); // Reset if reusing statement object

        return true;
    } catch(e) {
        logger.error(`设置区域 ${areaId} 默认权限组为 ${groupName === null ? '系统默认' : groupName} 失败: ${e}`, e.stack);
        return false;
    }
}


function getSystemDefaultPermissions() {
    const config = loadConfig();
    return config.defaultGroupPermissions || [];
}

// 获取区域的默认权限组
function getAreaDefaultGroup(areaId) {
    if (typeof areaId !== 'string' || !areaId) {
         logger.warn(`尝试获取无效 AreaID 的默认权限组: '${areaId}'`);
         return null;
    }
   try {
       const db = getDbSession();
       const stmt = db.prepare("SELECT groupName FROM default_groups WHERE areaId = ?");

       stmt.bind(areaId);
       // stmt.execute(); // May not be needed

       let groupName = null;
       if(stmt.step()) {
           const row = stmt.fetch();
           groupName = row.groupName;
       }
       // stmt.reset();

       // logDebug(`区域 ${areaId} 的默认权限组: ${groupName || '无'}`); // Can be noisy
       return groupName; // Returns null if not found
   } catch(e) {
       logger.error(`获取区域 ${areaId} 默认权限组失败: ${e}`, e.stack);
       return null; // Return null on error
   } finally {
        // Finalize/reset stmt if needed
    }
}




// 在permission.js中修改checkPermission函数
function checkPermission(player, areaData, areaId, permission) {
    // 定期清理缓存
    cleanupCache();
    
    // 获取被请求权限检查的区域
    const area = areaData[areaId];
    if(!area) return false;
    
    logDebug(`开始检查权限 - 玩家: ${player.name}, 区域: ${areaId}, 权限: ${permission}`);
    
    // 检查玩家是否是领地管理员
    const { isAreaAdmin } = require('./areaAdmin');
    if (isAreaAdmin(player.uuid)) {
        logDebug(`玩家 ${player.name} 是领地管理员，授予所有权限`);
        return true;
    }
    
    // 如果是区域创建者,赋予所有权限
    if(area.xuid === player.xuid) {
        logDebug(`玩家 ${player.name} 是区域创建者，授予所有权限`);
        return true;
    }

    if(area.isSubarea && area.parentAreaId) {
        const parentArea = areaData[area.parentAreaId];
        if(parentArea && parentArea.xuid === player.xuid) {
            logDebug(`玩家 ${player.name} 是父区域 ${area.parentAreaId} 的创建者，授予子区域所有权限`);
            return true;
        }
    }

    // 新增：如果这是一个子区域，检查它是否在父区域中定义了更严格的权限
    // 子区域的权限优先于父区域
    if(area.isSubarea && area.parentAreaId) {
        // 尝试获取该玩家在此子区域的特定权限 - 使用缓存
        const playerCurrentAreaGroup = getPlayerPermissionCached(player.uuid, areaId);
        
        if (playerCurrentAreaGroup) {
            // 根据玩家特定权限组名查找是哪个UUID创建的此组
            const db = getDbSession();
            const stmt = db.prepare("SELECT uuid FROM custom_groups WHERE groupName = ? LIMIT 1");
            stmt.bind(playerCurrentAreaGroup);
            
            let groupUuid = null;
            if (stmt.step()) {
                groupUuid = stmt.fetch().uuid;
            }
            
            if (groupUuid) {
                // 使用缓存获取组详情
                const group = getCustomGroupCached(groupUuid, playerCurrentAreaGroup);
                if (group) {
                    const hasPermission = group.permissions.includes(permission);
                    logDebug(`子区域特定权限检查结果: ${hasPermission ? "允许" : "拒绝"}`);
                    return hasPermission;
                }
            }
        }
        
        // 检查子区域默认权限组 - 使用缓存
        const areaDefaultGroup = getAreaDefaultGroupCached(areaId);
        if (areaDefaultGroup) {
            // 查找此组详情
            const db = getDbSession();
            const stmt = db.prepare("SELECT uuid FROM custom_groups WHERE groupName = ? LIMIT 1");
            stmt.bind(areaDefaultGroup);
            
            let groupUuid = null;
            if (stmt.step()) {
                groupUuid = stmt.fetch().uuid;
            }
            
            if (groupUuid) {
                const group = getCustomGroupCached(groupUuid, areaDefaultGroup);
                if (group) {
                    const hasPermission = group.permissions.includes(permission);
                    logDebug(`子区域默认权限组检查结果: ${hasPermission ? "允许" : "拒绝"}`);
                    return hasPermission;
                }
            }
        }
    }

    // 获取玩家在此区域的特定权限组设置 - 使用缓存
    const playerSpecificGroup = getPlayerPermissionCached(player.uuid, areaId);

    // 检查是否为子区域
    const isSubarea = area.isSubarea && area.parentAreaId;
    logDebug(`区域 ${areaId} ${isSubarea ? '是子区域，父区域为: ' + area.parentAreaId : '不是子区域'}`);
    
    // 1. 检查当前区域特定玩家权限组
    if (playerSpecificGroup) {
        logDebug(`玩家 ${player.name} 在当前区域 ${areaId} 有指定权限组: ${playerSpecificGroup}`);
        
        // 查找此组详情
        const db = getDbSession();
        const stmt = db.prepare("SELECT uuid FROM custom_groups WHERE groupName = ? LIMIT 1");
        stmt.bind(playerSpecificGroup);
        
        let groupUuid = null;
        if (stmt.step()) {
            groupUuid = stmt.fetch().uuid;
        }
        
        if (groupUuid) {
            const group = getCustomGroupCached(groupUuid, playerSpecificGroup);
            if (group) {
                const hasPermission = group.permissions.includes(permission);
                logDebug(`权限检查结果(当前区域特定组 ${playerSpecificGroup}): ${hasPermission ? "允许" : "拒绝"}`);
                return hasPermission;
            }
        }
        
        logWarning(`玩家 ${player.name} 在区域 ${areaId} 设置的权限组 ${playerSpecificGroup} 未找到，将忽略此设置。`);
    }

    // 2. 如果是子区域，检查主区域特定玩家权限组
    if (isSubarea) {
        const playerParentSpecificGroup = getPlayerPermissionCached(player.uuid, area.parentAreaId);
        if (playerParentSpecificGroup) {
            logDebug(`玩家 ${player.name} 在父区域 ${area.parentAreaId} 有指定权限组: ${playerParentSpecificGroup}`);
            
            // 查找此组详情
            const db = getDbSession();
            const stmt = db.prepare("SELECT uuid FROM custom_groups WHERE groupName = ? LIMIT 1");
            stmt.bind(playerParentSpecificGroup);
            
            let groupUuid = null;
            if (stmt.step()) {
                groupUuid = stmt.fetch().uuid;
            }
            
            if (groupUuid) {
                const group = getCustomGroupCached(groupUuid, playerParentSpecificGroup);
                if (group) {
                    const hasPermission = group.permissions.includes(permission);
                    logDebug(`权限检查结果(父区域特定组 ${playerParentSpecificGroup}): ${hasPermission ? "允许" : "拒绝"}`);
                    return hasPermission;
                }
            }
            
            logWarning(`玩家 ${player.name} 在父区域 ${area.parentAreaId} 设置的权限组 ${playerParentSpecificGroup} 未找到，将忽略此设置。`);
        }
    }

    // 3. 检查当前区域默认权限组 - 使用缓存
    const areaDefaultGroup = getAreaDefaultGroupCached(areaId);
    if (areaDefaultGroup) {
        logDebug(`区域 ${areaId} 使用默认权限组: ${areaDefaultGroup}`);
        
        // 查找此组详情
        const db = getDbSession();
        const stmt = db.prepare("SELECT uuid FROM custom_groups WHERE groupName = ? LIMIT 1");
        stmt.bind(areaDefaultGroup);
        
        let groupUuid = null;
        if (stmt.step()) {
            groupUuid = stmt.fetch().uuid;
        }
        
        if (groupUuid) {
            const group = getCustomGroupCached(groupUuid, areaDefaultGroup);
            if (group) {
                const hasPermission = group.permissions.includes(permission);
                logDebug(`权限检查结果(当前区域默认组 ${areaDefaultGroup}): ${hasPermission ? "允许" : "拒绝"}`);
                return hasPermission;
            }
        }
        
        logWarning(`区域 ${areaId} 设置的默认权限组 ${areaDefaultGroup} 未找到，将忽略此设置。`);
    }

    // 4. 如果是子区域，检查主区域默认权限组
    if (isSubarea) {
        const parentAreaDefaultGroup = getAreaDefaultGroupCached(area.parentAreaId);
        if (parentAreaDefaultGroup) {
            logDebug(`父区域 ${area.parentAreaId} 使用默认权限组: ${parentAreaDefaultGroup}`);
            
            // 查找此组详情
            const db = getDbSession();
            const stmt = db.prepare("SELECT uuid FROM custom_groups WHERE groupName = ? LIMIT 1");
            stmt.bind(parentAreaDefaultGroup);
            
            let groupUuid = null;
            if (stmt.step()) {
                groupUuid = stmt.fetch().uuid;
            }
            
            if (groupUuid) {
                const group = getCustomGroupCached(groupUuid, parentAreaDefaultGroup);
                if (group) {
                    const hasPermission = group.permissions.includes(permission);
                    logDebug(`权限检查结果(父区域默认组 ${parentAreaDefaultGroup}): ${hasPermission ? "允许" : "拒绝"}`);
                    return hasPermission;
                }
            }
            
            logWarning(`父区域 ${area.parentAreaId} 设置的默认权限组 ${parentAreaDefaultGroup} 未找到，将忽略此设置。`);
        }
    }

    // 5. 最后使用系统默认权限（最低优先级）- 使用缓存
    logDebug(`玩家 ${player.name} 在区域 ${areaId} 未匹配特定或区域默认权限组，使用系统默认权限检查: ${permission}`);
    const defaultPermissions = getSystemDefaultPermissionsCached();
    const hasDefaultPermission = defaultPermissions.includes(permission);
    logDebug(`权限检查结果(系统默认): ${hasDefaultPermission ? "允许" : "拒绝"}`);
    
    return hasDefaultPermission;
}





// 检查自定义权限组中是否有指定权限
function hasPermissionInCustomGroup(customGroups, uuid, groupName, permissionId) {
    const group = customGroups[uuid][groupName];
    if (!group) return false;
    
    // 只检查直接权限
    return group.permissions.includes(permissionId);
}


// 设置玩家在区域中的权限组
function setPlayerPermission(playerUuid, areaId, groupName) {
    // Validation
    if (typeof playerUuid !== 'string' || !playerUuid ||
        typeof areaId !== 'string' || !areaId ||
        (groupName !== null && typeof groupName !== 'string') // Allow null to remove permission
       ) {
        logger.error(`设置玩家权限失败：无效参数 (UUID: ${playerUuid}, AreaID: ${areaId}, GroupName: ${groupName})`);
        return false;
    }
    if (permissionCache[playerUuid]) {
        if (groupName === null) {
            delete permissionCache[playerUuid][areaId];
        } else {
            permissionCache[playerUuid][areaId] = groupName;
        }
    }
    try {
        const db = getDbSession();

        if (groupName === null) {
            // Remove the permission entry
            const stmt = db.prepare("DELETE FROM permissions WHERE playerUuid = ? AND areaId = ?");
            stmt.bind([playerUuid, areaId]);
            stmt.execute();
            // Check changes if needed
            logDebug(`已移除玩家 ${playerUuid} 在区域 ${areaId} 的特定权限组`);
        } else {
            // Add or update the permission entry
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO permissions (playerUuid, areaId, groupName)
                VALUES (?, ?, ?)
            `);
            stmt.bind([playerUuid, areaId, groupName]);
            stmt.execute();
            logDebug(`已设置玩家 ${playerUuid} 在区域 ${areaId} 的权限组为: ${groupName}`);
        }
        // stmt.reset(); // Reset if reusing

        return true;

    } catch(e) {
         logger.error(`设置玩家 ${playerUuid} 在区域 ${areaId} 权限为 ${groupName} 失败: ${e}`, e.stack);
         return false;
    }
    /* // Old cache-based logic:
    // const area = areaData[areaId]; // Need areaData passed or loaded if validation is needed
    // if(!area) return false;

    // // 初始化该玩家的权限数据
    // if(!permissionData[playerUuid]) {
    //     permissionData[playerUuid] = {};
    // }

    // // 设置权限组 (or delete if group is null)
    // if (group === null) {
    //      delete permissionData[playerUuid][areaId];
    // } else {
    //      permissionData[playerUuid][areaId] = group;
    // }

    // // 保存权限数据
    // return savePermissionData(permissionData); // Saves the entire cache, inefficient
    */
}

// 获取玩家在区域中的权限组
function getPlayerPermission(playerUuid, areaId) {
    // Validation
    if (typeof playerUuid !== 'string' || !playerUuid || typeof areaId !== 'string' || !areaId) {
         logger.warn(`获取玩家权限失败：无效参数 (UUID: ${playerUuid}, AreaID: ${areaId})`);
         return null;
    }

    try {
        const db = getDbSession();
        const stmt = db.prepare("SELECT groupName FROM permissions WHERE playerUuid = ? AND areaId = ?");
        stmt.bind([playerUuid, areaId]);
        // stmt.execute(); // May not be needed

        let groupName = null;
        if (stmt.step()) {
            const row = stmt.fetch();
            groupName = row.groupName;
        }
        // stmt.reset();

        // logDebug(`玩家 ${playerUuid} 在区域 ${areaId} 的权限组: ${groupName || '无特定'}`); // Noisy
        return groupName; // Returns null if no specific permission is set

    } catch (e) {
         logger.error(`获取玩家 ${playerUuid} 在区域 ${areaId} 权限失败: ${e}`, e.stack);
         return null; // Return null on error
    } finally {
         // Finalize/reset stmt if needed
    }

    /* // Old cache-based logic:
    // const area = areaData[areaId]; // Need areaData or validation
    // if(!area) return null;

    // const playerPerms = permissionData[playerUuid] || {};
    // return playerPerms[areaId] || null; // Returns null if not set
    */
}

// 获取玩家的所有权限数据 (使用 UUID)
function getPlayerAllPermissions(playerUuid) { // Renamed parameter for clarity, kept this version
    // Validation
    if (typeof playerUuid !== 'string' || !playerUuid) {
         logger.warn(`获取玩家所有权限失败：无效 UUID: ${playerUuid}`);
         return {};
    }
    try {
         const db = getDbSession();
         const stmt = db.prepare("SELECT areaId, groupName FROM permissions WHERE playerUuid = ?");
         stmt.bind(playerUuid);
         // stmt.execute(); // May not be needed

         const playerPerms = {};
         while (stmt.step()) {
              const row = stmt.fetch();
              if (row && row.areaId) {
                   playerPerms[row.areaId] = row.groupName;
              }
         }
         // stmt.reset();
         // logDebug(`为玩家 ${playerUuid} 加载了 ${Object.keys(playerPerms).length} 条区域特定权限`);
         return playerPerms;
    } catch (e) {
         logger.error(`获取玩家 ${playerUuid} 所有权限失败: ${e}`, e.stack);
         return {}; // Return empty on error
    } finally {
         // Finalize/reset stmt if needed
    }
   // return permissionData[playerUuid] || {}; // Old cache logic - Removed duplicate function below
}
// // 获取玩家的所有权限数据 (旧的，基于 XUID 和内存变量，已移除)
// function getPlayerAllPermissions(playerXuid) {
//     return permissionData[playerXuid] || {};
// }

// 删除区域时清理相关权限数据
function cleanAreaPermissions(areaId) {
    // Validation
    if (typeof areaId !== 'string' || !areaId) {
         logger.error(`清理区域权限失败：无效 AreaID: ${areaId}`);
         return false;
    }

    let db;
    let success = true;
    delete defaultGroupsCache[areaId];
    if (defaultGroupsCache._timestamps) {
        delete defaultGroupsCache._timestamps[areaId];
    }
    
    // 清理所有玩家缓存中与此区域相关的权限
    for (const uuid in permissionCache) {
        if (permissionCache[uuid][areaId]) {
            delete permissionCache[uuid][areaId];
        }
    }
    try {
         db = getDbSession();
         db.exec("BEGIN TRANSACTION"); // Use transaction for atomicity

         // Delete player-specific permissions for this area
         const permStmt = db.prepare("DELETE FROM permissions WHERE areaId = ?");
         permStmt.bind(areaId);
         permStmt.execute();
         // Check changes if needed
         // permStmt.reset();
         logDebug(`已清理区域 ${areaId} 的玩家特定权限`);

         // Delete default group setting for this area
         const defaultStmt = db.prepare("DELETE FROM default_groups WHERE areaId = ?");
         defaultStmt.bind(areaId);
         defaultStmt.execute();
         // Check changes if needed
         // defaultStmt.reset();
         logDebug(`已清理区域 ${areaId} 的默认权限组设置`);

         db.exec("COMMIT");
         logInfo(`成功清理区域 ${areaId} 的所有相关权限数据`);

    } catch (e) {
         logger.error(`清理区域 ${areaId} 权限数据失败: ${e}`, e.stack);
         success = false;
         if (db && db.isOpen()) {
              try {
                   db.exec("ROLLBACK");
                   logger.info(`区域 ${areaId} 权限清理事务已回滚`);
              } catch (rollbackErr) {
                   logger.error(`事务回滚失败: ${rollbackErr}`);
              }
         }
    } finally {
         // Finalize/reset statements if needed
    }
    return success;


   /* // Old cache-based logic:
   let changed = false;
   for(let uuid in permissionData) {
       if(permissionData[uuid][areaId]) {
           delete permissionData[uuid][areaId];
           changed = true;
       }
   }

   // Also clean default group config (needs load/save pattern for config file)
   const defaultConfig = loadDefaultGroupConfig(); // Assuming this loads from file/DB
   if(defaultConfig[areaId]) {
       delete defaultConfig[areaId];
       // Assuming saveDefaultGroupConfig writes back to file/DB
       if (!saveDefaultGroupConfig(defaultConfig)) {
            logger.error(`清理区域 ${areaId} 默认权限组配置失败`);
            // Decide how to handle this error - maybe don't save player perms either?
       }
       changed = true; // Mark changed even if only default config was removed
   }

   if (changed) {
       // Save the modified player permissions data
       if (!savePermissionData(permissionData)) {
            logger.error(`保存清理后的玩家权限数据失败 for area ${areaId}`);
            return false; // Indicate failure
       }
   }
   return true; // Indicate success or no changes needed
   */
}

// 修改系统默认权限
function setSystemDefaultPermissions(permissions) {
    if (!Array.isArray(permissions)) {
         logger.error("设置系统默认权限失败：提供的权限不是数组");
         return false;
    }
    if (systemDefaultPermissionsCache) {
        systemDefaultPermissionsCache.permissions = permissions;
        systemDefaultPermissionsCache._timestamp = Date.now();
    }
    try {
        const config = loadConfig(); // Load current config
        config.defaultGroupPermissions = permissions; // Update the specific key
        const success = saveConfig(config); // Save the whole config back
        if (success) {
            logInfo(`系统默认权限已更新为: [${permissions.join(', ')}]`);
        } else {
             logError("保存更新后的系统默认权限失败");
        }
        return success;
    } catch (e) {
        logger.error(`设置系统默认权限时发生错误: ${e}`, e.stack);
        return false;
    }
}

function getPlayerPermissionCached(playerUuid, areaId) {
    // 初始化玩家缓存
    if (!permissionCache[playerUuid]) {
        permissionCache[playerUuid] = {};
        // 从数据库加载该玩家的所有权限
        const db = getDbSession();
        const stmt = db.prepare("SELECT areaId, groupName FROM permissions WHERE playerUuid = ?");
        stmt.bind(playerUuid);
        
        while (stmt.step()) {
            const row = stmt.fetch();
            permissionCache[playerUuid][row.areaId] = row.groupName;
        }
        permissionCache[playerUuid]._timestamp = Date.now();
    }
    
    return permissionCache[playerUuid][areaId] || null;
}

function getAreaDefaultGroupCached(areaId) {
    // 检查缓存
    if (defaultGroupsCache[areaId] === undefined) {
        const db = getDbSession();
        const stmt = db.prepare("SELECT groupName FROM default_groups WHERE areaId = ?");
        stmt.bind(areaId);
        
        if (stmt.step()) {
            const row = stmt.fetch();
            defaultGroupsCache[areaId] = row.groupName;
        } else {
            defaultGroupsCache[areaId] = null; // 显式缓存null结果
        }
        defaultGroupsCache._timestamps = defaultGroupsCache._timestamps || {};
        defaultGroupsCache._timestamps[areaId] = Date.now();
    }
    
    return defaultGroupsCache[areaId];
}

function getCustomGroupCached(uuid, groupName) {
    // 检查缓存
    if (!customGroupsCache[uuid] || !customGroupsCache[uuid][groupName]) {
        if (!customGroupsCache[uuid]) {
            customGroupsCache[uuid] = {};
            customGroupsCache[uuid]._timestamp = Date.now();
        }
        
        const db = getDbSession();
        const stmt = db.prepare("SELECT displayName, permissions FROM custom_groups WHERE uuid = ? AND groupName = ?");
        stmt.bind([uuid, groupName]);
        
        if (stmt.step()) {
            const row = stmt.fetch();
            let permissions = [];
            try {
                if (typeof row.permissions === 'string' && row.permissions.trim() !== '') {
                    permissions = JSON.parse(row.permissions);
                    if (!Array.isArray(permissions)) permissions = [];
                }
            } catch (e) {
                logWarning(`权限组 ${groupName} (UUID: ${uuid}) 权限 JSON 解析失败: ${e.message || e}`);
            }
            
            customGroupsCache[uuid][groupName] = {
                name: row.displayName || groupName,
                permissions: permissions,
                inherit: null,
                _timestamp: Date.now()
            };
        } else {
            // 未找到此组，缓存一个空组避免重复查询
            customGroupsCache[uuid][groupName] = null;
        }
    }
    
    return customGroupsCache[uuid][groupName];
}

function getSystemDefaultPermissionsCached() {
    if (systemDefaultPermissionsCache === null) {
        const config = loadConfig();
        systemDefaultPermissionsCache = {
            permissions: config.defaultGroupPermissions || [],
            _timestamp: Date.now()
        };
    }
    return systemDefaultPermissionsCache.permissions;
}
// 缓存清理函数
function cleanupCache() {
    const now = Date.now();
    // 每5分钟最多检查一次过期缓存
    if (now - lastCacheCleanup < 5 * 60 * 1000) return;
    
    lastCacheCleanup = now;
    
    // 清理玩家权限缓存
    for (const uuid in permissionCache) {
        if (permissionCache[uuid]._timestamp && now - permissionCache[uuid]._timestamp > CACHE_TTL) {
            delete permissionCache[uuid];
        }
    }
    
    // 清理自定义组缓存
    for (const uuid in customGroupsCache) {
        if (customGroupsCache[uuid]._timestamp && now - customGroupsCache[uuid]._timestamp > CACHE_TTL) {
            delete customGroupsCache[uuid];
        }
    }
    
    // 清理默认组缓存
    if (defaultGroupsCache._timestamps) {
        for (const areaId in defaultGroupsCache._timestamps) {
            if (now - defaultGroupsCache._timestamps[areaId] > CACHE_TTL) {
                delete defaultGroupsCache[areaId];
                delete defaultGroupsCache._timestamps[areaId];
            }
        }
    }
    
    // 清理系统默认权限缓存
    if (systemDefaultPermissionsCache && now - systemDefaultPermissionsCache._timestamp > CACHE_TTL) {
        systemDefaultPermissionsCache = null;
    }
}

function resetCache() {
    permissionCache = {};
    customGroupsCache = {};
    defaultGroupsCache = {};
    systemDefaultPermissionsCache = null;
    lastCacheCleanup = Date.now();
    logInfo("权限缓存已完全重置");
}
module.exports = {
    checkPermission,
    setPlayerPermission, 
    getPlayerPermission,
    getAreaDefaultGroup,
    setAreaDefaultGroup,
    cleanAreaPermissions,
    getPlayerAllPermissions,
    getSystemDefaultPermissions,
    setSystemDefaultPermissions,
    hasPermissionInCustomGroup,
    groupHasAdminPermissions,
    getAvailableGroups,
    resetCache
};

// 移除 loadDefaultGroupPermissions() 调用
