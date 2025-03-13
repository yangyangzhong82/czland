// config.js
const { getDbSession } = require('./database');

// 读取区域数据
// 读取区域数据
function loadAreaData() {
    try {
        const db = getDbSession();
        const results = db.query("SELECT * FROM areas");
        
        // 检查results是否有效
        if (!results) {
            logger.warn("查询区域表返回空结果");
            return {};
        }
        
        // 转换为应用中使用的对象结构
        const areaData = {};
        for(let i = 1; i < results.length; i++) { // 跳过表头
            const row = results[i];
            const areaId = row[0]; // id列
            
            areaData[areaId] = {
                name: row[1],
                xuid: row[2],
                dimid: row[3],
                point1: {
                    x: row[4], // minX
                    y: row[5], // minY
                    z: row[6]  // minZ
                },
                point2: {
                    x: row[7], // maxX
                    y: row[8], // maxY
                    z: row[9]  // maxZ
                },
                isSubarea: row[10] === 1,
                parentAreaId: row[11],
                priority: row[12],
                createTime: row[13]
            };
            
            // 添加额外数据
            if(row[14]) {
                try {
                    const additionalData = JSON.parse(row[14]);
                    Object.assign(areaData[areaId], additionalData);
                } catch(e) {
                    logger.warn(`区域${areaId}的额外数据解析失败`);
                }
            }
        }
        
        return areaData;
    } catch(e) {
        logger.error(`读取区域数据失败: ${e}`);
        return {};
    }
}

// 保存区域数据
// 保存区域数据
function saveAreaData(data) {
    try {
        const db = getDbSession();
        
        // 开始一个事务
        db.exec("BEGIN TRANSACTION");
        
        // 清空旧数据
        db.exec("DELETE FROM areas");
        
        const stmt = db.prepare(`
            INSERT INTO areas (id, name, xuid, dimid, minX, minY, minZ, maxX, maxY, maxZ, 
                             isSubarea, parentAreaId, priority, createdTime, additionalData)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        // 插入新数据
        for(const id in data) {
            const area = data[id];
            
            // 确保point1和point2存在
            if(!area.point1 || !area.point2) {
                logger.warn(`区域${id}缺少point1或point2数据，跳过保存`);
                continue;
            }
            
            // 收集其他属性作为额外数据
            const additionalData = {};
            for(const key in area) {
                if(key !== 'name' && key !== 'xuid' && key !== 'dimid' && 
                   key !== 'point1' && key !== 'point2' && key !== 'isSubarea' && 
                   key !== 'parentAreaId' && key !== 'priority' && key !== 'createTime') {
                    additionalData[key] = area[key];
                }
            }
            
            try {
                // 一次性绑定所有参数，使用数组形式
                stmt.bind([
                    id,
                    area.name || "",
                    area.xuid || "",
                    area.dimid || 0,
                    area.point1.x != null ? area.point1.x : 0,
                    area.point1.y != null ? area.point1.y : 0,
                    area.point1.z != null ? area.point1.z : 0,
                    area.point2.x != null ? area.point2.x : 0,
                    area.point2.y != null ? area.point2.y : 0,
                    area.point2.z != null ? area.point2.z : 0,
                    area.isSubarea ? 1 : 0,
                    area.parentAreaId || null,
                    area.priority || 0,
                    area.createTime || Date.now(),
                    Object.keys(additionalData).length > 0 ? JSON.stringify(additionalData) : null
                ]);
                
                stmt.execute();
                stmt.reset();
            } catch (e) {
                logger.warn(`区域${id}保存失败: ${e}`);
                continue; // 跳过这个区域
            }
        }
        
        // 提交事务
        db.exec("COMMIT");
        
        logger.info(`成功保存${Object.keys(data).length}个区域数据到数据库`);
        return true;
    } catch(e) {
        // 发生错误时回滚事务
        try {
            getDbSession().exec("ROLLBACK");
        } catch(rollbackErr) {
            logger.error(`事务回滚失败: ${rollbackErr}`);
        }
        
        logger.error(`保存区域数据失败: ${e}`);
        return false;
    }
}

module.exports = {
    loadAreaData,
    saveAreaData
};