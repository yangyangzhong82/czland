// config.js
const { getDbSession } = require('./database');
const {logDebug, logInfo, logWarning, logError } = require('./logger');
// 读取区域数据
function loadAreaData() {
    try {
        const db = getDbSession();

        // 优化查询：只选择需要的列，虽然这里需要所有列来重建对象
        // const results = db.query("SELECT id, name, xuid, dimid, minX, minY, minZ, maxX, maxY, maxZ, isSubarea, parentAreaId, priority, createdTime, additionalData FROM areas");
        const results = db.query("SELECT * FROM areas"); // Keep SELECT * if all columns are indeed needed

        // 增强结果检查逻辑
        if (!results) {
            logger.warn("查询区域表返回null或undefined"); // More specific warning
            return {};
        }

        // results[0] 是表头
        if (results.length <= 1) { // 只有表头或空结果
            logDebug("区域表中没有数据记录");
            return {};
        }

        // 输出调试信息
        logDebug(`成功读取到 ${results.length - 1} 条区域记录`);

        // 转换为应用中使用的对象结构
        const areaData = {};
        const headers = results[0].map(h => h.toLowerCase()); // Normalize headers for safety
        const idIndex = headers.indexOf('id');
        const nameIndex = headers.indexOf('name');
        const xuidIndex = headers.indexOf('xuid');
        const dimidIndex = headers.indexOf('dimid');
        const minXIndex = headers.indexOf('minx');
        const minYIndex = headers.indexOf('miny');
        const minZIndex = headers.indexOf('minz');
        const maxXIndex = headers.indexOf('maxx');
        const maxYIndex = headers.indexOf('maxy');
        const maxZIndex = headers.indexOf('maxz');
        const isSubareaIndex = headers.indexOf('issubarea');
        const parentAreaIdIndex = headers.indexOf('parentareaid');
        const priorityIndex = headers.indexOf('priority');
        const createdTimeIndex = headers.indexOf('createdtime');
        const additionalDataIndex = headers.indexOf('additionaldata');

        // Check if essential columns are found
        if (idIndex === -1 /* || other essential indices === -1 */) {
             logger.error("区域表结构不匹配，缺少必要的列 (e.g., id)");
             return {};
        }


        for(let i = 1; i < results.length; i++) { // 跳过表头
            const row = results[i];
            // More robust row validation might be needed depending on query results format
            if (!row || !Array.isArray(row) || row.length !== headers.length) {
                logger.warn(`第 ${i} 行数据格式不正确或列数不匹配 (${row ? row.length : 'N/A'} vs ${headers.length})，跳过`);
                continue;
            }

            const areaId = row[idIndex]; // Use index

            if (!areaId) {
                logger.warn(`第 ${i} 行缺少区域ID，跳过`);
                continue;
            }

            const areaEntry = { // Build entry step-by-step
                name: row[nameIndex],
                xuid: row[xuidIndex],
                dimid: row[dimidIndex],
                point1: {
                    x: row[minXIndex], // minX
                    y: row[minYIndex], // minY
                    z: row[minZIndex]  // minZ
                },
                point2: {
                    x: row[maxXIndex], // maxX
                    y: row[maxYIndex], // maxY
                    z: row[maxZIndex]  // maxZ
                },
                isSubarea: row[isSubareaIndex] === 1,
                parentAreaId: row[parentAreaIdIndex],
                priority: row[priorityIndex],
                createTime: row[createdTimeIndex] // Changed from createdTime to createTime to match save
            };

            // 添加额外数据
            const additionalDataJson = row[additionalDataIndex];
            if(additionalDataJson) {
                try {
                    const additionalData = JSON.parse(additionalDataJson);
                    // Safely merge additional data, avoiding overwriting core properties
                    for (const key in additionalData) {
                        if (!(key in areaEntry) && key !== 'id') { // Don't overwrite core fields or id
                             areaEntry[key] = additionalData[key];
                        }
                    }
                } catch(e) {
                    logger.warn(`区域 ${areaId} 的额外数据解析失败: ${e.message || e}`);
                }
            }
             areaData[areaId] = areaEntry; // Assign fully constructed entry
        }

        return areaData;
    } catch(e) {
        logger.error(`读取区域数据失败: ${e.message || e}`, e.stack); // Log stack trace
        return {};
    }
}

// 保存区域数据
function saveAreaData(data) {
    let db; // Declare db outside try block for rollback access
    try {
        db = getDbSession(); // Get session

        // 开始一个事务
        db.exec("BEGIN TRANSACTION"); // <- Optimization: Use transaction

        // 清空旧数据 (Consider UPDATE/INSERT based on existence if performance is critical and IDs are stable)
        db.exec("DELETE FROM areas");

        // 遍历所有区域，使用预准备语句
        // Prepare statement outside the loop
        const stmt = db.prepare(`
            INSERT INTO areas (id, name, xuid, dimid, minX, minY, minZ, maxX, maxY, maxZ,
                             isSubarea, parentAreaId, priority, createdTime, additionalData)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `); // <- Optimization: Prepare statement once

        let savedCount = 0;
        for(const id in data) {
            const area = data[id];

            // 确保point1和point2存在
            if(!area.point1 || !area.point2) {
                logger.warn(`区域 ${id} 缺少 point1 或 point2 数据，跳过保存`);
                continue;
            }

            // 收集其他属性作为额外数据
            const additionalData = {};
            const coreKeys = new Set(['name', 'xuid', 'dimid', 'point1', 'point2', 'isSubarea', 'parentAreaId', 'priority', 'createTime']); // Use createTime consistently
            for(const key in area) {
                if(!coreKeys.has(key) && key !== 'id') { // Exclude core keys and 'id' if it exists on the object
                    additionalData[key] = area[key];
                }
            }

            try {
                 // Bind parameters to the prepared statement
                 // Use Nullish Coalescing Operator (??) for safer defaults
                 stmt.bind([
                     id,
                     String(area.name ?? ""),
                     String(area.xuid ?? ""),
                     Number(area.dimid ?? 0),
                     Number(area.point1.x ?? 0),
                     Number(area.point1.y ?? 0),
                     Number(area.point1.z ?? 0),
                     Number(area.point2.x ?? 0),
                     Number(area.point2.y ?? 0),
                     Number(area.point2.z ?? 0),
                     area.isSubarea ? 1 : 0, // Boolean to integer
                     area.parentAreaId ? String(area.parentAreaId) : null,
                     Number(area.priority ?? 0),
                     Number(area.createTime ?? Date.now()), // Use createTime
                     Object.keys(additionalData).length > 0 ? JSON.stringify(additionalData) : null
                 ]);

                 stmt.execute(); // Execute the bound statement
                 stmt.reset();   // Reset the statement for the next iteration (keeps compiled plan, clears bindings implicitly on next bind usually, but reset is good practice)
                 stmt.clear(); // Explicitly clear bindings if needed, reset might be enough

                 savedCount++;

            } catch (bindExecError) {
                logger.error(`区域 ${id} 保存时出错: ${bindExecError.message || bindExecError}`);
                // Optional: Log more details if possible
                // try {
                //     const errorInfo = db.query("SELECT sqlite_errmsg()");
                //     if (errorInfo && errorInfo.length > 1) {
                //         logger.error(`  SQLite错误详情: ${errorInfo[1][0]}`);
                //     }
                // } catch (err) { /* ignore lookup error */ }

                // Decide whether to continue or abort the transaction
                // Continuing might leave partial data, aborting loses all changes
                // For now, log and continue saving others. Consider adding a flag to abort on first error.
                stmt.reset(); // Reset statement even on error before next iteration
                stmt.clear();
                continue; // Skip this area
            }
        }

        // 提交事务
        db.exec("COMMIT"); // <- Optimization: Commit transaction

        logDebug(`成功保存 ${savedCount} / ${Object.keys(data).length} 个区域数据到数据库`);
        return true;
    } catch(e) {
        // 发生错误时回滚事务
        logger.error(`保存区域数据失败: ${e.message || e}`, e.stack); // Log stack trace
        if (db && db.isOpen()) { // Check if db is valid before rollback
            try {
                db.exec("ROLLBACK"); // <- Optimization: Rollback transaction on error
                logger.info("事务已回滚");
            } catch(rollbackErr) {
                logger.error(`事务回滚失败: ${rollbackErr}`);
            }
        } else {
             logger.error("数据库连接无效，无法回滚事务");
        }
        return false;
    } finally {
         // Ensure statement is reset/finalized if it was created
         // Note: LLSE API doesn't explicitly have stmt.finalize(), reset should suffice for reuse.
         // If not reusing (e.g., function exits), LLSE likely handles cleanup.
    }
}

module.exports = {
    loadAreaData,
    saveAreaData
};