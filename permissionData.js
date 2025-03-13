// permissionData.js

const PERMISSION_DATA_PATH = './plugins/area/permissions.json';
const { getDbSession } = require('./database');

// 加载权限组数据
function loadPermissionData() {
    try {
        const db = getDbSession();
        const results = db.query("SELECT playerUuid, areaId, groupName FROM permissions");
        
        // 检查results是否有效
        if (!results) {
            logger.warn("查询权限表返回空结果");
            return {};
        }
        
        // 转换为旧格式的对象结构
        const permissionData = {};
        for(let i = 1; i < results.length; i++) { // 跳过表头
            const [playerUuid, areaId, groupName] = results[i];
            
            if(!permissionData[playerUuid]) {
                permissionData[playerUuid] = {};
            }
            
            permissionData[playerUuid][areaId] = groupName;
        }
        
        return permissionData;
    } catch(e) {
        logger.error(`读取权限数据失败: ${e}`);
        return {};
    }
}

// 保存权限组数据
// 保存权限组数据
function savePermissionData(data) {
    try {
        const db = getDbSession();
        
        // 开始一个事务
        db.exec("BEGIN TRANSACTION");
        
        // 清空旧数据
        db.exec("DELETE FROM permissions");
        
        // 使用问号占位符
        const stmt = db.prepare("INSERT INTO permissions (playerUuid, areaId, groupName) VALUES (?, ?, ?)");
        
        // 插入新数据
        let count = 0;
        for(const playerUuid in data) {
            for(const areaId in data[playerUuid]) {
                const groupName = data[playerUuid][areaId];
                
                // 添加参数验证
                if (!playerUuid || !areaId || !groupName) {
                    logger.warn(`跳过无效权限数据: playerUuid=${playerUuid}, areaId=${areaId}, groupName=${groupName}`);
                    continue;
                }
                
                // 清除先前的绑定，然后再绑定新参数
                stmt.reset();  // 先重置语句状态
                stmt.clear();  // 清除先前的绑定参数
                
                // 一次性绑定所有参数
                stmt.bind([playerUuid, areaId, groupName]);
                stmt.execute();  // 执行语句
                
                count++;
            }
        }
        
        // 提交事务
        db.exec("COMMIT");
        
        logger.info(`成功保存${count}条权限数据到数据库`);
        return true;
    } catch(e) {
        // 发生错误时回滚事务
        try {
            getDbSession().exec("ROLLBACK");
        } catch(rollbackErr) {
            logger.error(`事务回滚失败: ${rollbackErr}`);
        }
        
        logger.error(`保存权限数据失败: ${e}`);
        return false;
    }
}

module.exports = {
    loadPermissionData,
    savePermissionData
};