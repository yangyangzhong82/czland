// customGroups.js

const CUSTOM_GROUPS_PATH = './plugins/area/customGroups.json';
const { DEFAULT_GROUPS } = require('./permission');

// 加载自定义权限组数据
function loadCustomGroups() {
    if (File.exists(CUSTOM_GROUPS_PATH)) {
        let content = File.readFrom(CUSTOM_GROUPS_PATH);
        try {
            return JSON.parse(content) || {};
        } catch(e) {
            return {};
        }
    }
    return {};
}

// 保存自定义权限组数据
function saveCustomGroups(data) {
    let jsonStr = JSON.stringify(data, null, 2);
    let dir = './plugins/area';
    if (!File.exists(dir)) {
        File.mkdir(dir);
    }
    const result = File.writeTo(CUSTOM_GROUPS_PATH, jsonStr);
    logger.info(`权限组数据保存结果: ${result}, 路径: ${CUSTOM_GROUPS_PATH}`);
    return File.writeTo(CUSTOM_GROUPS_PATH, jsonStr);
}

// 获取玩家的所有自定义权限组
function getPlayerCustomGroups(uuid) {
    const groupsData = loadCustomGroups();
    return groupsData[uuid] || {};
}

// 创建自定义权限组
function createCustomGroup(uuid, groupName, displayName, permissions, inheritFrom = null) {
    const groupsData = loadCustomGroups();
    if(!groupsData[uuid]) {
        groupsData[uuid] = {};
    }
    
    groupsData[uuid][groupName] = {
        name: displayName,
        permissions: permissions,
        inherit: null // 不再使用继承，总是设为null
    };
    
    return saveCustomGroups(groupsData);
}


// 编辑自定义权限组
function editCustomGroup(uuid, groupName, displayName, permissions, inheritFrom = null) {
    const groupsData = loadCustomGroups();
    if(!groupsData[uuid] || !groupsData[uuid][groupName]) {
        logger.error(`找不到要编辑的权限组: uuid=${uuid}, groupName=${groupName}`);
        return false;
    }
    
    // 设置权限组，不使用继承
    groupsData[uuid][groupName] = {
        name: displayName,
        permissions: permissions || [], 
        inherit: null // 不再使用继承，总是设为null
    };
    
    return saveCustomGroups(groupsData);
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