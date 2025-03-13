// subarea.js
const { isInArea, checkNewAreaOverlap } = require('./utils');
const { getAreaData } = require('./czland');
const { checkPermission } = require('./permission');
const { PERMISSIONS } = require('./permissionRegistry');
const { loadConfig } = require('./configManager');

// 创建子区域
function createSubArea(parentAreaId, name, point1, point2, owner) {
    const areaData = getAreaData();
    const parentArea = areaData[parentAreaId];
    
    if(!parentArea) {
        return {
            success: false,
            message: "父区域不存在"
        };
    }
    
    // 检查新子区域是否在父区域范围内
    if(!isInParentArea(point1, point2, parentArea)) {
        return {
            success: false,
            message: "子区域必须完全在父区域范围内"
        };
    }
    
    // 生成子区域ID
    const subareaId = `${parentAreaId}_sub_${Date.now()}`;
    
    // 创建子区域数据结构
    const subarea = {
        name: name,
        point1: point1,
        point2: point2,
        parentAreaId: parentAreaId,
        xuid: owner.xuid,
        uuid: owner.uuid,
        createTime: new Date().getTime(),
        // 继承父区域的规则，但可以单独修改
        rules: {...parentArea.rules},
        // 继承父区域的权限组设置
        permissions: {...parentArea.permissions}
    };
    
    // 将子区域添加到区域数据中
    if(!parentArea.subareas) {
        parentArea.subareas = {};
    }
    parentArea.subareas[subareaId] = subarea;
    
    return {
        success: true,
        subareaId: subareaId
    };
}

// 检查点是否在父区域内
function isInParentArea(point1, point2, parentArea) {
    const pMinX = Math.min(parentArea.point1.x, parentArea.point2.x);
    const pMaxX = Math.max(parentArea.point1.x, parentArea.point2.x);
    const pMinY = Math.min(parentArea.point1.y, parentArea.point2.y);
    const pMaxY = Math.max(parentArea.point1.y, parentArea.point2.y);
    const pMinZ = Math.min(parentArea.point1.z, parentArea.point2.z);
    const pMaxZ = Math.max(parentArea.point1.z, parentArea.point2.z);
    
    return point1.x >= pMinX && point1.x <= pMaxX &&
           point2.x >= pMinX && point2.x <= pMaxX &&
           point1.y >= pMinY && point1.y <= pMaxY &&
           point2.y >= pMinY && point2.y <= pMaxY &&
           point1.z >= pMinZ && point1.z <= pMaxZ &&
           point2.z >= pMinZ && point2.z <= pMaxZ;
}

// 获取子区域
function getSubArea(parentAreaId, subareaId) {
    const areaData = getAreaData();
    const parentArea = areaData[parentAreaId];
    
    if(!parentArea || !parentArea.subareas) {
        return null;
    }
    
    return parentArea.subareas[subareaId];
}

// 删除子区域
function deleteSubArea(parentAreaId, subareaId) {
    const areaData = getAreaData();
    const parentArea = areaData[parentAreaId];
    
    if(!parentArea || !parentArea.subareas || !parentArea.subareas[subareaId]) {
        return false;
    }
    
    delete parentArea.subareas[subareaId];
    return true;
}

module.exports = {
    createSubArea,
    getSubArea,
    deleteSubArea,
    isInParentArea
};