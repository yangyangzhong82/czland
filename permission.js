const { loadPermissionData, savePermissionData } = require('./permissionData');
const { PERMISSIONS, getAllPermissionIds } = require('./permissionRegistry');
// 默认权限组配置的保存路径
const DEFAULT_GROUP_CONFIG_PATH = './plugins/area/defaultGroups.json';
const { loadConfig, saveConfig } = require('./configManager'); // 导入 saveConfig
const { getDbSession } = require('./database');
const {logDebug, logInfo, logWarning, logError } = require('./logger');
const { loadCustomGroups } = require('./customGroups'); // 确保引入 loadCustomGroups
const getOfflinePlayerData = ll.import("PlayerData", "getOfflinePlayerData"); // 引入获取离线玩家数据
let permissionCache = {}; // 玩家权限缓存 {playerUuid: {areaId: groupName}}
let customGroupsCache = {}; // 自定义组缓存 {uuid: {groupName: {name, permissions, inherit}}}
let defaultGroupsCache = {}; // 区域默认组缓存 {areaId: groupName}
let inheritFlagCache = {}; // 新增：区域继承标志缓存 {areaId: 0 or 1}
let systemDefaultPermissionsCache = null; // 系统默认权限缓存
let playerNameCache = {}; // 玩家名称缓存 {uuid: name}
const CACHE_TTL = 5 * 60 * 1000; // 缓存有效期(5分钟)
let lastCacheCleanup = Date.now();




// 修改：接受 group 对象，而不是 groupId 和 groupsData
function groupHasAdminPermissions(group) {
    if (!group || !Array.isArray(group.permissions)) return false;

    // Check PERMISSIONS registry (ensure it's loaded/available)
    if (!PERMISSIONS || typeof PERMISSIONS !== 'object') {
        logError("PERMISSIONS registry not available for admin check");
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




// 获取所有可用的自定义权限组
// 返回格式: { "组名1_创建者UUID1": groupDetails1, "组名2_创建者UUID2": groupDetails2, ... }
// groupDetails 包含 creatorUuid, creatorName, originalGroupName, name, permissions 等
function getAvailableGroups() {
    let availableGroups = {};
    try {
        // loadCustomGroups 返回格式为 { uuid: { groupName: groupDetails } }
        const allPlayerGroups = loadCustomGroups(); // { creatorUuid: { originalGroupName: { name, permissions, inherit } } }
        logDebug(`[getAvailableGroups] loadCustomGroups 返回 ${Object.keys(allPlayerGroups).length} 个玩家的组`);

        // 获取所有玩家名称用于填充 creatorName
        const allPlayersData = getOfflinePlayerData() || [];
        const playerMap = {}; // { uuid: name }
        allPlayersData.forEach(p => playerMap[p.uuid] = p.name);

        for (const creatorUuid in allPlayerGroups) {
            const creatorName = playerMap[creatorUuid] || `未知UUID(${creatorUuid.substring(0, 8)}...)`; // 获取创建者名称
            for (const originalGroupName in allPlayerGroups[creatorUuid]) {
                const groupDetails = allPlayerGroups[creatorUuid][originalGroupName];
                // 使用 originalGroupName 和 creatorUuid 创建唯一键
                const uniqueKey = `${originalGroupName}_${creatorUuid}`;

                // 补充 groupDetails 缺少的信息
                const fullGroupDetails = {
                    ...groupDetails, // 包含 name, permissions, inherit
                    originalGroupName: originalGroupName, // 添加原始组名
                    creatorUuid: creatorUuid, // 添加创建者 UUID
                    creatorName: creatorName // 添加创建者名称
                };

                availableGroups[uniqueKey] = fullGroupDetails;
                logDebug(`[getAvailableGroups] 添加组: ${uniqueKey} -> ${JSON.stringify(fullGroupDetails)}`);
            }
        }
    } catch (error) {
        logError(`获取自定义权限组时出错: ${error}`, error.stack);
        availableGroups = {}; // 出错时返回空对象
    }

    logDebug(`[getAvailableGroups] 最终返回 ${Object.keys(availableGroups).length} 个可用的自定义权限组`);
    return availableGroups; // 返回包含详细信息的对象
}




// --- 修改 setAreaDefaultGroup ---
// 为区域设置默认权限组 (groupName 为 null 表示使用系统默认)
// 新增 inheritPermissions 参数 (1 表示继承, 0 表示不继承, null 表示不修改此标志)
function setAreaDefaultGroup(areaId, groupName, inheritPermissions = null) {
    // Validation
    if (typeof areaId !== 'string' || !areaId) {
        logError(`设置区域默认权限组失败：无效 AreaID (${areaId})`);
        return false;
    }
    if (groupName !== null && (typeof groupName !== 'string' || !groupName)) {
        logError(`设置区域默认权限组失败：无效 GroupName (${groupName}) for AreaID (${areaId})`);
        return false;
    }
    if (inheritPermissions !== null && typeof inheritPermissions !== 'number' && typeof inheritPermissions !== 'boolean') {
        logError(`设置区域默认权限组失败：无效 inheritPermissions (${inheritPermissions}) for AreaID (${areaId})`);
        return false;
    }

    // 更新缓存
    defaultGroupsCache[areaId] = groupName;
    defaultGroupsCache._timestamps = defaultGroupsCache._timestamps || {};
    defaultGroupsCache._timestamps[areaId] = Date.now();
    if (inheritPermissions !== null) {
        inheritFlagCache[areaId] = inheritPermissions ? 1 : 0; // 存为 1 或 0
        inheritFlagCache._timestamps = inheritFlagCache._timestamps || {};
        inheritFlagCache._timestamps[areaId] = Date.now();
    }


    try {
        const db = getDbSession();
        let sql = "UPDATE areas SET defaultGroupName = ?";
        const params = [groupName];

        // 如果提供了 inheritPermissions，则同时更新
        if (inheritPermissions !== null) {
            sql += ", inheritDefaultPermissions = ?";
            params.push(inheritPermissions ? 1 : 0); // 确保存入 1 或 0
        }

        sql += " WHERE id = ?";
        params.push(areaId);

        const stmt = db.prepare(sql);
        stmt.bind(params);
        stmt.execute();

        // Check affected rows
        let affectedRows = 0;
        const result = db.query("SELECT changes()");
        if (result && result.length > 1 && result[1] && typeof result[1][0] === 'number') {
            affectedRows = result[1][0];
        }

        if (affectedRows > 0) {
            let logMsg = `成功为区域 ${areaId} 设置默认权限组为: ${groupName === null ? '系统默认 (null)' : groupName}`;
            if (inheritPermissions !== null) {
                logMsg += `, 继承标志设置为: ${inheritPermissions ? 1 : 0}`;
            }
            logDebug(logMsg);
            return true;
        } else {
            logWarning(`尝试为区域 ${areaId} 更新默认设置，但未找到该区域或更新失败`);
            // 清理缓存
            delete defaultGroupsCache[areaId];
            if (defaultGroupsCache._timestamps) delete defaultGroupsCache._timestamps[areaId];
            delete inheritFlagCache[areaId];
            if (inheritFlagCache._timestamps) delete inheritFlagCache._timestamps[areaId];
            return false;
        }
    } catch(e) {
        logger.error(`设置区域 ${areaId} 默认设置失败: ${e}`, e.stack);
        return false;
    }
}


// ... (getSystemDefaultPermissions, getAreaDefaultGroup 保持不变) ...


// --- 新增 getAreaInheritFlagCached ---
/**
 * 获取区域是否继承父区域默认权限的标志 (缓存)
 * @param {string} areaId 区域ID
 * @returns {number} 1 表示继承, 0 表示不继承, 默认返回 1
 */
function getAreaInheritFlagCached(areaId) {
    // 检查缓存
    const now = Date.now();
    if (inheritFlagCache[areaId] === undefined || (inheritFlagCache._timestamps && now - inheritFlagCache._timestamps[areaId] > CACHE_TTL)) {
        try {
            const db = getDbSession();
            const stmt = db.prepare("SELECT inheritDefaultPermissions FROM areas WHERE id = ?");
            stmt.bind(areaId);

            if (stmt.step()) {
                const row = stmt.fetch();
                // 数据库中可能是 NULL 或 1 或 0，我们需要处理 NULL 的情况，默认为 1
                inheritFlagCache[areaId] = (row.inheritDefaultPermissions === 0) ? 0 : 1;
            } else {
                logWarning(`尝试缓存区域 ${areaId} 的继承标志，但未在 areas 表中找到该区域。默认为继承(1)。`);
                inheritFlagCache[areaId] = 1; // 区域不存在时，默认行为是继承（虽然这不应该发生）
            }
            inheritFlagCache._timestamps = inheritFlagCache._timestamps || {};
            inheritFlagCache._timestamps[areaId] = now;
        } catch (e) {
            logError(`获取区域 ${areaId} 继承标志失败: ${e}`, e.stack);
            inheritFlagCache[areaId] = 1; // 出错时默认为继承
        }
    }
    // 返回缓存值，确保是 0 或 1
    return inheritFlagCache[areaId] === 0 ? 0 : 1;
}


// --- 修改 checkPermission ---
function getSystemDefaultPermissions() {
    const config = loadConfig();
    return config.defaultGroupPermissions || [];
}

// 获取区域的默认权限组
function getAreaDefaultGroup(areaId) {
    if (typeof areaId !== 'string' || !areaId) {
         logger.warn(`尝试获取无效 AreaID 的默认权限组: '${areaId}'`);
          return null; // Return null if areaId is invalid
     }
    try {
        const db = getDbSession();
        // Select the defaultGroupName directly from the areas table
        const stmt = db.prepare("SELECT defaultGroupName FROM areas WHERE id = ?");
        stmt.bind(areaId);

        let groupName = null;
        if (stmt.step()) {
            const row = stmt.fetch();
            // The value might be explicitly NULL in the database
            groupName = row.defaultGroupName; // This can be null
        }
        // stmt.reset(); // Good practice if reusing

        // logDebug(`区域 ${areaId} 的默认权限组: ${groupName === null ? '系统默认 (null)' : groupName}`); // Adjusted log
        return groupName; // Returns null if not found or explicitly set to null
    } catch(e) {
        logger.error(`获取区域 ${areaId} 默认权限组失败: ${e}`, e.stack);
       return null; // Return null on error
   } finally {
        // Finalize/reset stmt if needed
    }
}





function checkPermission(player, areaData, areaId, permission) {
    // 定期清理缓存
    cleanupCache();

    const area = areaData[areaId];
    if(!area) return false;
    
    logDebug(`开始检查权限 - 玩家: ${player.name}, 区域: ${areaId}, 权限: ${permission}`);
    
    // 检查玩家是否是领地管理员
    const { isAreaAdmin } = require('./areaAdmin');
    if (isAreaAdmin(player.uuid)) {
        logDebug(`玩家 ${player.name} 是领地管理员，授予所有权限`);
        return true;
    }
    
    // 检查玩家是否是区域所有者 
    const isOwner = (area.uuid && player.uuid === area.uuid) || (area.xuid && player.xuid === area.xuid);
    if (isOwner) {
        logDebug(`玩家 ${player.name} 是区域创建者 (UUID 或 XUID 匹配)，授予所有权限`);
        return true;
    }

    // --- 优化: 预编译查找组创建者UUID的语句 ---
    const db = getDbSession();
    let findGroupCreatorStmt;
    try {
        findGroupCreatorStmt = db.prepare("SELECT uuid FROM custom_groups WHERE groupName = ? LIMIT 1");
    } catch (e) {
        logError(`预编译 findGroupCreatorStmt 失败: ${e.message}`, e.stack);
        // 如果预编译失败，后续依赖此语句的检查将无法进行，可能需要返回 false 或抛出错误
        // 这里选择记录错误并允许函数继续，但依赖此语句的检查会跳过
    }
    // --- 结束优化 ---


    // 检查玩家是否是父区域所有者
    if(area.isSubarea && area.parentAreaId) {
        const parentArea = areaData[area.parentAreaId];
        const isParentOwner = parentArea && ((parentArea.uuid && player.uuid === parentArea.uuid) || (parentArea.xuid && player.xuid === parentArea.xuid));
        if(isParentOwner) {
            logDebug(`玩家 ${player.name} 是父区域 ${area.parentAreaId} 的创建者 (UUID 或 XUID 匹配)，授予子区域所有权限`);
            return true;
        }
    }

    // --- 权限检查顺序调整 ---
    const isSubarea = area.isSubarea && area.parentAreaId;
    logDebug(`区域 ${areaId} ${isSubarea ? '是子区域，父区域为: ' + area.parentAreaId : '不是子区域'}`);

    // 1. 检查当前区域特定玩家权限组 (不变)
    const playerSpecificGroup = getPlayerPermissionCached(player.uuid, areaId);
    if (playerSpecificGroup && findGroupCreatorStmt) {
        logDebug(`玩家 ${player.name} 在当前区域 ${areaId} 有指定权限组: ${playerSpecificGroup}`);
        findGroupCreatorStmt.reset();
        findGroupCreatorStmt.bind(playerSpecificGroup);
        let groupUuid = null;
        if (findGroupCreatorStmt.step()) { groupUuid = findGroupCreatorStmt.fetch().uuid; }
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

    // 2. 检查当前区域默认权限组 (不变)
    const areaDefaultGroupCurrent = getAreaDefaultGroupCached(areaId);
    if (areaDefaultGroupCurrent && findGroupCreatorStmt) {
        logDebug(`区域 ${areaId} 使用默认权限组: ${areaDefaultGroupCurrent}`);
        findGroupCreatorStmt.reset();
        findGroupCreatorStmt.bind(areaDefaultGroupCurrent);
        let groupUuid = null;
        if (findGroupCreatorStmt.step()) { groupUuid = findGroupCreatorStmt.fetch().uuid; }
        if (groupUuid) {
            const group = getCustomGroupCached(groupUuid, areaDefaultGroupCurrent);
            if (group) {
                const hasPermission = group.permissions.includes(permission);
                logDebug(`权限检查结果(当前区域默认组 ${areaDefaultGroupCurrent}): ${hasPermission ? "允许" : "拒绝"}`);
                return hasPermission;
            }
        }
        logWarning(`区域 ${areaId} 设置的默认权限组 ${areaDefaultGroupCurrent} 未找到，将忽略此设置。`);
    }

    // --- 修改：子区域继承检查 ---
    // 3. 如果是子区域，根据继承标志决定是否检查父区域
    if (isSubarea) {
        const inheritFlag = getAreaInheritFlagCached(areaId); // 获取继承标志
        logDebug(`子区域 ${areaId} 继承标志: ${inheritFlag}`);

        if (inheritFlag === 1) { // 如果允许继承
            logDebug(`子区域 ${areaId} 允许继承，继续检查父区域 ${area.parentAreaId}`);

            // 3.1 检查父区域特定玩家权限组
            const playerParentSpecificGroup = getPlayerPermissionCached(player.uuid, area.parentAreaId);
            if (playerParentSpecificGroup && findGroupCreatorStmt) { // 检查语句是否成功编译
                logDebug(`玩家 ${player.name} 在父区域 ${area.parentAreaId} 有指定权限组: ${playerParentSpecificGroup}`);
                findGroupCreatorStmt.reset(); // 重置语句
                findGroupCreatorStmt.bind(playerParentSpecificGroup);

                let groupUuid = null;
                if (findGroupCreatorStmt.step()) {
                    groupUuid = findGroupCreatorStmt.fetch().uuid; // 使用 findGroupCreatorStmt
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

            // 3.2 检查父区域默认权限组
            const parentAreaDefaultGroup = getAreaDefaultGroupCached(area.parentAreaId);
            if (parentAreaDefaultGroup && findGroupCreatorStmt) { // 检查语句是否成功编译
                logDebug(`父区域 ${area.parentAreaId} 使用默认权限组: ${parentAreaDefaultGroup}`);
                findGroupCreatorStmt.reset(); // 重置语句
                findGroupCreatorStmt.bind(parentAreaDefaultGroup);

                let groupUuid = null;
                if (findGroupCreatorStmt.step()) {
                    groupUuid = findGroupCreatorStmt.fetch().uuid; // 使用 findGroupCreatorStmt
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
        } else {
            logDebug(`子区域 ${areaId} 不继承父区域权限，停止向上检查。`);
            // 如果不继承，且前面子区域的特定和默认权限都没匹配上，则直接跳到系统默认权限
        }
    }
    // --- 继承检查结束 ---


    // 4. 最后使用系统默认权限（最低优先级）- 使用缓存 (不变)
    logDebug(`玩家 ${player.name} 在区域 ${areaId} 未匹配特定或区域(及父区域，若继承)默认权限组，使用系统默认权限检查: ${permission}`);
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
function setPlayerPermission(playerUuid, areaId, targetGroupName, targetGroupCreatorUuid, executorCanGrantAdmin) {
    // Validation - 更新以包含新参数
    if (typeof playerUuid !== 'string' || !playerUuid ||
        typeof areaId !== 'string' || !areaId ||
        (targetGroupName !== null && typeof targetGroupName !== 'string') || // Allow null to remove permission
        (targetGroupName !== null && (typeof targetGroupCreatorUuid !== 'string' || !targetGroupCreatorUuid)) || // Require creator UUID if group name is provided
        typeof executorCanGrantAdmin !== 'boolean' // Validate new boolean flag
       ) {
        logError(`设置玩家权限失败：无效参数 (UUID: ${playerUuid}, AreaID: ${areaId}, GroupName: ${targetGroupName}, Creator: ${targetGroupCreatorUuid}, ExecutorCanGrant: ${executorCanGrantAdmin})`);
        return false;
    }

    // --- 新增权限检查 ---
    if (targetGroupName !== null && executorCanGrantAdmin === false) {
        // 执行者缺少 grantAdminPermissions，检查目标组
        const targetGroup = getCustomGroupCached(targetGroupCreatorUuid, targetGroupName); // 使用缓存获取组信息

        if (!targetGroup) {
            // 这个情况理论上应该由调用者处理（确保组存在），但这里加一层保险
            logError(`设置玩家权限失败：目标权限组 "${targetGroupName}" (创建者: ${targetGroupCreatorUuid}) 不存在或无法加载。`);
            return false;
        }

        if (groupHasAdminPermissions(targetGroup)) {
            logWarning(`权限不足：执行者无权授予包含管理权限的权限组 "${targetGroupName}" 给玩家 ${playerUuid}。`);
            // 返回 false 表示操作失败
            return false; // 阻止设置权限
        }

        // --- 对目标玩家当前组的检查（因无法获取创建者UUID而跳过） ---
        /*
        const currentGroupName = getPlayerPermissionCached(playerUuid, areaId);
        if (currentGroupName) {
            // 问题: 如何找到 currentGroupName 的创建者 UUID?
            // 没有数据库结构或复杂查询的更改，无法可靠地实现此检查。
            // const currentGroup = getCustomGroupCached(currentGroupCreatorUuid, currentGroupName);
            // if (currentGroup && groupHasAdminPermissions(currentGroup)) {
            //     logWarning(`权限不足：执行者无权修改已拥有管理权限组的玩家 ${playerUuid} 的权限。`);
            //     return false;
            // }
        }
        */
    }
    // --- 权限检查结束 ---


    // 更新缓存 
    if (permissionCache[playerUuid]) {
        if (targetGroupName === null) {
            delete permissionCache[playerUuid][areaId];
        } else {
            permissionCache[playerUuid][areaId] = targetGroupName; // 缓存目标组名
        }
        // 如果需要更精细的缓存管理，可以更新时间戳
        permissionCache[playerUuid]._timestamp = Date.now();
    }

    // 继续执行数据库更新 (使用 targetGroupName)
    try {
        const db = getDbSession();

        if (targetGroupName === null) {
            // Remove the permission entry
            const stmt = db.prepare("DELETE FROM permissions WHERE playerUuid = ? AND areaId = ?");
            stmt.bind([playerUuid, areaId]);
            stmt.execute();
            logDebug(`已移除玩家 ${playerUuid} 在区域 ${areaId} 的特定权限组`);
        } else {
            // 添加或更新权限条目
            // 重要: 'permissions' 表只存储 groupName，不存储创建者 UUID。
            // 这意味着 getPlayerPermission 无法知道创建者，使得对目标玩家当前组的检查无法实现。
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO permissions (playerUuid, areaId, groupName)
                VALUES (?, ?, ?)
            `);
            // 存储 targetGroupName (不包含创建者 UUID)
            stmt.bind([playerUuid, areaId, targetGroupName]);
            stmt.execute();
            logDebug(`已设置玩家 ${playerUuid} 在区域 ${areaId} 的权限组为: ${targetGroupName}`);
        }
        return true;

    } catch(e) {
         logError(`设置玩家 ${playerUuid} 在区域 ${areaId} 权限为 ${targetGroupName} 失败: ${e}`, e.stack); // 使用 targetGroupName
         return false;
    }
    /* // 旧的基于缓存的逻辑:
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

          // No longer need to delete from default_groups table as it's removed.
          // The defaultGroupName column in 'areas' will be removed when the area row is deleted.
          // logDebug(`区域 ${areaId} 的默认权限组设置将在区域删除时自动清理`);

          db.exec("COMMIT");
          logInfo(`成功清理区域 ${areaId} 的玩家特定权限数据`); // Updated log message

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
    if (defaultGroupsCache[areaId] === undefined || defaultGroupsCache[areaId] === null && (!defaultGroupsCache._timestamps || !defaultGroupsCache._timestamps[areaId])) { // Check if undefined or explicitly null and not recently cached
        const db = getDbSession();
        // Query the areas table for defaultGroupName
        const stmt = db.prepare("SELECT defaultGroupName FROM areas WHERE id = ?");
        stmt.bind(areaId);

        if (stmt.step()) {
            const row = stmt.fetch();
            defaultGroupsCache[areaId] = row.defaultGroupName; // Cache the value (can be null)
        } else {
            // Area not found, cache null but maybe log a warning?
            logWarning(`尝试缓存区域 ${areaId} 的默认组，但未在 areas 表中找到该区域。`);
            defaultGroupsCache[areaId] = null; // Cache null if area doesn't exist
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
// --- 修改 cleanupCache ---
function cleanupCache() {
    const now = Date.now();
    if (now - lastCacheCleanup < CACHE_TTL) return; // 使用常量

    lastCacheCleanup = now;
    logDebug("开始清理过期权限缓存...");
    let cleanedCount = 0;

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
            delete defaultGroupsCache[areaId];
            delete defaultGroupsCache._timestamps[areaId];
            cleanedCount++;
            }
        }
    }

    // --- 新增：清理继承标志缓存 ---
    if (inheritFlagCache._timestamps) {
        for (const areaId in inheritFlagCache._timestamps) {
            if (now - inheritFlagCache._timestamps[areaId] > CACHE_TTL) {
                delete inheritFlagCache[areaId];
                delete inheritFlagCache._timestamps[areaId];
                cleanedCount++;
            }
        }
    }
    // --- 新增结束 ---


    // 清理系统默认权限缓存
    if (systemDefaultPermissionsCache && now - systemDefaultPermissionsCache._timestamp > CACHE_TTL) {
        systemDefaultPermissionsCache = null;
        cleanedCount++;
    }

    if (cleanedCount > 0) {
        logDebug(`权限缓存清理完成，移除了 ${cleanedCount} 个过期条目。`);
    }
}

// --- 修改 resetCache ---
function resetCache() {
    permissionCache = {};
    customGroupsCache = {};
    defaultGroupsCache = {};
    inheritFlagCache = {}; // 新增
    systemDefaultPermissionsCache = null;
    lastCacheCleanup = Date.now();
    logInfo("权限缓存已完全重置");
}

/**
 * 检查指定的自定义权限组是否包含特定权限。
 * @param {string} creatorUuid 创建者 UUID
 * @param {string} groupName 权限组名称 (原始名称)
 * @param {string} permissionId 要检查的权限 ID
 * @returns {boolean} 如果组存在且包含该权限，则返回 true，否则返回 false。
 */
function groupHasPermission(creatorUuid, groupName, permissionId) {
    const group = getCustomGroupCached(creatorUuid, groupName);
    if (group && Array.isArray(group.permissions)) {
        return group.permissions.includes(permissionId);
    }
    return false;
}

module.exports = {
    checkPermission,
    setPlayerPermission,
    getPlayerPermission,
    getAreaDefaultGroup,
    setAreaDefaultGroup, // 已更新
    getAreaInheritFlagCached, // 新增
    cleanAreaPermissions,
    getPlayerAllPermissions,
    getSystemDefaultPermissions,
    setSystemDefaultPermissions,
    hasPermissionInCustomGroup,
    groupHasAdminPermissions,
    getAvailableGroups,
    resetCache, // 已更新
    groupHasPermission
};
