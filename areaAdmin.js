// areaAdmin.js
const { getDbSession } = require('./database');
const getOfflinePlayerData = ll.import("PlayerData", "getOfflinePlayerData");
const { logDebug, logInfo, logWarning, logError } = require('./logger');
// 存储领地管理员列表 (内存缓存)
let areaAdmins = {};

// 初始化时从数据库加载领地管理员数据到内存缓存
function loadAreaAdmins() {
    try {
        const db = getDbSession(); // 获取数据库会话


        // 查询所有管理员 (仅选择需要的列以提高效率)
        // const results = db.query("SELECT * FROM area_admins"); // 旧的查询，可能包含不必要的列
        const results = db.query("SELECT uuid, name, addTime FROM area_admins"); // <- 优化：仅选择需要的列

        if (!results) {
             logger.warn("查询领地管理员表返回 null 或 undefined");
             areaAdmins = {}; // 确保出错时缓存为空
             return {};
        }
        // 如果结果只有一行或没有行 (只有表头或完全为空)
        if (results.length <= 1) {
            logger.info("数据库中没有找到领地管理员数据");
            areaAdmins = {}; // 确保缓存为空
            return {};
        }

        // 将查询结果转换为以 UUID 为键的对象格式
        const admins = {};
        const headers = results[0].map(h => h.toLowerCase()); // 获取表头并转为小写
        const uuidIndex = headers.indexOf('uuid');
        const nameIndex = headers.indexOf('name');
        const addTimeIndex = headers.indexOf('addtime');

        // 检查表头是否包含必要的列
        if (uuidIndex === -1 || nameIndex === -1 || addTimeIndex === -1) {
            logger.error("领地管理员表结构不匹配，缺少 uuid, name 或 addTime 列");
            areaAdmins = {}; // 清空缓存
            return {};
        }

        // 遍历数据行 (从索引 1 开始，跳过表头)
        for (let i = 1; i < results.length; i++) {
            const row = results[i];
            // 确保行数据有效且长度与表头匹配
            if (row && row.length === headers.length) {
                 admins[row[uuidIndex]] = { // 使用 UUID 作为键
                     name: row[nameIndex],
                     addTime: row[addTimeIndex]
                 };
            } else {
                 logger.warn(`跳过格式不正确的领地管理员行 ${i}`);
            }
        }

        logger.info(`成功从数据库加载 ${Object.keys(admins).length} 个领地管理员`);
        areaAdmins = admins; // 更新内存缓存
        return admins; // 返回加载的数据 (虽然通常直接用缓存)
    } catch (e) {
        logger.error(`加载领地管理员数据失败: ${e}`, e.stack);
        areaAdmins = {}; // 确保出错时缓存为空
        return {};
    }
}
// 将内存中的领地管理员数据保存回数据库
function saveAreaAdmins() {
    let db;
    try {
        db = getDbSession(); // 获取数据库会话

        // 开始数据库事务，确保操作的原子性
        db.exec("BEGIN TRANSACTION"); // <- 优化：使用事务

        // 清空表中的旧数据，准备写入新数据
        db.exec("DELETE FROM area_admins");

        // 准备 SQL 插入语句 (预编译语句提高性能和安全性)
        const stmt = db.prepare("INSERT INTO area_admins (uuid, name, addTime) VALUES (?, ?, ?)"); // <- 优化：预编译语句

        let savedCount = 0;
        // 遍历内存缓存中的管理员数据
        for (const uuid in areaAdmins) {
            const admin = areaAdmins[uuid];
            // 进行基本的数据验证
            if (admin && typeof uuid === 'string' && typeof admin.name === 'string' && typeof admin.addTime === 'number') {
                stmt.bind([uuid, admin.name, admin.addTime]); // 绑定参数
                stmt.execute(); // 执行插入
                stmt.reset(); // 重置语句以便下次迭代使用
                savedCount++;
            } else {
                logger.warn(`跳过无效的管理员数据 for UUID: ${uuid}`);
                stmt.reset(); // 即使跳过也要重置
            }
        }

        // 提交事务，将所有更改写入数据库
        db.exec("COMMIT"); // <- 优化：提交事务

        logger.info(`成功保存 ${savedCount} / ${Object.keys(areaAdmins).length} 个领地管理员数据到数据库`);
        return true; // 保存成功
    } catch (e) {
        logger.error(`保存领地管理员数据失败: ${e}`, e.stack);
        // 如果发生错误，回滚事务，撤销本次操作的所有更改
        if (db && db.isOpen()) { // 检查数据库连接是否仍然有效
            try {
                db.exec("ROLLBACK"); // <- 优化：出错时回滚
                logger.info("管理员保存事务已回滚");
            } catch (rollbackErr) {
                logger.error(`事务回滚失败: ${rollbackErr}`);
            }
        } else {
             logger.error("数据库连接无效，无法回滚事务");
        }
        return false; // 保存失败
    } finally {
        // 可以在这里 finalize/reset 预编译语句，但 LLSE 环境下可能由引擎自动处理
    }
}

// 添加一个新的领地管理员到内存缓存
function addAreaAdmin(uuid, name) {
    // 基本参数验证
    if (typeof uuid !== 'string' || uuid === '' || typeof name !== 'string' || name === '') {
         logger.warn(`尝试添加无效的管理员: UUID='${uuid}', Name='${name}'`);
         return false;
    }
    // 检查是否已经是管理员
    if (areaAdmins[uuid]) {
        logger.debug(`玩家 ${name} (${uuid}) 已经是管理员，无需重复添加`);
        return false; // 已经是管理员
    }

    // 添加到内存缓存
    areaAdmins[uuid] = {
        name: name,
        addTime: Date.now() // 记录添加时间
    };
    logger.info(`领地管理员 ${name} (${uuid}) 已添加到缓存`);
    // 考虑是否需要立即保存到数据库，或者标记缓存为“脏”，稍后统一保存
    // saveAreaAdmins(); // 如果需要立即持久化，取消此行注释
    return true; // 添加成功
}

// 根据玩家名称查找玩家信息 (UUID 和 准确名称)
function findPlayerByName(playerName) {
    // 1. 尝试查找在线玩家
    const onlinePlayer = mc.getPlayer(playerName); // 使用 LLSE API 查找在线玩家
    if (onlinePlayer) {
        return {
            uuid: onlinePlayer.uuid,
            name: onlinePlayer.name, // 使用在线玩家的准确名称
            isOnline: true
        };
    }

    // 2. 如果找不到在线玩家，尝试查找离线玩家数据
    try {
        // 调用导入的 PlayerData API 获取离线玩家数据
        const offlinePlayersData = getOfflinePlayerData();
        if (!offlinePlayersData || typeof offlinePlayersData !== 'object') {
             logger.warn("getOfflinePlayerData 返回无效数据或非对象类型");
             return null;
        }
        // 假设 offlinePlayersData 是一个对象数组，结构类似 [{uuid, name, ...}]
        // (需要根据 PlayerData API 的实际返回结构调整)
        if (Array.isArray(offlinePlayersData)) {
             const lowerCaseName = playerName.toLowerCase(); // 转换为小写以进行不区分大小写的比较
             // 查找名称匹配的玩家
             const matchedPlayer = offlinePlayersData.find(p => p && typeof p.name === 'string' && p.name.toLowerCase() === lowerCaseName);

             // 如果找到匹配且 UUID 有效
             if (matchedPlayer && typeof matchedPlayer.uuid === 'string') {
                 return {
                     uuid: matchedPlayer.uuid,
                     name: matchedPlayer.name, // 使用离线数据中的准确名称
                     isOnline: false
                 };
             }
        } else {
             logger.warn("getOfflinePlayerData 返回的不是预期的数组格式");
        }

    } catch(e) {
         logger.error(`查找离线玩家数据时出错: ${e}`, e.stack);
    }

    // 3. 如果在线和离线都找不到
    logger.debug(`未找到名为 "${playerName}" 的在线或离线玩家`);
    return null; // 未找到玩家
}

// 根据 UUID 从内存缓存中移除领地管理员
function removeAreaAdmin(uuid) {
    // 基本参数验证
    if (typeof uuid !== 'string' || uuid === '') {
         logger.warn(`尝试移除无效的管理员 UUID: '${uuid}'`);
         return false;
    }
   // 检查该 UUID 是否确实是管理员
   if (!areaAdmins[uuid]) {
       logger.debug(`UUID ${uuid} 不是管理员，无需移除`);
       return false; // 不是管理员
   }

   const adminName = areaAdmins[uuid].name; // 在删除前获取名称用于日志记录
   delete areaAdmins[uuid]; // 从缓存中删除
   logger.info(`领地管理员 ${adminName} (${uuid}) 已从缓存移除`);
   // 考虑是否需要立即保存到数据库
   // saveAreaAdmins(); // 如果需要立即持久化，取消此行注释
   return true; // 移除成功
}

// 检查指定 UUID 的玩家是否是领地管理员
function isAreaAdmin(uuid) {
    // 直接检查缓存中是否存在该 UUID 的键
    return !!areaAdmins[uuid]; // 使用 !! 将值转换为布尔类型
}

// 获取所有领地管理员的列表 (返回缓存的浅拷贝以防止外部修改)
function getAllAreaAdmins() {
    return {...areaAdmins}; // 使用扩展运算符创建浅拷贝
}

// 插件加载时自动执行一次加载操作
loadAreaAdmins();

module.exports = {
    addAreaAdmin, // 导出添加管理员函数
    removeAreaAdmin, // 导出移除管理员函数
    isAreaAdmin, // 导出检查是否为管理员函数
    getAllAreaAdmins, // 导出获取所有管理员列表函数
    saveAreaAdmins, // 导出保存管理员数据函数 (可能用于手动保存或特定场景)
    loadAreaAdmins, // 导出加载管理员数据函数 (可能用于手动重载)
    findPlayerByName // 导出根据名称查找玩家函数
};
