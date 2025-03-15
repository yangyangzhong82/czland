// customGroups.js

const CUSTOM_GROUPS_PATH = './plugins/area/customGroups.json';
const { DEFAULT_GROUPS } = require('./permission');
const { getDbSession } = require('./database');
const {logDebug, logInfo, logWarning, logError } = require('./logger');
// 加载自定义权限组数据
function loadCustomGroups() {
    try {
        const db = getDbSession();
        const results = db.query("SELECT uuid, groupName, displayName, permissions FROM custom_groups");
        
        // 添加检查，确保results有效
        if (!results) {
            logger.warn("查询权限组表返回空结果");
            return {};
        }
        
        // 转换为旧格式的对象结构
        const customGroups = {};
        for(let i = 1; i < results.length; i++) { // 跳过表头
            const [uuid, groupName, displayName, permissionsJson] = results[i];
            
            if(!customGroups[uuid]) {
                customGroups[uuid] = {};
            }
            
            // 解析权限JSON
            let permissions = [];
            try {
                permissions = JSON.parse(permissionsJson);
            } catch(e) {
                logger.warn(`权限组${groupName}的权限数据解析失败`);
            }
            
            customGroups[uuid][groupName] = {
                name: displayName,
                permissions: permissions,
                inherit: null // 保持与旧代码兼容
            };
        }
        
        return customGroups;
    } catch(e) {
        logger.error(`读取自定义权限组数据失败: ${e}`);
        return {};
    }
}

// 保存自定义权限组数据
function saveCustomGroups(data) {
    try {
        const db = getDbSession();
        
        // 开始一个事务
        db.exec("BEGIN TRANSACTION");
        
        // 清空旧数据
        db.exec("DELETE FROM custom_groups");
        
        const stmt = db.prepare("INSERT INTO custom_groups (uuid, groupName, displayName, permissions) VALUES (?, ?, ?, ?)");
        
        // 插入新数据
        let count = 0;
        for(const uuid in data) {
            for(const groupName in data[uuid]) {
                const group = data[uuid][groupName];
                
                stmt.bind([
                    uuid,
                    groupName,
                    group.name,
                    JSON.stringify(group.permissions || [])
                ]);
                
                stmt.execute();
                stmt.reset();
                count++;
            }
        }
        
        // 提交事务
        db.exec("COMMIT");
        
        logDebug(`成功保存${count}个自定义权限组到数据库`);
        return true;
    } catch(e) {
        // 发生错误时回滚事务
        try {
            getDbSession().exec("ROLLBACK");
        } catch(rollbackErr) {
            logger.error(`事务回滚失败: ${rollbackErr}`);
        }
        
        logger.error(`保存自定义权限组数据失败: ${e}`);
        return false;
    }
}
// 获取玩家的所有自定义权限组
function getPlayerCustomGroups(uuid) {
    try {
        const db = getDbSession();
        const stmt = db.prepare("SELECT groupName, displayName, permissions FROM custom_groups WHERE uuid = ?");
        stmt.bind(uuid);
        stmt.execute();
        
        const groups = {};
        let row;
        while(stmt.step()) {
            row = stmt.fetch();
            groups[row.groupName] = {
                name: row.displayName,
                permissions: JSON.parse(row.permissions),
                inherit: null
            };
        }
        
        return groups;
    } catch(e) {
        logger.error(`获取玩家自定义权限组失败: ${e}`);
        return {};
    }
}


// 创建自定义权限组
function createCustomGroup(uuid, groupName, displayName, permissions, inheritFrom = null) {
    try {
        const db = getDbSession();
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO custom_groups (uuid, groupName, displayName, permissions)
            VALUES (?, ?, ?, ?)
        `);
        
        stmt.bind([
            uuid,
            groupName,
            displayName,
            JSON.stringify(permissions || [])
        ]);
        
        stmt.execute();
        logDebug(`成功创建权限组: ${groupName}`);
        return true;
    } catch(e) {
        logger.error(`创建自定义权限组失败: ${e}`);
        return false;
    }
}



// 编辑自定义权限组
function editCustomGroup(uuid, groupName, displayName, permissions, inheritFrom = null) {
    try {
        const db = getDbSession();
        
        // 首先检查权限组是否存在
        const checkStmt = db.prepare("SELECT COUNT(*) FROM custom_groups WHERE uuid = ? AND groupName = ?");
        checkStmt.bind([uuid, groupName]);
        checkStmt.execute();
        
        if (!checkStmt.step() || checkStmt.fetch()[0] === 0) {
            logger.error(`找不到要编辑的权限组: uuid=${uuid}, groupName=${groupName}`);
            return false;
        }
        
        // 更新权限组信息
        const updateStmt = db.prepare(`
            UPDATE custom_groups 
            SET displayName = ?, permissions = ? 
            WHERE uuid = ? AND groupName = ?
        `);
        
        updateStmt.bind([
            displayName,
            JSON.stringify(permissions || []),
            uuid,
            groupName
        ]);
        
        updateStmt.execute();
        
        // 检查更新是否成功
        const rowsAffected = db.exec("SELECT changes()")[0][0];
        
        if (rowsAffected > 0) {
            logDebug(`成功编辑权限组: ${groupName}`);
            return true;
        } else {
            logger.warn(`权限组 ${groupName} 数据未变更或更新失败`);
            return false;
        }
    } catch(e) {
        logger.error(`编辑自定义权限组失败: ${e}`);
        return false;
    }
}

// 删除自定义权限组
function deleteCustomGroup(uuid, groupName) {
    const groupsData = loadCustomGroups();
    if(!groupsData[uuid] || !groupsData[uuid][groupName]) {
        return false;
    }
    
    delete groupsData[uuid][groupName];
    return saveCustomGroups(groupsData);
}

module.exports = {
    loadCustomGroups,
    saveCustomGroups,
    getPlayerCustomGroups,
    createCustomGroup,
    editCustomGroup,
    deleteCustomGroup
};