const { loadPermissionData, savePermissionData } = require('./permissionData');
const { PERMISSIONS, getAllPermissionIds } = require('./permissionRegistry');
// 默认权限组配置的保存路径
const DEFAULT_GROUP_CONFIG_PATH = './plugins/area/defaultGroups.json';
const { loadConfig } = require('./configManager');
const { getDbSession } = require('./database');
const {logDebug, logInfo, logWarning, logError } = require('./logger');

// 加载权限数据
let permissionData = loadPermissionData();

// 获取默认权限组的配置
function getDefaultGroupConfig() {
    const config = loadConfig();
    // 如果配置文件中没有设置默认权限组,使用访客权限
    return config.defaultGroup || "visitor";
}



// 保存默认权限组配置
function saveDefaultGroupConfig(data) {
    try {
        const db = getDbSession();
        
        // 开始一个事务
        db.exec("BEGIN TRANSACTION");
        
        // 清空旧数据
        db.exec("DELETE FROM default_groups");
        
        const stmt = db.prepare("INSERT INTO default_groups (areaId, groupName) VALUES (?, ?)");
        
        // 插入新数据
        let count = 0;
        for(const areaId in data) {
            stmt.bind([areaId, data[areaId]]);
            stmt.execute();
            stmt.reset();
            count++;
        }
        
        // 提交事务
        db.exec("COMMIT");
        
        logDebug(`成功保存${count}条默认权限组配置到数据库`);
        return true;
    } catch(e) {
        // 发生错误时回滚事务
        try {
            getDbSession().exec("ROLLBACK");
        } catch(rollbackErr) {
            logger.error(`事务回滚失败: ${rollbackErr}`);
        }
        
        logger.error(`保存默认权限组配置失败: ${e}`);
        return false;
    }
}

// 为区域设置默认权限组
function setAreaDefaultGroup(areaId, groupName) {
    try {
        const db = getDbSession();
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO default_groups (areaId, groupName)
            VALUES (?, ?)
        `);
        
        stmt.bind([areaId, groupName]);
        stmt.execute();
        
        logDebug(`成功为区域${areaId}设置默认权限组: ${groupName}`);
        return true;
    } catch(e) {
        logger.error(`设置区域默认权限组失败: ${e}`);
        return false;
    }
}


function getSystemDefaultPermissions() {
    const config = loadConfig();
    return config.defaultGroupPermissions || [];
}

// 获取区域的默认权限组
function getAreaDefaultGroup(areaId) {
    try {
        const db = getDbSession();
        const stmt = db.prepare("SELECT groupName FROM default_groups WHERE areaId = ?");
        
        stmt.bind(areaId);
        stmt.execute();
        
        if(stmt.step()) {
            const row = stmt.fetch();
            return row.groupName;
        }
        
        return null; // 没有找到默认组
    } catch(e) {
        logger.error(`获取区域默认权限组失败: ${e}`);
        return null;
    }
}

// 定义默认的权限组
const DEFAULT_GROUPS = {
    visitor: {
        name: "系统默认权限",
        permissions: [],
    }
};

// 从配置文件加载默认权限组的权限
function loadDefaultGroupPermissions() {
    const config = loadConfig();
    if(config.defaultGroupPermissions) {
        DEFAULT_GROUPS.visitor.permissions = config.defaultGroupPermissions;
    }
}



// 在permission.js中修改checkPermission函数
function checkPermission(player, areaData, areaId, permission) {
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
        // 尝试获取该玩家在此子区域的特定权限
        const playerPerms = permissionData[player.uuid] || {};
        const playerCurrentAreaGroup = playerPerms[areaId];
        
        if (playerCurrentAreaGroup) {
            // 检查玩家在子区域的特定权限组
            const customGroups = require('./customGroups').loadCustomGroups();
            for (let uuid in customGroups) {
                if (customGroups[uuid][playerCurrentAreaGroup]) {
                    const hasPermission = hasPermissionInCustomGroup(customGroups, uuid, playerCurrentAreaGroup, permission);
                    logDebug(`子区域特定权限检查结果: ${hasPermission ? "允许" : "拒绝"}`);
                    // 如果子区域明确定义了权限（无论允许还是拒绝），都以它为准
                    return hasPermission;
                }
            }
        }
        
        // 检查子区域默认权限组
        const areaDefaultGroup = getAreaDefaultGroup(areaId);
        if (areaDefaultGroup) {
            const customGroups = require('./customGroups').loadCustomGroups();
            for (let uuid in customGroups) {
                if (customGroups[uuid][areaDefaultGroup]) {
                    const hasPermission = hasPermissionInCustomGroup(customGroups, uuid, areaDefaultGroup, permission);
                    logDebug(`子区域默认权限组检查结果: ${hasPermission ? "允许" : "拒绝"}`);
                    // 如果子区域明确定义了默认权限，以它为准
                    return hasPermission;
                }
            }
        }
    }

    // 获取玩家权限数据
    const playerPerms = permissionData[player.uuid] || {};
    
    // 加载所有自定义权限组
    const customGroups = require('./customGroups').loadCustomGroups();
    
    // 检查是否为子区域
    const isSubarea = area.isSubarea && area.parentAreaId;
    logDebug(`区域 ${areaId} ${isSubarea ? '是子区域，父区域为: ' + area.parentAreaId : '不是子区域'}`);
    
    // 权限检查优先级：子区域特定玩家权限 > 主区域特定玩家权限 > 子区域默认权限 > 主区域默认权限 > 系统默认权限
    
    // 1. 检查当前区域特定玩家权限
    const playerCurrentAreaGroup = playerPerms[areaId];
    if (playerCurrentAreaGroup) {
        logDebug(`玩家 ${player.name} 在当前区域 ${areaId} 有指定权限组: ${playerCurrentAreaGroup}`);
        
        // 检查该权限组是否存在
        for (let uuid in customGroups) {
            if (customGroups[uuid][playerCurrentAreaGroup]) {
                const hasPermission = hasPermissionInCustomGroup(customGroups, uuid, playerCurrentAreaGroup, permission);
                logDebug(`权限检查结果(当前区域特定组): ${hasPermission ? "允许" : "拒绝"}`);
                return hasPermission; // 立即返回结果
            }
        }
    }
    
    // 2. 如果是子区域，检查主区域特定玩家权限
    if (isSubarea) {
        const playerParentAreaGroup = playerPerms[area.parentAreaId];
        if (playerParentAreaGroup) {
            logDebug(`玩家 ${player.name} 在父区域 ${area.parentAreaId} 有指定权限组: ${playerParentAreaGroup}`);
            
            // 检查该权限组是否存在
            for (let uuid in customGroups) {
                if (customGroups[uuid][playerParentAreaGroup]) {
                    const hasPermission = hasPermissionInCustomGroup(customGroups, uuid, playerParentAreaGroup, permission);
                    logDebug(`权限检查结果(父区域特定组): ${hasPermission ? "允许" : "拒绝"}`);
                    return hasPermission; // 立即返回结果
                }
            }
        }
    }
    
    // 3. 检查当前区域默认权限组
    const areaDefaultGroup = getAreaDefaultGroup(areaId);
    if (areaDefaultGroup) {
        logDebug(`区域 ${areaId} 使用默认权限组: ${areaDefaultGroup}`);
        
        // 检查该默认权限组是否存在
        for (let uuid in customGroups) {
            if (customGroups[uuid][areaDefaultGroup]) {
                const hasPermission = hasPermissionInCustomGroup(customGroups, uuid, areaDefaultGroup, permission);
                logDebug(`权限检查结果(当前区域默认组): ${hasPermission ? "允许" : "拒绝"}`);
                return hasPermission; // 立即返回结果
            }
        }
    }
    
    // 4. 如果是子区域，检查主区域默认权限组
    if (isSubarea) {
        const parentAreaDefaultGroup = getAreaDefaultGroup(area.parentAreaId);
        if (parentAreaDefaultGroup) {
            logDebug(`父区域 ${area.parentAreaId} 使用默认权限组: ${parentAreaDefaultGroup}`);
            
            // 检查该默认权限组是否存在
            for (let uuid in customGroups) {
                if (customGroups[uuid][parentAreaDefaultGroup]) {
                    const hasPermission = hasPermissionInCustomGroup(customGroups, uuid, parentAreaDefaultGroup, permission);
                    logDebug(`权限检查结果(父区域默认组): ${hasPermission ? "允许" : "拒绝"}`);
                    return hasPermission; // 立即返回结果
                }
            }
        }
    }
    
    // 5. 最后使用系统默认权限（最低优先级）
    logDebug(`玩家 ${player.name} 在区域 ${areaId} 使用系统默认权限, 检查权限: ${permission}`);
    const defaultPermissions = getSystemDefaultPermissions();
    const hasDefaultPermission = defaultPermissions.includes(permission);
    logDebug(`权限检查结果(系统默认): ${hasDefaultPermission ? "允许" : "拒绝"}`);
    
    return hasDefaultPermission;
}



//权限检查函数
function hasPermissionInGroup(groupName, permissionId) {
    const group = DEFAULT_GROUPS[groupName];
    if (!group) return false;
    
    // 检查权限
    return group.permissions.includes(permissionId);
}

// 检查自定义权限组中是否有指定权限
function hasPermissionInCustomGroup(customGroups, uuid, groupName, permissionId) {
    const group = customGroups[uuid][groupName];
    if (!group) return false;
    
    // 只检查直接权限
    return group.permissions.includes(permissionId);
}


// 设置玩家在区域中的权限组
function setPlayerPermission(areaData, areaId, playerXuid, group) {
    const area = areaData[areaId];
    if(!area) return false;

    // 初始化该玩家的权限数据
    if(!permissionData[playerXuid]) {
        permissionData[playerXuid] = {};
    }

    // 设置权限组
    permissionData[playerXuid][areaId] = group;

    // 保存权限数据
    return savePermissionData(permissionData);
}

// 获取玩家在区域中的权限组
function getPlayerPermission(areaData, areaId, playerXuid) {
    const area = areaData[areaId];
    if(!area) return null;

    const playerPerms = permissionData[playerXuid] || {};
    return playerPerms[areaId] || null;
}

// 获取所有可用的权限组
function getAvailableGroups() {
    // 获取所有自定义权限组
    const customGroups = require('./customGroups').loadCustomGroups();
    let allGroups = {};
    
    // 合并所有玩家的自定义权限组
    for (let uuid in customGroups) {
        allGroups = {...allGroups, ...customGroups[uuid]};
    }
    
    return allGroups;
}
// 获取玩家的所有权限数据
function getPlayerAllPermissions(playerXuid) {
    return permissionData[playerXuid] || {};
}

// 删除区域时清理相关权限数据
function cleanAreaPermissions(areaId) {
    for(let uuid in permissionData) {
        if(permissionData[uuid][areaId]) {
            delete permissionData[uuid][areaId];
        }
    }
    
    // 同时清理区域默认权限组设置
    const config = loadDefaultGroupConfig();
    if(config[areaId]) {
        delete config[areaId];
        saveDefaultGroupConfig(config);
    }
    
    return savePermissionData(permissionData);
}

// 修改系统默认权限
function setSystemDefaultPermissions(permissions) {
    const config = loadConfig();
    config.defaultGroupPermissions = permissions;
    return saveConfig(config);
}

module.exports = {
    checkPermission,
    setPlayerPermission, 
    getPlayerPermission,
    getAvailableGroups,
    getAreaDefaultGroup,
    setAreaDefaultGroup,
    cleanAreaPermissions,
    getPlayerAllPermissions,
    getSystemDefaultPermissions,
    setSystemDefaultPermissions,
    hasPermissionInCustomGroup
};

// 初始化时加载权限
loadDefaultGroupPermissions();